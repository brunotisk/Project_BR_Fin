// O banco trabalha em America/Sao_Paulo para "datas de calendário" (coluna `date`)
// e guarda instantes absolutos em `timestamptz`. Estes helpers mantêm o app alinhado.

export const FUSO_PADRAO = 'America/Sao_Paulo'

/** Data de hoje no fuso de São Paulo, no formato YYYY-MM-DD (igual a public.hoje()). */
export function hojeISO(agora: Date = new Date()): string {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: FUSO_PADRAO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(agora)

  const valor = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? ''
  return `${valor('year')}-${valor('month')}-${valor('day')}`
}

/**
 * Formata uma coluna `date` (YYYY-MM-DD) como DD/MM/AAAA.
 * Não usa `new Date()` de propósito: "2026-10-03" vira meia-noite UTC e, em fusos
 * negativos como o do Brasil, apareceria como dia 02.
 */
export function formatarData(dataISO: string): string {
  const [ano, mes, dia] = dataISO.slice(0, 10).split('-')
  return `${dia}/${mes}/${ano}`
}

/** Formata um `timestamptz` (ISO) em horário de São Paulo, ex.: 03/10/2026 14:30. */
export function formatarDataHora(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO_PADRAO,
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(iso))
}
