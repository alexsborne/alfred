// Lê o projeto de estudos SEFAZ-DF e devolve a aba "SEFAZ-DF" do painel.
// Chamado pelo build.mjs; também roda sozinho: `node sefaz.mjs` (mostra o JSON gerado).
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const SEFAZ_DIR = 'C:/Users/alexandre.lopes/OneDrive/estudo.com.ia/sefaz_df_2';
const SITE = 'https://alexsborne.github.io/trilha_sefaz_df/';

function listPages(dir) {
  const pages = new Map(); // tarefa -> caminho relativo
  if (!existsSync(dir)) return pages;
  for (const sub of readdirSync(dir)) {
    const p = join(dir, sub);
    if (sub.startsWith('.') || !statSync(p).isDirectory()) continue;
    for (const f of readdirSync(p)) {
      const m = /^T(\d+)_.*\.html$/.exec(f);
      if (m) pages.set(Number(m[1]), `${sub}/${f}`);
    }
  }
  return pages;
}

function sessions(historico) {
  // "## 2026-10-26: título"
  return [...historico.matchAll(/^## (\d{4}-\d{2}-\d{2}):\s*(.+)$/gm)].map(m => ({ date: m[1], title: m[2].trim() }));
}

function pendencias(historico) {
  // linhas do histórico marcadas com **pendência**
  // (inclui as linhas de continuação, que vêm mais recuadas e sem "- ")
  const lines = historico.split('\n');
  const out = [];
  lines.forEach((l, i) => {
    if (!/\*\*pend[êe]ncia\*\*/i.test(l)) return;
    const indent = l.search(/\S/);
    let txt = l.trim();
    for (let j = i + 1; j < lines.length; j++) {
      const n = lines[j];
      if (!n.trim() || /^\s*-\s/.test(n) || n.search(/\S/) <= indent) break;
      txt += ' ' + n.trim();
    }
    out.push(txt.replace(/^-\s*/, '').replace(/\*\*/g, ''));
  });
  return out;
}

const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);

export function sefazArea(today = new Date().toISOString().slice(0, 10)) {
  if (!existsSync(SEFAZ_DIR)) return null;
  const quadro = JSON.parse(readFileSync(join(SEFAZ_DIR, 'estrategia/trilha/quadro_tarefas.json'), 'utf8'));
  const hist = readFileSync(join(SEFAZ_DIR, 'contexto/historico_sessoes.md'), 'utf8');
  const pages = listPages(join(SEFAZ_DIR, 'plano_html'));
  const sess = sessions(hist);
  const last = sess.at(-1);
  const pend = pendencias(hist);

  const total = quadro.length;
  const done = quadro.filter(t => pages.has(t.tarefa));
  const todo = quadro.filter(t => !pages.has(t.tarefa));
  const semPdf = todo.filter(t => Object.values(t.arquivos || {}).some(a => a.length === 0));

  const trilhas = [...new Set(quadro.map(t => t.trilha))].sort();
  const porTrilha = trilhas.map(tr => {
    const ts = quadro.filter(t => t.trilha === tr);
    return `Trilha ${tr}: ${ts.filter(t => pages.has(t.tarefa)).length}/${ts.length}`;
  }).join(' · ');

  const parado = last ? daysBetween(last.date, today) : null;
  const items = [];

  // Próximas tarefas sem página (as 4 primeiras, em ordem)
  const proximas = todo.slice(0, 4);
  if (proximas.length) {
    items.push({
      priority: parado !== null && parado >= 7 ? 'alta' : 'media',
      title: `Próximas tarefas da trilha: ${proximas.map(t => 'T' + t.tarefa).join(', ')}`,
      detail: proximas.map(t => `T${t.tarefa} (Trilha ${t.trilha}) ${t.disciplina}: ${t.estudar}`).join(' | '),
      date: today,
      links: [
        { label: 'Abrir a trilha (site)', url: SITE },
        { label: 'Curso de T' + proximas[0].tarefa + ' no Estratégia', url: proximas[0].link }
      ].filter(l => l.url)
    });
  }

  if (semPdf.length) {
    items.push({
      priority: 'media',
      title: `${semPdf.length} tarefa(s) sem o PDF baixado`,
      detail: `${semPdf.map(t => 'T' + t.tarefa + ' ' + t.disciplina).join(', ')}. No Claude Code, dentro de sefaz_df_2, use a skill sefaz-baixar-aulas.`,
      date: today,
      links: []
    });
  }

  for (const p of pend) {
    items.push({ priority: 'media', title: 'Pendência de material: ' + p.split(':')[0].slice(0, 80), detail: p, date: last?.date || today, links: [] });
  }

  items.push({
    priority: 'baixa',
    title: `Progresso: ${done.length} de ${total} tarefas com página de estudo`,
    detail: `${porTrilha}. Acertos nas questões ficam salvos no navegador de cada aparelho; veja no índice do site.`,
    date: today,
    links: [{ label: 'Site da trilha', url: SITE }]
  });

  if (last) {
    items.push({
      priority: parado >= 7 ? 'alta' : 'baixa',
      title: `Última sessão do projeto: ${last.date.split('-').reverse().join('/')}${parado ? ` (há ${parado} dia${parado > 1 ? 's' : ''})` : ' (hoje)'}`,
      detail: last.title + (parado >= 7 ? ' — faz uma semana ou mais sem sessão nova; retome a trilha.' : ''),
      date: last.date,
      links: []
    });
  }

  const summary = `${done.length}/${total} tarefas com página (${porTrilha}). Próxima: ` +
    (proximas[0] ? `T${proximas[0].tarefa} ${proximas[0].disciplina}` : 'nenhuma') +
    (parado !== null ? `. Última sessão há ${parado} dia(s).` : '.');

  return { id: 'sefaz', title: 'SEFAZ-DF', icon: '🧾', summary, items };
}

// Insere/atualiza a aba no objeto do painel (logo depois de "Concursos").
export function mergeSefaz(data) {
  const area = sefazArea();
  if (!area) return data;
  const i = data.areas.findIndex(a => a.id === 'sefaz');
  if (i >= 0) data.areas[i] = area;
  else {
    const c = data.areas.findIndex(a => a.id === 'concursos');
    data.areas.splice(c >= 0 ? c + 1 : data.areas.length, 0, area);
  }
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(sefazArea(), null, 2));
}
