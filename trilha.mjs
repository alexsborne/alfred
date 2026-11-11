// Lê o resumo da Trilha Engenheiro de IA (../trilha_engenharia_ia/resumo.json, gerado pelo build de lá)
// e monta a aba "Engenharia de IA" do painel. O progresso (sessões marcadas) é lido no navegador,
// do localStorage 'trilha-ia-done' — mesmo domínio alexsborne.github.io, então é compartilhado.
import { readFileSync, existsSync } from 'node:fs';

export const TRILHA_RESUMO = 'C:/Users/alexandre.lopes/OneDrive/trilha_engenharia_ia/resumo.json';

export function mergeTrilha(painel) {
  if (!existsSync(TRILHA_RESUMO)) return painel;
  const r = JSON.parse(readFileSync(TRILHA_RESUMO, 'utf8'));
  const area = {
    id: 'ia', title: 'Engenharia de IA', icon: '🤖',
    summary: `Trilha de ${r.calendario.filter(c => !c.pausa).length} semanas (${r.totalSessoes} sessões de 1h) baseada nas grades da UNIPDS e do MBA Full Cycle. Marque as sessões no site da trilha — o progresso aparece aqui. Para estudar com tutor: digite VAMOS ESTUDAR IA no Claude Code.`,
    trilha: r,
    items: [],
  };
  const i = painel.areas.findIndex(a => a.id === 'ia');
  if (i >= 0) painel.areas[i] = { ...painel.areas[i], ...area, items: painel.areas[i].items || [] };
  else painel.areas.splice(Math.max(1, painel.areas.findIndex(a => a.id === 'sefaz') + 1), 0, area);
  return painel;
}
