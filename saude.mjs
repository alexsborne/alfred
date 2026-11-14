// Aba Saúde: lê saude/exames.json (fora do git), calcula a situação e a tendência de cada item
// e guarda tudo cifrado com uma palavra-chave própria (SAUDE_PASSWORD), além da senha do painel.
// Sem SAUDE_PASSWORD no ambiente, mantém o cofre que já estava no data.json.
import { readFileSync, existsSync } from 'node:fs';
import { webcrypto as crypto } from 'node:crypto';

const ARQ = new URL('./saude/exames.json', import.meta.url);

const situacao = (x, it) => it.min != null && x < it.min ? 'baixo' : it.max != null && x > it.max ? 'alto' : 'ok';
// distância relativa até a faixa de referência (0 = dentro)
function fora(x, it) {
  if (it.min != null && x < it.min) return (it.min - x) / it.min;
  if (it.max != null && x > it.max) return (x - it.max) / it.max;
  return 0;
}

export function analisar(d) {
  for (const g of d.grupos) for (const it of g.itens) {
    const pts = Object.entries(it.v).sort(([a], [b]) => a.localeCompare(b));
    it.pontos = pts.map(([data, x]) => ({ data, x, s: situacao(x, it) }));
    const a = pts[0][1], z = pts[pts.length - 1][1];
    const semRef = it.min == null && it.max == null;
    let t;
    if (pts.length < 2) t = 'unico';
    else if (semRef) t = 'semref';
    else {
      const fa = fora(a, it), fz = fora(z, it);
      if (fa === 0 && fz === 0) t = 'normal';
      else if (fa === 0) t = 'piorou';
      else if (fz === 0) t = 'melhorou';
      else if (fz < fa - 0.02) t = 'melhorou';
      else if (fz > fa + 0.02) t = 'piorou';
      else t = fz === 0 ? 'normal' : 'igual';
    }
    it.tendencia = t;
    it.atual = it.pontos[it.pontos.length - 1];
    it.variacao = pts.length > 1 && a ? Math.round((z - a) / Math.abs(a) * 1000) / 10 : null;
  }
  return d;
}

async function cifrar(obj, senha) {
  const iterations = 600000;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(senha), 'PBKDF2', false, ['deriveKey']);
  const aes = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, k,
    { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aes, new TextEncoder().encode(JSON.stringify(obj))));
  const b64 = u => Buffer.from(u).toString('base64');
  return { iterations, salt: b64(salt), iv: b64(iv), data: b64(data) };
}

export async function mergeSaude(painel) {
  const i = painel.areas.findIndex(a => a.id === 'saude');
  const antiga = i >= 0 ? painel.areas.splice(i, 1)[0] : null;
  const senha = process.env.SAUDE_PASSWORD;
  let cofre = antiga?.cofre || null;
  if (senha && existsSync(ARQ)) cofre = await cifrar(analisar(JSON.parse(readFileSync(ARQ, 'utf8'))), senha);
  if (!cofre) return painel;
  painel.areas.push({
    id: 'saude', title: 'Saúde', icon: '🩺',
    summary: 'Evolução dos seus exames de sangue e de imagem (nov/2023 a ago/2026). Protegido por uma palavra-chave própria.',
    cofre,
  });
  return painel;
}

// Página pública da Saúde (para o médico): HTML estático, sem senha e sem nenhum link para o Alfred.
// Fica em docs/<slug>/ — o slug aleatório é guardado em saude/slug.txt. Usa as mesmas funções de
// desenho da aba (template.html), executadas aqui no build.
import { writeFileSync, mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
export function paginaPublica() {
  if (!existsSync(ARQ)) return null;
  const SLUG = new URL('./saude/slug.txt', import.meta.url);
  if (!existsSync(SLUG)) writeFileSync(SLUG, 'exames-' + randomBytes(6).toString('hex'));
  const slug = readFileSync(SLUG, 'utf8').trim();
  const tpl = readFileSync(new URL('./template.html', import.meta.url), 'utf8');
  const css = tpl.match(/<style>[\s\S]*?<\/style>/)[0];
  const js = tpl.split('<script>')[1];
  const trecho = js.slice(js.indexOf('const esc ='), js.indexOf('\n', js.indexOf('const esc =')))
    + '\n' + js.slice(js.indexOf('// ---------- Saúde'), js.indexOf('function saudeHTML'));
  const { saudeConteudo } = new Function('atob', 'crypto', trecho + '; return { saudeConteudo };')(() => '', null);
  const d = analisar(JSON.parse(readFileSync(ARQ, 'utf8')));
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive">
<meta name="referrer" content="no-referrer"><title>Evolução dos exames laboratoriais</title>${css}</head>
<body><main style="max-width:1100px;margin:0 auto;padding:18px 14px 60px">
<h1 style="margin:0 0 4px">🩺 Evolução dos exames laboratoriais</h1>
<p class="summary">Paciente masculino, 47 anos. Resultados de nov/2023 a ago/2026, organizados por grupo, com a faixa de referência do laboratório. Atualizado em ${new Date().toLocaleDateString('pt-BR')}.</p>
${saudeConteudo(d).replace(/href="#" data-goto="/g, 'href="#')}</main></body></html>`;
  mkdirSync(new URL(`./docs/${slug}/`, import.meta.url), { recursive: true });
  writeFileSync(new URL(`./docs/${slug}/index.html`, import.meta.url), html);
  return slug;
}
