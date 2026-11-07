import { supabase } from './supabase'
import { CartaoControleItem, FechamentoMensal, LancamentoPoker } from '../types'

// Dados iniciais baseados nas planilhas reais fornecidas pelo usuário
export const FECHAMENTOS_INICIAIS_MAP: Record<string, FechamentoMensal> = {
  'Outubro': {
    id: 'fechamento-outubro',
    mes_ano: 'Outubro',
    valor_cartoes: 32590,
    valor_contas: 1000,
    valor_dinheiro: 1350,
    valor_pix: 2000,
    valor_conta_corrente: 1000,
    valor_salario: 0,
    valor_necessario: 29240
  },
  'Novembro': {
    id: 'fechamento-novembro',
    mes_ano: 'Novembro',
    valor_cartoes: 36380,
    valor_contas: 1200,
    valor_dinheiro: 1500,
    valor_pix: 2500,
    valor_conta_corrente: 2000,
    valor_salario: 0,
    valor_necessario: 31580
  }
}

export const FECHAMENTO_INICIAL: FechamentoMensal = FECHAMENTOS_INICIAIS_MAP['Outubro']

export const CARTOES_VIGENTES_INICIAIS: CartaoControleItem[] = [
  {
    id: 'cv-1',
    mes_referencia: 'Outubro',
    tabela_tipo: 'vigente',
    cartao_nome: 'Nubank',
    valor: 9880,
    fechamento: '29/out',
    pagamento: '05/nov',
    atualizado_em_texto: '30/out',
    ordem: 1
  },
  {
    id: 'cv-2',
    mes_referencia: 'Outubro',
    tabela_tipo: 'vigente',
    cartao_nome: 'Picpay',
    valor: 0,
    fechamento: '',
    pagamento: '',
    atualizado_em_texto: '30/out',
    ordem: 2
  },
  {
    id: 'cv-3',
    mes_referencia: 'Outubro',
    tabela_tipo: 'vigente',
    cartao_nome: 'BTG',
    valor: 22710,
    fechamento: '02/nov',
    pagamento: '05/nov',
    atualizado_em_texto: '30/out',
    ordem: 3
  }
]

export const CARTOES_DETALHADOS_INICIAIS: CartaoControleItem[] = [
  {
    id: 'cd-1',
    mes_referencia: 'Outubro',
    tabela_tipo: 'detalhado_ma',
    cartao_nome: 'Nubank',
    valor: 8900,
    valor_ma: 6275,
    valor_sem_ma: 2625,
    fechamento: '',
    pagamento: '',
    ordem: 1
  },
  {
    id: 'cd-2',
    mes_referencia: 'Outubro',
    tabela_tipo: 'detalhado_ma',
    cartao_nome: 'Picpay',
    valor: 23180,
    valor_ma: 21825,
    valor_sem_ma: 1355,
    fechamento: '',
    pagamento: '',
    ordem: 2
  },
  {
    id: 'cd-3',
    mes_referencia: 'Outubro',
    tabela_tipo: 'detalhado_ma',
    cartao_nome: 'BTG',
    valor: 4300,
    valor_ma: 0,
    valor_sem_ma: 4300,
    fechamento: '',
    pagamento: '',
    ordem: 3
  }
]

// Lançamentos fiéis à nova imagem fornecida (31/out, 30/out, somando 37.325,00 e 1.325,05 de taxas)
export const LANCAMENTOS_POKER_INICIAIS: LancamentoPoker[] = [
  // Sessão 31/out (BuyIN: 9.225, Taxa: 225, CASHout: 14.655, NET: 5.205)
  { id: 'p-1', mes_base: 'Novembro', data_cartao: '31/out', cartao_nome: '', local: 'MonteCarlo', valor: 1500, taxa: 0, ordem: 1 },
  { id: 'p-2', mes_base: 'Novembro', data_cartao: '31/out', cartao_nome: '', local: 'MonteCarlo', valor: 3000, taxa: 0, ordem: 2 },
  { id: 'p-3', mes_base: 'Novembro', data_cartao: '31/out', cartao_nome: '', local: 'H2', valor: 3150, taxa: 150, ordem: 3 },
  { id: 'p-4', mes_base: 'Novembro', data_cartao: '31/out', cartao_nome: '', local: 'H2', valor: 1575, taxa: 75, ordem: 4 },

  // Sessão 30/out Nubank (BuyIN: 6.275, Taxa: 275, CASHout: 2.000, NET: -4.550)
  { id: 'p-5', mes_base: 'Novembro', data_cartao: '30/out', cartao_nome: 'Nubank', local: 'MonteCarlo', valor: 500, taxa: 0, ordem: 5 },
  { id: 'p-6', mes_base: 'Novembro', data_cartao: '30/out', cartao_nome: 'Nubank', local: 'H2', valor: 210, taxa: 10, ordem: 6 },
  { id: 'p-7', mes_base: 'Novembro', data_cartao: '30/out', cartao_nome: 'Nubank', local: 'H2', valor: 525, taxa: 25, ordem: 7 },
  { id: 'p-8', mes_base: 'Novembro', data_cartao: '30/out', cartao_nome: 'Nubank', local: 'H2', valor: 315, taxa: 15, ordem: 8 },
  { id: 'p-9', mes_base: 'Novembro', data_cartao: '30/out', cartao_nome: 'Nubank', local: 'H2', valor: 1575, taxa: 75, ordem: 9 },
  { id: 'p-10', mes_base: 'Novembro', data_cartao: '30/out', cartao_nome: 'Nubank', local: 'H2', valor: 420, taxa: 20, ordem: 10 },
  { id: 'p-11', mes_base: 'Novembro', data_cartao: '30/out', cartao_nome: 'Nubank', local: 'H2', valor: 525, taxa: 25, ordem: 11 },
  { id: 'p-12', mes_base: 'Novembro', data_cartao: '30/out', cartao_nome: 'Nubank', local: 'H2', valor: 525, taxa: 25, ordem: 12 },
  { id: 'p-13', mes_base: 'Novembro', data_cartao: '30/out', cartao_nome: 'Nubank', local: 'H2', valor: 1680, taxa: 80, ordem: 13 },

  // Sessão PicPay 28/out (BuyIN: 21.825, Taxa: 825.05) -> Total Geral: 37.325,00 e 1.325,05
  { id: 'p-14', mes_base: 'Novembro', data_cartao: '28/out', cartao_nome: 'PicPay', local: 'H2', valor: 420, taxa: 20, ordem: 14 },
  { id: 'p-15', mes_base: 'Novembro', data_cartao: '28/out', cartao_nome: 'PicPay', local: 'H2', valor: 525, taxa: 25, ordem: 15 },
  { id: 'p-16', mes_base: 'Novembro', data_cartao: '28/out', cartao_nome: 'PicPay', local: 'H2', valor: 1050, taxa: 50, ordem: 16 },
  { id: 'p-17', mes_base: 'Novembro', data_cartao: '28/out', cartao_nome: 'PicPay', local: 'H2', valor: 315, taxa: 15, ordem: 17 },
  { id: 'p-18', mes_base: 'Novembro', data_cartao: '28/out', cartao_nome: 'PicPay', local: 'H2', valor: 1575, taxa: 75, ordem: 18 },
  { id: 'p-19', mes_base: 'Novembro', data_cartao: '28/out', cartao_nome: 'PicPay', local: 'H2', valor: 1575, taxa: 75, ordem: 19 },
  { id: 'p-20', mes_base: 'Novembro', data_cartao: '28/out', cartao_nome: 'PicPay', local: 'H2', valor: 945, taxa: 45, ordem: 20 },
  { id: 'p-21', mes_base: 'Novembro', data_cartao: '28/out', cartao_nome: 'PicPay', local: 'H2', valor: 5250, taxa: 250, ordem: 21 },
  { id: 'p-22', mes_base: 'Novembro', data_cartao: '28/out', cartao_nome: 'PicPay', local: 'H2', valor: 5250, taxa: 250, ordem: 22 },
  { id: 'p-23', mes_base: 'Novembro', data_cartao: '28/out', cartao_nome: 'PicPay', local: 'H2', valor: 4920, taxa: 20.05, ordem: 23 }
]

export type CashoutPorLocal = Record<string, number>
export type CashoutsPokerMap = Record<string, CashoutPorLocal>
export type SessaoPoker = { id: string; mes_base: string; data_cartao: string; locais: string[]; criado_em?: string }

export const CASHOUTS_INICIAIS: CashoutsPokerMap = {
  '31/out': {
    'MonteCarlo': 0,
    'H2': 14655
  },
  '30/out': {
    'MonteCarlo': 0,
    'H2': 2000
  },
  '28/out': {
    'H2': 0
  }
}

export const LOCAIS_PADRAO = ['MonteCarlo', 'H2']
export const CARTOES_PADRAO = ['Nubank', 'PicPay', 'BTG']

const UUID_POKER = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function gerarUuidPoker() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (caractere) => {
    const valor = Math.floor(Math.random() * 16)
    return (caractere === 'x' ? valor : (valor & 0x3) | 0x8).toString(16)
  })
}

const STORAGE_KEYS = {
  FECHAMENTO_PREFIX: '@fin_fechamento_',
  CARTOES_PREFIX: '@fin_cartoes_controle_',
  LANCAMENTOS: '@fin_poker_lancamentos',
  SESSOES_POKER: '@fin_poker_sessoes',
  CASHOUTS: '@fin_poker_cashouts',
  DIAS_POKER_BLOQUEADOS: '@fin_poker_dias_bloqueados',
  TAXA_PADRAO: '@fin_poker_taxa_padrao',
  LOCAIS: '@fin_poker_locais',
  MES_SELECIONADO: '@fin_mes_fechamento_selecionado'
}

function getLocalItem<T>(key: string, defaultValue: T): T {
  try {
    if (typeof localStorage !== 'undefined') {
      const data = localStorage.getItem(key)
      if (data) return JSON.parse(data)
    }
  } catch (err) {
    console.warn(`Erro ao ler ${key} local:`, err)
  }
  return defaultValue
}

function setLocalItem<T>(key: string, value: T): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(value))
    }
  } catch (err) {
    console.warn(`Erro ao salvar ${key} local:`, err)
  }
}

// ==========================================
// MÊS SELECIONADO GLOBAL
// ==========================================

export function carregarMesFechamentoSelecionado(): string {
  return getLocalItem(STORAGE_KEYS.MES_SELECIONADO, 'Outubro')
}

export function salvarMesFechamentoSelecionado(mes: string): void {
  setLocalItem(STORAGE_KEYS.MES_SELECIONADO, mes)
}

// ==========================================
// 1. FECHAMENTO MENSAL (POR MÊS)
// ==========================================

export async function carregarFechamento(mes: string): Promise<FechamentoMensal> {
  const mesFormatado = mes.trim()

  try {
    const { data, error } = await (supabase as any)
      .from('fechamentos_mensais')
      .select('*')
      .ilike('mes_ano', `%${mesFormatado}%`)
      .maybeSingle()

    if (!error && data) {
      setLocalItem(`${STORAGE_KEYS.FECHAMENTO_PREFIX}${mesFormatado}`, data)
      return data as FechamentoMensal
    }
  } catch (err) {
    console.warn('Fallback local para Fechamento:', err)
  }

  const local = getLocalItem<FechamentoMensal | null>(
    `${STORAGE_KEYS.FECHAMENTO_PREFIX}${mesFormatado}`,
    null
  )
  if (local) return local

  if (FECHAMENTOS_INICIAIS_MAP[mesFormatado]) {
    return FECHAMENTOS_INICIAIS_MAP[mesFormatado]
  }

  return {
    id: `fechamento-${mesFormatado.toLowerCase()}`,
    mes_ano: mesFormatado,
    valor_cartoes: 0,
    valor_contas: 0,
    valor_dinheiro: 0,
    valor_pix: 0,
    valor_conta_corrente: 0,
    valor_salario: 0,
    valor_necessario: 0
  }
}

export async function salvarFechamento(fechamento: FechamentoMensal): Promise<void> {
  setLocalItem(`${STORAGE_KEYS.FECHAMENTO_PREFIX}${fechamento.mes_ano}`, fechamento)

  try {
    const { data: userData } = await supabase.auth.getUser()
    const usuarioId = userData?.user?.id

    if (usuarioId) {
      await (supabase as any).from('fechamentos_mensais').upsert(
        {
          mes_ano: fechamento.mes_ano,
          usuario_id: usuarioId,
          valor_cartoes: fechamento.valor_cartoes,
          valor_contas: fechamento.valor_contas,
          valor_dinheiro: fechamento.valor_dinheiro,
          valor_pix: fechamento.valor_pix,
          valor_conta_corrente: fechamento.valor_conta_corrente,
          valor_salario: fechamento.valor_salario,
          valor_necessario: fechamento.valor_necessario,
          observacao: fechamento.observacao || null
        },
        { onConflict: 'usuario_id, mes_ano' }
      )
    }
  } catch (err) {
    console.warn('Erro ao sincronizar fechamento no Supabase (mantido local):', err)
  }
}

// ==========================================
// 2. CONTROLE DE CARTÕES (POR MÊS)
// ==========================================

export async function carregarCartoesControle(mes: string): Promise<{
  vigentes: CartaoControleItem[]
  detalhados: CartaoControleItem[]
}> {
  const mesFormatado = mes.trim()

  try {
    const { data, error } = await (supabase as any)
      .from('cartoes_controle_ma')
      .select('*')
      .ilike('mes_referencia', `%${mesFormatado}%`)
      .order('ordem', { ascending: true })

    if (!error && data && data.length > 0) {
      const vigentes = data.filter((c: CartaoControleItem) => c.tabela_tipo === 'vigente')
      const detalhados = data.filter((c: CartaoControleItem) => c.tabela_tipo === 'detalhado_ma')
      setLocalItem(`${STORAGE_KEYS.CARTOES_PREFIX}${mesFormatado}`, data)
      return { vigentes, detalhados }
    }
  } catch (err) {
    console.warn('Fallback local para Cartões:', err)
  }

  const local = getLocalItem<CartaoControleItem[] | null>(
    `${STORAGE_KEYS.CARTOES_PREFIX}${mesFormatado}`,
    null
  )
  if (local && local.length > 0) {
    const vigentes = local.filter((c) => c.tabela_tipo === 'vigente')
    const detalhados = local.filter((c) => c.tabela_tipo === 'detalhado_ma')
    return { vigentes, detalhados }
  }

  if (mesFormatado === 'Outubro') {
    return {
      vigentes: CARTOES_VIGENTES_INICIAIS,
      detalhados: CARTOES_DETALHADOS_INICIAIS
    }
  }

  return { vigentes: [], detalhados: [] }
}

export async function salvarCartoesControle(
  itens: CartaoControleItem[],
  mes: string
): Promise<void> {
  const mesFormatado = mes.trim()
  setLocalItem(`${STORAGE_KEYS.CARTOES_PREFIX}${mesFormatado}`, itens)

  try {
    const { data: userData } = await supabase.auth.getUser()
    const usuarioId = userData?.user?.id

    if (usuarioId) {
      const records = itens.map((item, index) => ({
        ...item,
        mes_referencia: mesFormatado,
        usuario_id: usuarioId,
        ordem: index
      }))
      await (supabase as any).from('cartoes_controle_ma').upsert(records)
    }
  } catch (err) {
    console.warn('Erro ao salvar cartões no Supabase (mantido local):', err)
  }
}

// ==========================================
// 3. POKER (LANÇAMENTOS, CASHOUT, TAXA % E CADASTROS)
// ==========================================

export async function carregarLancamentosPoker(mesBase?: string): Promise<LancamentoPoker[]> {
  try {
    let query = (supabase as any)
      .from('lancamentos_ma')
      .select('*')
      .order('ordem', { ascending: true })
    if (mesBase && mesBase !== 'Todos') {
      query = query.ilike('mes_base', `%${mesBase}%`)
    }
    const { data, error } = await query

    if (!error && data && data.length > 0) {
      const locais = getLocalItem<LancamentoPoker[] | null>(STORAGE_KEYS.LANCAMENTOS, null) || []
      const idsRemotos = new Set((data as LancamentoPoker[]).map((item) => item.id))
      const itensLocaisPendentes = locais
        .filter((item) => !UUID_POKER.test(item.id) || !idsRemotos.has(item.id))
        .map((item) => UUID_POKER.test(item.id) ? item : { ...item, id: gerarUuidPoker() })
      const mesclados = [...data as LancamentoPoker[], ...itensLocaisPendentes]
      if (itensLocaisPendentes.length > 0) {
        return await salvarLancamentosPoker(mesclados)
      }
      setLocalItem(STORAGE_KEYS.LANCAMENTOS, mesclados)
      return mesclados
    }
  } catch (err) {
    console.warn('Fallback local para Poker Lançamentos:', err)
  }

  const local = getLocalItem<LancamentoPoker[] | null>(STORAGE_KEYS.LANCAMENTOS, null)
  if (local && local.length > 0) {
    return mesBase && mesBase !== 'Todos'
      ? local.filter((item) => item.mes_base.toLowerCase() === mesBase.toLowerCase())
      : local
  }

  return mesBase && mesBase !== 'Todos'
    ? LANCAMENTOS_POKER_INICIAIS.filter((item) => item.mes_base.toLowerCase() === mesBase.toLowerCase())
    : LANCAMENTOS_POKER_INICIAIS
}

export async function salvarLancamentosPoker(itens: LancamentoPoker[]): Promise<LancamentoPoker[]> {
  const registrosNormalizados = itens.map((item) => UUID_POKER.test(item.id) ? item : { ...item, id: gerarUuidPoker() })
  setLocalItem(STORAGE_KEYS.LANCAMENTOS, registrosNormalizados)

  try {
    const { data: userData } = await supabase.auth.getUser()
    const usuarioId = userData?.user?.id

    if (usuarioId) {
      const records = registrosNormalizados.map((item, index) => ({
        ...item,
        usuario_id: usuarioId,
        ordem: item.ordem ?? index
      }))
      if (records.length > 0) {
        const { error } = await (supabase as any).from('lancamentos_ma').upsert(records)
        if (error) throw error
      }
    }
  } catch (err) {
    console.warn('Erro ao salvar lançamentos poker no Supabase (mantido local):', err)
  }
  return registrosNormalizados
}

export async function carregarDiasPokerBloqueados(): Promise<Record<string, boolean>> {
  const local = getLocalItem<Record<string, boolean>>(STORAGE_KEYS.DIAS_POKER_BLOQUEADOS, {})
  try {
    const { data, error } = await (supabase as any).from('poker_dias_bloqueados').select('data_cartao').eq('travado', true)
    if (error) throw error
    const bloqueados = Object.fromEntries((data || []).map((item: { data_cartao: string }) => [item.data_cartao, true]))
    setLocalItem(STORAGE_KEYS.DIAS_POKER_BLOQUEADOS, bloqueados)
    return bloqueados
  } catch (err) {
    console.warn('Não foi possível carregar os dias de Poker bloqueados:', err)
    return local
  }
}

export async function definirDiaPokerBloqueado(dataCartao: string, travado: boolean): Promise<void> {
  const { data: userData } = await supabase.auth.getUser()
  const usuarioId = userData?.user?.id
  if (usuarioId) {
    const { error } = await (supabase as any).from('poker_dias_bloqueados').upsert(
      { usuario_id: usuarioId, data_cartao: dataCartao, travado },
      { onConflict: 'usuario_id,data_cartao' }
    )
    if (error) throw error
  }
  const local = getLocalItem<Record<string, boolean>>(STORAGE_KEYS.DIAS_POKER_BLOQUEADOS, {})
  if (travado) local[dataCartao] = true
  else delete local[dataCartao]
  setLocalItem(STORAGE_KEYS.DIAS_POKER_BLOQUEADOS, local)
}

export async function excluirLancamentoPoker(id: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser()
  const usuarioId = userData?.user?.id
  if (usuarioId) {
    if (!UUID_POKER.test(id)) {
      throw new Error('Este lançamento ainda não possui um ID válido no banco. Atualize a tela e tente novamente.')
    }
    const { data, error } = await (supabase as any)
      .from('lancamentos_ma')
      .delete()
      .eq('id', id)
      .eq('usuario_id', usuarioId)
      .select('id')
    if (error) throw error
    if (!data?.some((linha: { id: string }) => linha.id === id)) {
      throw new Error('O Supabase não confirmou a exclusão deste lançamento. Atualize a tela e tente novamente.')
    }
  }
  const local = getLocalItem<LancamentoPoker[]>(STORAGE_KEYS.LANCAMENTOS, LANCAMENTOS_POKER_INICIAIS)
  setLocalItem(STORAGE_KEYS.LANCAMENTOS, local.filter((item) => item.id !== id))
}

export async function excluirSessaoPoker(dataCartao: string, mesBase: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser()
  const usuarioId = userData?.user?.id
  if (usuarioId) {
    const { error } = await (supabase as any).rpc('excluir_sessao_poker', { p_mes_base: mesBase, p_data_cartao: dataCartao })
    if (error) throw error
  }
  const lancamentos = getLocalItem<LancamentoPoker[]>(STORAGE_KEYS.LANCAMENTOS, LANCAMENTOS_POKER_INICIAIS)
  const lancamentosRestantes = lancamentos.filter((item) => item.data_cartao !== dataCartao || item.mes_base !== mesBase)
  setLocalItem(STORAGE_KEYS.LANCAMENTOS, lancamentosRestantes)
  const sessoes = getLocalItem<SessaoPoker[]>(STORAGE_KEYS.SESSOES_POKER, [])
  const sessoesRestantes = sessoes.filter((sessao) => sessao.data_cartao !== dataCartao || sessao.mes_base !== mesBase)
  setLocalItem(STORAGE_KEYS.SESSOES_POKER, sessoesRestantes)
  const cashouts = carregarCashoutsPoker()
  if (!lancamentosRestantes.some((item) => item.data_cartao === dataCartao) && !sessoesRestantes.some((sessao) => sessao.data_cartao === dataCartao)) delete cashouts[dataCartao]
  setLocalItem(STORAGE_KEYS.CASHOUTS, cashouts)
}

export async function carregarSessoesPoker(): Promise<SessaoPoker[]> {
  const locais = getLocalItem<SessaoPoker[]>(STORAGE_KEYS.SESSOES_POKER, [])
  try {
    const { data, error } = await (supabase as any).from('poker_sessoes').select('id, mes_base, data_cartao, locais, criado_em')
    if (error) throw error
    const remotas = (data || []) as SessaoPoker[]
    const mapa = new Map(remotas.map((sessao) => [`${sessao.mes_base}|${sessao.data_cartao}`, sessao]))
    locais.forEach((sessao) => { if (!mapa.has(`${sessao.mes_base}|${sessao.data_cartao}`)) mapa.set(`${sessao.mes_base}|${sessao.data_cartao}`, sessao) })
    const resultado = Array.from(mapa.values())
    setLocalItem(STORAGE_KEYS.SESSOES_POKER, resultado)
    return resultado
  } catch (err) {
    console.warn('Não foi possível carregar as sessões de Poker:', err)
    return locais
  }
}

export async function salvarSessaoPoker(mesBase: string, dataCartao: string, local: string): Promise<SessaoPoker> {
  const { data: userData } = await supabase.auth.getUser()
  let id = gerarUuidPoker()
  if (userData?.user?.id) {
    const { data, error } = await (supabase as any).rpc('salvar_sessao_poker', { p_mes_base: mesBase, p_data_cartao: dataCartao, p_local: local })
    if (error) throw error
    id = data as string
  }
  const sessoes = getLocalItem<SessaoPoker[]>(STORAGE_KEYS.SESSOES_POKER, [])
  const indice = sessoes.findIndex((sessao) => sessao.mes_base === mesBase && sessao.data_cartao === dataCartao)
  const anterior = indice >= 0 ? sessoes[indice] : null
  const sessao: SessaoPoker = {
    id: userData?.user?.id ? id : anterior?.id || id,
    mes_base: mesBase,
    data_cartao: dataCartao,
    locais: Array.from(new Set([...(anterior?.locais || []), local])),
    ...(anterior?.criado_em ? { criado_em: anterior.criado_em } : {})
  }
  const atualizadas = indice >= 0 ? sessoes.map((item, i) => i === indice ? sessao : item) : [...sessoes, sessao]
  setLocalItem(STORAGE_KEYS.SESSOES_POKER, atualizadas)
  return sessao
}

export async function excluirLocalSessaoPoker(mesBase: string, dataCartao: string, local: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser()
  if (userData?.user?.id) {
    const { error } = await (supabase as any).rpc('excluir_local_sessao_poker', {
      p_mes_base: mesBase, p_data_cartao: dataCartao, p_local: local
    })
    if (error) throw error
  }
  const lancamentos = getLocalItem<LancamentoPoker[]>(STORAGE_KEYS.LANCAMENTOS, LANCAMENTOS_POKER_INICIAIS)
  setLocalItem(STORAGE_KEYS.LANCAMENTOS, lancamentos.filter((item) => item.data_cartao !== dataCartao || item.mes_base !== mesBase || item.local !== local))
  const sessoes = getLocalItem<SessaoPoker[]>(STORAGE_KEYS.SESSOES_POKER, [])
  setLocalItem(STORAGE_KEYS.SESSOES_POKER, sessoes.map((sessao) => sessao.data_cartao === dataCartao && sessao.mes_base === mesBase
    ? { ...sessao, locais: sessao.locais.filter((nome) => nome !== local) }
    : sessao))
  const cashouts = carregarCashoutsPoker()
  if (cashouts[dataCartao]) {
    const restantes = { ...cashouts[dataCartao] }
    delete restantes[local]
    cashouts[dataCartao] = restantes
    await salvarCashoutsDaSessao(dataCartao, restantes, mesBase)
  }
}

export function carregarCashoutsPoker(): CashoutsPokerMap {
  const raw = getLocalItem<any>(STORAGE_KEYS.CASHOUTS, CASHOUTS_INICIAIS)
  const result: CashoutsPokerMap = {}
  for (const [dataKey, val] of Object.entries(raw || {})) {
    if (typeof val === 'number') {
      result[dataKey] = { 'Total': val }
    } else if (typeof val === 'object' && val !== null) {
      result[dataKey] = val as CashoutPorLocal
    }
  }
  return Object.keys(result).length > 0 ? result : CASHOUTS_INICIAIS
}

export function obterTotalCashoutSessao(cashoutsDaSessao?: CashoutPorLocal): number {
  if (!cashoutsDaSessao) return 0
  return Object.values(cashoutsDaSessao).reduce((acc, v) => acc + (Number(v) || 0), 0)
}

export async function salvarCashoutsDaSessao(
  dataCartao: string,
  valoresPorLocal: CashoutPorLocal,
  mesBase = 'Novembro'
): Promise<void> {
  const atuais = carregarCashoutsPoker()
  atuais[dataCartao] = valoresPorLocal
  setLocalItem(STORAGE_KEYS.CASHOUTS, atuais)

  const total = obterTotalCashoutSessao(valoresPorLocal)

  try {
    const { data: userData } = await supabase.auth.getUser()
    const usuarioId = userData?.user?.id

    if (usuarioId) {
      await (supabase as any).from('poker_sessoes_cashout').upsert(
        {
          usuario_id: usuarioId,
          mes_base: mesBase,
          data_cartao: dataCartao,
          cashout: total
        },
        { onConflict: 'usuario_id, mes_base, data_cartao' }
      )
    }
  } catch (err) {
    console.warn('Erro ao salvar cashout no Supabase (mantido local):', err)
  }
}

export async function salvarCashoutPoker(dataCartao: string, valor: number, mesBase = 'Novembro'): Promise<void> {
  await salvarCashoutsDaSessao(dataCartao, { Total: valor }, mesBase)
}

export function carregarTaxaPadraoPoker(): number {
  return getLocalItem<number>(STORAGE_KEYS.TAXA_PADRAO, 5) // 5% por padrão da imagem
}

export function salvarTaxaPadraoPoker(taxa: number): void {
  setLocalItem(STORAGE_KEYS.TAXA_PADRAO, taxa)
}

export function carregarLocaisPoker(): string[] {
  return getLocalItem<string[]>(STORAGE_KEYS.LOCAIS, LOCAIS_PADRAO)
}

export function salvarLocaisPoker(locais: string[]): void {
  setLocalItem(STORAGE_KEYS.LOCAIS, locais)
}

// Aliases para retrocompatibilidade
export const carregarLancamentosMA = carregarLancamentosPoker
export const salvarLancamentosMA = salvarLancamentosPoker
export const LANCAMENTOS_INICIAIS = LANCAMENTOS_POKER_INICIAIS

