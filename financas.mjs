// Lê a fatura mais recente do Nubank (CSV exportado pelo app) e calcula o resumo
// do cartão para a aba "Finanças" do painel.
// As faturas ficam em ./financas/ (pasta fora do git — ver .gitignore).
// Chamado pelo build.mjs; também roda sozinho: `node financas.mjs` (mostra o JSON gerado).
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const FIN_DIR = new URL('./financas/', import.meta.url);

// Ordem importa: a primeira categoria que casar vence.
const CATEGORIAS = [
  ['Renegociação Nubank', /renegocia/],
  ['Cursos e concursos', /tec concursos|estudei|alura|cod3r|hubla|edzguiado|brasil paral|emprcsaempdeltaia|centro brasileiro|zt dapia|douglas bock|full ?cycle/],
  ['Assinaturas e IA', /google|microsoft|grok|anthropic|netflix|spotify|openai|chatgpt|iof de compra/],
  ['Combustível', /posto|combust/],
  ['Carro e moto', /pneu|moto ?pe|motope|auto p|marpes|gaucho|oficina/],
  ['Farmácia e saúde', /droga|farmac|medfacil|crd medicina|floratta|drogasil/],
  ['Mercado', /supermerc|atacad|701 goiania|carrefour gos|cencosud|celeiro|super bessa|emporio|touros|casa de carne|laranjeiras premium|casa martines|altas horas|valori|hortifruti/],
  ['Lanche, padaria e restaurante', /panific|padaria|galpao|salgados|tapioca|restaur|chop|halls|buteco|99food|ifood|bebidas|cerveja|beer|brasaville|equilaneguima|stravaganza|itd|reinvventar|lanch/],
];

const num = s => Number(String(s).replace(/\s/g, '').replace(/\./g, '').replace(',', '.'));
const r2 = n => Math.round(n * 100) / 100;

function parseCSV(text) {
  const [head, ...lines] = text.trim().split(/\r?\n/);
  const cols = head.split(',');
  return lines.map(line => {
    const cells = [...line.matchAll(/"([^"]*)"|([^,]+)|(?<=,)(?=,|$)/g)].map(m => m[1] ?? m[2] ?? '');
    return Object.fromEntries(cols.map((c, i) => [c, cells[i] ?? '']));
  });
}

const addMonths = (iso, n) => {
  const d = new Date(iso.slice(0, 7) + '-01T12:00:00');
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 7);
};

export function lerFatura() {
  if (!existsSync(FIN_DIR)) return null;
  const files = readdirSync(FIN_DIR).filter(f => /^Nubank_\d{4}-\d{2}-\d{2}\.csv$/.test(f)).sort();
  if (!files.length) return null;
  const arquivo = files.at(-1);
  const vencimento = arquivo.match(/\d{4}-\d{2}-\d{2}/)[0];
  const rows = parseCSV(readFileSync(join(FIN_DIR.pathname.replace(/^\/(\w:)/, '$1'), arquivo), 'utf8'))
    .map(r => ({ date: r.date, title: r.title, valor: num(r.amount) }));

  const compras = rows.filter(r => r.valor > 0);
  const creditos = rows.filter(r => r.valor < 0);
  const pagamentos = creditos.filter(r => /pagamento recebido/i.test(r.title));

  const cat = new Map();
  for (const r of compras) {
    const t = r.title.toLowerCase();
    const nome = (CATEGORIAS.find(([, re]) => re.test(t)) || ['Outros'])[0];
    const c = cat.get(nome) || { nome, valor: 0, qtd: 0 };
    c.valor += r.valor; c.qtd++; cat.set(nome, c);
  }

  // Parcelas: "Loja - Parcela 3/12" ou "Renegociação ... - 1/5"
  const parcelas = compras.map(r => {
    const m = /(?:Parcela\s+)?(\d+)\/(\d+)\s*$/.exec(r.title);
    if (!m || !/ - /.test(r.title)) return null;
    const atual = +m[1], total = +m[2], restam = total - atual;
    return {
      nome: r.title.replace(/\s*-\s*(Parcela\s+)?\d+\/\d+\s*$/, '').replace(/^(Pg|Mp|Jim\.Com|Ig|Hubla) ?\*\s*/i, ''),
      parcela: `${atual}/${total}`, valor: r2(r.valor), restam,
      falta: r2(restam * r.valor), ultima: addMonths(vencimento, restam),
    };
  }).filter(Boolean).sort((a, b) => a.restam - b.restam || b.valor - a.valor);

  // Quanto das próximas faturas já está comprometido só com parcelas
  const comprometido = [];
  for (let i = 1; i <= 6; i++) {
    const mes = addMonths(vencimento, i);
    const v = parcelas.filter(p => p.restam >= i).reduce((s, p) => s + p.valor, 0);
    comprometido.push({ mes, valor: r2(v), qtd: parcelas.filter(p => p.restam >= i).length });
  }

  const lanches = compras.filter(r => /galpao|salgados|panific|padaria/i.test(r.title));
  return {
    arquivo, vencimento,
    periodo: [rows.at(-1)?.date, rows[0]?.date],
    compras: r2(compras.reduce((s, r) => s + r.valor, 0)),
    qtdCompras: compras.length,
    pagos: r2(-pagamentos.reduce((s, r) => s + r.valor, 0)),
    pagamentos: pagamentos.map(p => ({ date: p.date, valor: r2(-p.valor) })),
    categorias: [...cat.values()].map(c => ({ ...c, valor: r2(c.valor) })).sort((a, b) => b.valor - a.valor),
    parcelas,
    totalParcelas: r2(parcelas.reduce((s, p) => s + p.valor, 0)),
    comprometido,
    maiores: [...compras].filter(r => !/ - /.test(r.title)).sort((a, b) => b.valor - a.valor).slice(0, 8),
    lanchesQtd: lanches.length,
  };
}

export function mergeFinancas(painel) {
  const area = painel.areas.find(a => a.id === 'financas');
  if (!area?.budget) return painel;
  const cartao = lerFatura();
  if (cartao) area.budget.cartao = cartao;
  return painel;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(lerFatura(), null, 2));
}
