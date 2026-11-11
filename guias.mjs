// Junta TODOS os guias de estudo numa única aba "Guias de estudo":
// cartões de cada guia (CGU, TCE-GO, Câmara, SEFAZ-DF, Engenharia de IA, guia da Raiza),
// + o progresso da trilha de IA (área 'ia', de trilha.mjs) + as tarefas da SEFAZ-DF (área 'sefaz', de sefaz.mjs).
// Roda por último no build; remove as abas separadas 'sefaz' e 'ia' e os itens de guia da aba Concursos.

const SITE = 'https://alexsborne.github.io/trilha_sefaz_df/';
const TEC = id => `https://www.tecconcursos.com.br/questoes/pastas/${id}`;

export const GUIAS = [
  {
    id: 'cgu', titulo: 'CGU · Auditoria (AFFC)', icone: '🏛️', prova: '2026-12-13', banca: 'Cebraspe',
    plano: '200 questões/dia até 08/12, revisão 09–12/12.',
    tutor: 'VAMOS ESTUDAR PRA CGU',
    links: [['Guia CGU Auditoria', SITE + 'cgu_auditoria/'], ['Página do dia (questões de hoje)', SITE + 'cgu_auditoria/hoje/'],
            ['Tec · pasta CGU', TEC(7999984)], ['Guia CGU Ciência de Dados', SITE + 'cgu_ciencia_dados/']],
  },
  {
    id: 'tce', titulo: 'TCE-GO · Técnico Administrativo', icone: '⚖️', prova: '2027-01-17', banca: 'FCC',
    plano: '30 questões/dia de Conhecimentos Gerais até 13/12, depois 200/dia até 12/01.',
    aviso: 'Prova no mesmo dia da Câmara (17/01) — escolha uma das duas.',
    links: [['Guia TCE-GO', SITE + 'tce_go/'], ['Tec · pasta TCE-GO', TEC(8000126)]],
  },
  {
    id: 'camara', titulo: 'Câmara dos Deputados · Registro e Redação', icone: '🏛', prova: '2027-01-17', banca: 'Cebraspe',
    plano: 'Plano diário de questões do Tec Concursos.',
    aviso: 'Prova no mesmo dia do TCE-GO (17/01) — escolha uma das duas.',
    links: [['Guia Câmara', SITE + 'camara_deputados/'], ['Tec · pasta Câmara', TEC(8045547)]],
  },
  {
    id: 'sefaz', titulo: 'SEFAZ-DF · Auditor Fiscal', icone: '🧾', prova: null, banca: '',
    plano: 'Trilha de tarefas com páginas de estudo (teoria, questões e flashcards).',
    links: [['Índice da trilha SEFAZ-DF', SITE], ['Tela inicial (escolher trilha)', SITE + '?escolher']],
    secao: 'sefaz',
  },
  {
    id: 'ia', titulo: 'Engenharia de IA Aplicada', icone: '🤖', prova: null, banca: '',
    plano: '5 sessões de 1h/semana (3 até 17/01). Grades UNIPDS + MBA Full Cycle.',
    tutor: 'VAMOS ESTUDAR IA',
    links: [['Site da trilha', 'https://alexsborne.github.io/trilha-engenharia-ia/']],
    secao: 'ia',
  },
  {
    id: 'raiza', titulo: 'Raiza · TCE-GO Técnico Administrativo', icone: '👩‍🎓', prova: '2027-01-17', banca: 'FCC',
    plano: '100 questões/dia de 05/11 a 12/01 (Controle Externo, Dir. Administrativo e AFO); revisão 13–16/01. Ela precisa salvar os cadernos do guia TCE-GO 2026 do Tec na conta dela ("Salvar tudo").',
    links: [['Guia de questões da Raiza', 'https://alexsborne.github.io/tce_go_tec_adm/guia_questoes/'],
            ['Índice da trilha da Raiza', 'https://alexsborne.github.io/tce_go_tec_adm/'],
            ['Guia TCE-GO 2026 no Tec', 'https://www.tecconcursos.com.br/guias/tce-go-2026']],
  },
];

export function mergeGuias(painel) {
  const pega = id => {
    const i = painel.areas.findIndex(a => a.id === id);
    return i >= 0 ? painel.areas.splice(i, 1)[0] : null;
  };
  const sefaz = pega('sefaz');
  const ia = pega('ia');
  const antiga = pega('guias');

  // tira da aba Concursos os itens que eram só links de guia (agora ficam aqui)
  const conc = painel.areas.find(a => a.id === 'concursos');
  if (conc?.items) conc.items = conc.items.filter(i => !/^Guias de estudo/.test(i.title));

  const area = {
    id: 'guias', title: 'Guias de estudo', icon: '📖',
    summary: 'Todos os seus guias num lugar só: concursos (CGU, TCE-GO, Câmara, SEFAZ-DF), a trilha de Engenharia de IA e o guia da Raiza. Os dias até a prova são contados automaticamente.',
    guias: GUIAS,
    trilha: ia?.trilha || antiga?.trilha || null,
    sefaz: sefaz ? { summary: sefaz.summary, items: sefaz.items } : (antiga?.sefaz || null),
    items: [],
  };
  const c = painel.areas.findIndex(a => a.id === 'concursos');
  painel.areas.splice(c >= 0 ? c + 1 : 1, 0, area);
  return painel;
}
