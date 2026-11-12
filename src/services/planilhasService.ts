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
export type FotoPoker = { id: string; usuario_id: string; mes_base: string; data_cartao: string; local: string; nome_arquivo: string; tipo_mime: string; storage_path: string; criado_em: string; url: string }
export type LocalPokerConfig = { nome: string; cor: string; storage_path?: string; aliases?: string[]; fotoUrl?: string }

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
  FORMATO_NEGATIVO_POKER: '@fin_poker_formato_negativo',
  LOCAIS: '@fin_poker_locais',
  LOCAIS_CONFIG: '@fin_poker_locais_config',
  CARTOES_POKER: '@fin_poker_cartoes',
  MES_SELECIONADO: '@fin_mes_fechamento_selecionado',
  CARTOES_MES_SELECIONADO: '@fin_mes_cartoes_controle_selecionado'
}

const CHAVE_MES_SIMULADOR_CAIXA = 'simulador-cartoes'
const CHAVE_LOCAL_SIMULADOR_CAIXA = '@fin_simulador_cartoes'

export type DadosSimuladorCaixa = {
  valor_cartoes: number
  valor_contas: number
  valor_dinheiro: number
  valor_pix: number
  valor_conta_corrente: number
  valor_salario: number
  valor_necessario: number
  cartoes_selecionados: string[]
}

const SIMULADOR_CAIXA_VAZIO: DadosSimuladorCaixa = {
  valor_cartoes: 0,
  valor_contas: 0,
  valor_dinheiro: 0,
  valor_pix: 0,
  valor_conta_corrente: 0,
  valor_salario: 0,
  valor_necessario: 0,
  cartoes_selecionados: []
}

export function limparCacheDadosRemotos(): void {
  if (typeof localStorage === 'undefined') return
  const prefixosRemotos = [
    STORAGE_KEYS.FECHAMENTO_PREFIX,
    CHAVE_LOCAL_SIMULADOR_CAIXA,
    STORAGE_KEYS.CARTOES_PREFIX,
    STORAGE_KEYS.LANCAMENTOS,
    STORAGE_KEYS.SESSOES_POKER,
    STORAGE_KEYS.DIAS_POKER_BLOQUEADOS
  ]
  const chaves = Array.from({ length: localStorage.length }, (_, indice) => localStorage.key(indice)).filter((chave): chave is string => Boolean(chave))
  chaves.filter((chave) => prefixosRemotos.some((prefixo) => chave.startsWith(prefixo))).forEach((chave) => localStorage.removeItem(chave))
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

export function carregarMesCartoesControleSelecionado(): string {
  return getLocalItem(STORAGE_KEYS.CARTOES_MES_SELECIONADO, '')
}

export function salvarMesCartoesControleSelecionado(mes: string): void {
  setLocalItem(STORAGE_KEYS.CARTOES_MES_SELECIONADO, mes)
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

export async function carregarSimuladorCaixa(): Promise<DadosSimuladorCaixa> {
  const { data: userData, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  const usuarioId = userData?.user?.id

  if (usuarioId) {
    const { data, error } = await (supabase as any)
      .from('fechamentos_mensais')
      .select('*')
      .eq('usuario_id', usuarioId)
      .eq('mes_ano', CHAVE_MES_SIMULADOR_CAIXA)
      .maybeSingle()
    if (error) throw error
    if (data) {
      let cartoesSelecionados: string[] = []
      try {
        const metadados = JSON.parse(data.observacao || '{}')
        if (Array.isArray(metadados.cartoes_selecionados)) cartoesSelecionados = metadados.cartoes_selecionados
      } catch { /* Registro antigo sem configuração do seletor. */ }
      const simulador: DadosSimuladorCaixa = {
        valor_cartoes: Number(data.valor_cartoes) || 0,
        valor_contas: Number(data.valor_contas) || 0,
        valor_dinheiro: Number(data.valor_dinheiro) || 0,
        valor_pix: Number(data.valor_pix) || 0,
        valor_conta_corrente: Number(data.valor_conta_corrente) || 0,
        valor_salario: Number(data.valor_salario) || 0,
        valor_necessario: Number(data.valor_necessario) || 0,
        cartoes_selecionados: cartoesSelecionados
      }
      setLocalItem(CHAVE_LOCAL_SIMULADOR_CAIXA, simulador)
      return simulador
    }
  }

  return getLocalItem(CHAVE_LOCAL_SIMULADOR_CAIXA, SIMULADOR_CAIXA_VAZIO)
}

export async function salvarSimuladorCaixa(simulador: DadosSimuladorCaixa): Promise<void> {
  const { data: userData, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  const usuarioId = userData?.user?.id
  if (!usuarioId) throw new Error('Faça login para salvar o simulador no banco.')

  const { error } = await (supabase as any)
    .from('fechamentos_mensais')
    .upsert({
      usuario_id: usuarioId,
      mes_ano: CHAVE_MES_SIMULADOR_CAIXA,
      valor_cartoes: simulador.valor_cartoes,
      valor_contas: simulador.valor_contas,
      valor_dinheiro: simulador.valor_dinheiro,
      valor_pix: simulador.valor_pix,
      valor_conta_corrente: simulador.valor_conta_corrente,
      valor_salario: simulador.valor_salario,
      valor_necessario: simulador.valor_necessario,
      observacao: JSON.stringify({ cartoes_selecionados: simulador.cartoes_selecionados })
    }, { onConflict: 'usuario_id, mes_ano' })
  if (error) throw error

  setLocalItem(CHAVE_LOCAL_SIMULADOR_CAIXA, simulador)
}

// ==========================================
// 2. CONTROLE DE CARTÕES (POR MÊS)
// ==========================================

export async function carregarCartoesControle(mes: string): Promise<{
  vigentes: CartaoControleItem[]
  detalhados: CartaoControleItem[]
}> {
  const mesFormatado = mes.trim()
  const mesLegado = mesFormatado.replace(/\s+\d{4}$/, '')
  const chaveLocal = `${STORAGE_KEYS.CARTOES_PREFIX}${mesFormatado}`
  const localMes = getLocalItem<CartaoControleItem[] | null>(chaveLocal, null)

  try {
    let { data, error } = await (supabase as any)
      .from('cartoes_controle_ma')
      .select('*')
      .ilike('mes_referencia', `%${mesFormatado}%`)
      .order('ordem', { ascending: true })

    // Uma lista vazia salva localmente é um tombstone: o usuário apagou todos
    // os itens, então não devemos repor registros legados daquele mês.
    if (!error && (!data || data.length === 0) && localMes?.length === 0) {
      return { vigentes: [], detalhados: [] }
    }

    if (!error && (!data || data.length === 0) && mesLegado !== mesFormatado) {
      const legado = await (supabase as any)
        .from('cartoes_controle_ma')
        .select('*')
        .eq('mes_referencia', mesLegado)
        .order('ordem', { ascending: true })
      if (!legado.error && legado.data?.length) data = legado.data
    }

    if (!error && data && data.length > 0) {
      const vigentes = data.filter((c: CartaoControleItem) => c.tabela_tipo === 'vigente')
      const detalhados = data.filter((c: CartaoControleItem) => c.tabela_tipo === 'detalhado_ma')
      setLocalItem(chaveLocal, data)
      return { vigentes, detalhados }
    }
  } catch (err) {
    console.warn('Fallback local para Cartões:', err)
  }

  const localEncontrado = localMes !== null ? localMes : mesLegado !== mesFormatado
    ? getLocalItem<CartaoControleItem[] | null>(`${STORAGE_KEYS.CARTOES_PREFIX}${mesLegado}`, null)
    : null
  if (localEncontrado !== null) {
    const vigentes = localEncontrado.filter((c) => c.tabela_tipo === 'vigente')
    const detalhados = localEncontrado.filter((c) => c.tabela_tipo === 'detalhado_ma')
    return { vigentes, detalhados }
  }

  return { vigentes: [], detalhados: [] }
}

export async function salvarCartoesControle(
  itens: CartaoControleItem[],
  mes: string
): Promise<void> {
  const mesFormatado = mes.trim()
  const { data: userData, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  const usuarioId = userData?.user?.id
  if (!usuarioId) throw new Error('Faça login para sincronizar os cartões.')

  const records = itens.map((item, index) => {
    const { criado_em: _criadoEm, ...dados } = item
    return {
      ...dados,
      id: UUID_POKER.test(item.id) ? item.id : gerarUuidPoker(),
      mes_referencia: mesFormatado,
      usuario_id: usuarioId,
      ordem: index,
      // A tabela define esses valores como NOT NULL; registros vigentes e dados
      // legados podem não ter os campos de detalhamento preenchidos.
      valor: Number(item.valor) || 0,
      valor_ma: Number(item.valor_ma) || 0,
      valor_sem_ma: Number(item.valor_sem_ma) || 0
    }
  })

  if (records.length) {
    const { error } = await (supabase as any)
      .from('cartoes_controle_ma')
      .upsert(records, { onConflict: 'id' })
    if (error) throw error
  }

  const { error: remocaoError } = await (supabase as any)
    .from('cartoes_controle_ma')
    .delete()
    .eq('usuario_id', usuarioId)
    .eq('mes_referencia', mesFormatado)
    .not('id', 'in', `(${records.map((item) => item.id).join(',') || '00000000-0000-4000-8000-000000000000'})`)
  if (remocaoError) throw remocaoError

  // Dados anteriores à inclusão do ano eram salvos como "Outubro". Ao
  // excluir o último item de um mês, apague também essa chave legada para que
  // ela não volte a aparecer como fallback ao reabrir a tela.
  if (records.length === 0) {
    const mesLegado = mesFormatado.replace(/\s+\d{4}$/, '')
    if (mesLegado !== mesFormatado) {
      const { error } = await (supabase as any)
        .from('cartoes_controle_ma')
        .delete()
        .eq('usuario_id', usuarioId)
        .eq('mes_referencia', mesLegado)
      if (error) throw error
    }
  }

  setLocalItem(`${STORAGE_KEYS.CARTOES_PREFIX}${mesFormatado}`, records as CartaoControleItem[])
}

// ==========================================
// 3. POKER (LANÇAMENTOS, CASHOUT, TAXA % E CADASTROS)
// ==========================================

export async function carregarLancamentosPoker(mesBase?: string): Promise<LancamentoPoker[]> {
  const { data: userData } = await supabase.auth.getUser()
  const usuarioId = userData?.user?.id
  if (usuarioId) {
    let queryRemota = (supabase as any)
      .from('lancamentos_ma')
      .select('*')
      .order('ordem', { ascending: true })
    if (mesBase && mesBase !== 'Todos') queryRemota = queryRemota.ilike('mes_base', `%${mesBase}%`)
    const { data, error } = await queryRemota
    if (error) throw error
    const remotos = (data || []) as LancamentoPoker[]
    setLocalItem(STORAGE_KEYS.LANCAMENTOS, remotos)
    return remotos
  }

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

export async function salvarLancamentosPoker(itens: LancamentoPoker[], exigirConfirmacaoRemota = false): Promise<LancamentoPoker[]> {
  const registrosNormalizados = itens.map((item) => UUID_POKER.test(item.id) ? item : { ...item, id: gerarUuidPoker() })

  try {
    const { data: userData } = await supabase.auth.getUser()
    const usuarioId = userData?.user?.id

    if (usuarioId) {
      const records = registrosNormalizados.map((item, index) => {
        const agora = new Date().toISOString()
        return {
          ...item,
          usuario_id: usuarioId,
          ordem: item.ordem ?? index,
          criado_em: item.criado_em || agora,
          atualizado_em: (item as LancamentoPoker & { atualizado_em?: string | null }).atualizado_em || agora
        }
      })
      if (records.length > 0) {
        const { data, error } = await (supabase as any).from('lancamentos_ma').upsert(records).select('id')
        if (error) throw error
        if (exigirConfirmacaoRemota && (data?.length || 0) !== records.length) {
          throw new Error('O Supabase não confirmou o salvamento de todos os lançamentos.')
        }
      }
    }
    setLocalItem(STORAGE_KEYS.LANCAMENTOS, registrosNormalizados)
  } catch (err) {
    console.warn('Erro ao salvar lançamentos poker no Supabase (mantido local):', err)
    if (exigirConfirmacaoRemota) throw err
    setLocalItem(STORAGE_KEYS.LANCAMENTOS, registrosNormalizados)
  }
  return registrosNormalizados
}

export async function salvarLancamentoPoker(item: LancamentoPoker): Promise<LancamentoPoker> {
  const registro = UUID_POKER.test(item.id) ? item : { ...item, id: gerarUuidPoker() }
  const { data: userData } = await supabase.auth.getUser()
  const usuarioId = userData?.user?.id
  if (usuarioId) {
    const agora = new Date().toISOString()
    const { data, error } = await (supabase as any)
      .from('lancamentos_ma')
      .upsert({
        ...registro,
        usuario_id: usuarioId,
        criado_em: registro.criado_em || agora,
        atualizado_em: (registro as LancamentoPoker & { atualizado_em?: string | null }).atualizado_em || agora
      })
      .select('id')
    if (error) throw error
    if (!data?.some((linha: { id: string }) => linha.id === registro.id)) {
      throw new Error('O Supabase não confirmou o salvamento deste lançamento.')
    }
  }
  const locais = getLocalItem<LancamentoPoker[]>(STORAGE_KEYS.LANCAMENTOS, LANCAMENTOS_POKER_INICIAIS)
  setLocalItem(STORAGE_KEYS.LANCAMENTOS, locais.some((existente) => existente.id === registro.id)
    ? locais.map((existente) => existente.id === registro.id ? registro : existente)
    : [...locais, registro])
  return registro
}

export async function carregarDiasPokerBloqueados(): Promise<Record<string, boolean>> {
  const local = getLocalItem<Record<string, boolean>>(STORAGE_KEYS.DIAS_POKER_BLOQUEADOS, {})
  const { data: userData } = await supabase.auth.getUser()
  try {
    const { data, error } = await (supabase as any).from('poker_dias_bloqueados').select('data_cartao').eq('travado', true)
    if (error) throw error
    const bloqueados = Object.fromEntries((data || []).map((item: { data_cartao: string }) => [item.data_cartao, true]))
    setLocalItem(STORAGE_KEYS.DIAS_POKER_BLOQUEADOS, bloqueados)
    return bloqueados
  } catch (err) {
    console.warn('Não foi possível carregar os dias de Poker bloqueados:', err)
    if (userData?.user?.id) {
      setLocalItem(STORAGE_KEYS.DIAS_POKER_BLOQUEADOS, {})
      return {}
    }
    return local
  }
}

export async function definirDiaPokerBloqueado(dataCartao: string, travado: boolean): Promise<void> {
  const { data: userData } = await supabase.auth.getUser()
  const usuarioId = userData?.user?.id
  if (usuarioId) {
    const resposta = travado
      ? await (supabase as any).from('poker_dias_bloqueados').upsert(
          { usuario_id: usuarioId, data_cartao: dataCartao, travado: true },
          { onConflict: 'usuario_id,data_cartao' }
        )
      : await (supabase as any).from('poker_dias_bloqueados').delete().eq('usuario_id', usuarioId).eq('data_cartao', dataCartao).select('id')
    const { error } = resposta
    if (error) throw error
    if (!travado) {
      const { data: bloqueioRestante, error: erroVerificacao } = await (supabase as any)
        .from('poker_dias_bloqueados')
        .select('id')
        .eq('usuario_id', usuarioId)
        .eq('data_cartao', dataCartao)
        .eq('travado', true)
        .maybeSingle()
      if (erroVerificacao) throw erroVerificacao
      if (bloqueioRestante) throw new Error('O Supabase ainda mantém este dia travado. Atualize a tela e tente novamente.')
    }
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
  delete cashouts[chaveCashoutPoker(dataCartao, mesBase)]
  if (!lancamentosRestantes.some((item) => item.data_cartao === dataCartao) && !sessoesRestantes.some((sessao) => sessao.data_cartao === dataCartao)) {
    delete cashouts[dataCartao]
  }
  setLocalItem(STORAGE_KEYS.CASHOUTS, cashouts)
}

export async function carregarSessoesPoker(): Promise<SessaoPoker[]> {
  const { data: userData } = await supabase.auth.getUser()
  if (userData?.user?.id) {
    const { data, error } = await (supabase as any).from('poker_sessoes').select('id, mes_base, data_cartao, locais, criado_em')
    if (error) throw error
    const remotas = (data || []) as SessaoPoker[]
    setLocalItem(STORAGE_KEYS.SESSOES_POKER, remotas)
    return remotas
  }
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

export async function carregarFotosPoker(): Promise<FotoPoker[]> {
  const { data, error } = await (supabase as any)
    .from('poker_sessao_fotos')
    .select('id, usuario_id, mes_base, data_cartao, local, nome_arquivo, tipo_mime, storage_path, criado_em')
    .order('criado_em', { ascending: true })
  if (error) throw error
  const fotos = (data || []) as Omit<FotoPoker, 'url'>[]
  return Promise.all(fotos.map(async (foto) => {
    const { data: signed, error: signedError } = await supabase.storage.from('poker-fotos').createSignedUrl(foto.storage_path, 3600)
    if (signedError) throw signedError
    return { ...foto, url: signed.signedUrl }
  }))
}

export async function adicionarFotoPoker(args: {
  mesBase: string; dataCartao: string; local: string; nomeArquivo: string; tipoMime: string; uri: string; arquivoWeb?: Blob
}): Promise<FotoPoker> {
  const { data: userData } = await supabase.auth.getUser()
  const usuarioId = userData?.user?.id
  if (!usuarioId) throw new Error('Entre na sua conta para anexar fotos.')
  const id = gerarUuidPoker()
  const extensao = args.nomeArquivo.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'jpg'
  const caminho = `${usuarioId}/${id}.${extensao}`
  const metadata = {
    id,
    usuario_id: usuarioId,
    mes_base: args.mesBase,
    data_cartao: args.dataCartao,
    local: args.local,
    nome_arquivo: args.nomeArquivo,
    tipo_mime: args.tipoMime,
    storage_path: caminho
  }
  const { error: erroMetadata } = await (supabase as any).from('poker_sessao_fotos').insert(metadata)
  if (erroMetadata) throw erroMetadata
  try {
    const arquivo: Blob = args.arquivoWeb ?? await fetch(args.uri).then((resposta) => {
      if (!resposta.ok) throw new Error('Não foi possível ler a imagem selecionada.')
      return resposta.blob()
    })
    const { error: erroUpload } = await supabase.storage.from('poker-fotos').upload(caminho, arquivo, {
      contentType: args.tipoMime,
      upsert: false
    })
    if (erroUpload) throw erroUpload
    const { data: signed, error: signedError } = await supabase.storage.from('poker-fotos').createSignedUrl(caminho, 3600)
    if (signedError) throw signedError
    return { ...metadata, criado_em: new Date().toISOString(), url: signed.signedUrl }
  } catch (erro) {
    await (supabase as any).from('poker_sessao_fotos').delete().eq('id', id).eq('usuario_id', usuarioId)
    throw erro
  }
}

export async function excluirFotoPoker(foto: FotoPoker): Promise<void> {
  const { data: userData } = await supabase.auth.getUser()
  const usuarioId = userData?.user?.id
  if (!usuarioId) throw new Error('Entre na sua conta para excluir esta foto.')
  const { error: erroStorage } = await supabase.storage.from('poker-fotos').remove([foto.storage_path])
  if (erroStorage) throw erroStorage
  const { data, error } = await (supabase as any)
    .from('poker_sessao_fotos')
    .delete()
    .eq('id', foto.id)
    .eq('usuario_id', usuarioId)
    .select('id')
  if (error) throw error
  if (!data?.some((linha: { id: string }) => linha.id === foto.id)) {
    throw new Error('O Supabase não confirmou a exclusão da foto.')
  }
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
  const chave = chaveCashoutPoker(dataCartao, mesBase)
  const cashoutSessao = cashouts[chave] || cashouts[dataCartao]
  if (cashoutSessao) {
    const restantes = { ...cashoutSessao }
    delete restantes[local]
    cashouts[chave] = restantes
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

export async function sincronizarCashoutsPoker(): Promise<CashoutsPokerMap> {
  const { data: userData } = await supabase.auth.getUser()
  if (!userData?.user?.id) return carregarCashoutsPoker()
  const { data, error } = await (supabase as any)
    .from('poker_sessoes_cashout')
    .select('data_cartao, mes_base, cashout, valores_por_local, atualizado_em')
    .order('atualizado_em', { ascending: false })
  if (error) throw error

  const rawLocal = getLocalItem<Record<string, any> | null>(STORAGE_KEYS.CASHOUTS, null) || {}
  const local: CashoutsPokerMap = {}
  Object.entries(rawLocal).forEach(([data, valores]) => {
    if (typeof valores === 'number') local[data] = { Total: valores }
    else if (valores && typeof valores === 'object') local[data] = valores as CashoutPorLocal
  })
  const sincronizados: CashoutsPokerMap = { ...local }
  ;(data || []).forEach((registro: { data_cartao: string; mes_base: string; cashout: number; valores_por_local?: CashoutPorLocal | null }) => {
    const chave = chaveCashoutPoker(registro.data_cartao, registro.mes_base)
    const totalRemoto = Number(registro.cashout) || 0
    const valoresLocais = local[chave] || local[registro.data_cartao]
    const valoresRemotos = registro.valores_por_local && typeof registro.valores_por_local === 'object'
      ? registro.valores_por_local
      : null
    const totalPorLocalRemoto = valoresRemotos ? obterTotalCashoutSessao(valoresRemotos) : null
    if (valoresRemotos && Object.keys(valoresRemotos).length > 0 && totalPorLocalRemoto !== null && Math.abs(totalPorLocalRemoto - totalRemoto) < 0.01) {
      sincronizados[chave] = valoresRemotos
      return
    }
    const totalLocal = valoresLocais ? obterTotalCashoutSessao(valoresLocais) : null
    sincronizados[chave] = totalLocal !== null && Math.abs(totalLocal - totalRemoto) < 0.01
      ? valoresLocais
      : { Total: totalRemoto }
  })
  setLocalItem(STORAGE_KEYS.CASHOUTS, sincronizados)
  return sincronizados
}

export function obterTotalCashoutSessao(cashoutsDaSessao?: CashoutPorLocal): number {
  if (!cashoutsDaSessao) return 0
  return Object.entries(cashoutsDaSessao).reduce((acc, [key, value]) => key === '__formas' ? acc : acc + (Number(value) || 0), 0)
}

export function chaveCashoutPoker(dataCartao: string, mesBase: string): string {
  return `${mesBase}|${dataCartao}`
}

export function obterCashoutPokerSessao(cashouts: CashoutsPokerMap, dataCartao: string, mesBase: string): CashoutPorLocal | undefined {
  return cashouts[chaveCashoutPoker(dataCartao, mesBase)] || cashouts[dataCartao]
}

export async function salvarCashoutsDaSessao(
  dataCartao: string,
  valoresPorLocal: CashoutPorLocal,
  mesBase = 'Novembro'
): Promise<void> {
  const total = obterTotalCashoutSessao(valoresPorLocal)
  const { data: userData, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  const usuarioId = userData?.user?.id
  if (!usuarioId) throw new Error('Faça login para salvar o cashout.')

  const { data, error } = await (supabase as any)
    .from('poker_sessoes_cashout')
    .upsert({
      usuario_id: usuarioId,
      mes_base: mesBase,
      data_cartao: dataCartao,
      cashout: total,
      valores_por_local: valoresPorLocal
    }, { onConflict: 'usuario_id, mes_base, data_cartao' })
    .select('cashout, valores_por_local')
    .single()
  if (error) throw error
  if (!data || Math.abs((Number(data.cashout) || 0) - total) >= 0.01) {
    throw new Error('O Supabase não confirmou o total do cashout salvo.')
  }

  const atuais = carregarCashoutsPoker()
  atuais[chaveCashoutPoker(dataCartao, mesBase)] = valoresPorLocal
  setLocalItem(STORAGE_KEYS.CASHOUTS, atuais)
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

export type FormatoNegativoPoker = 'menos' | 'parenteses'

export function carregarFormatoNegativoPoker(): FormatoNegativoPoker {
  return getLocalItem<FormatoNegativoPoker>(STORAGE_KEYS.FORMATO_NEGATIVO_POKER, 'menos') === 'parenteses' ? 'parenteses' : 'menos'
}

export function salvarFormatoNegativoPoker(formato: FormatoNegativoPoker): void {
  setLocalItem(STORAGE_KEYS.FORMATO_NEGATIVO_POKER, formato)
}

export function carregarLocaisPoker(): string[] {
  return getLocalItem<string[]>(STORAGE_KEYS.LOCAIS, LOCAIS_PADRAO)
}

export function salvarLocaisPoker(locais: string[]): void {
  setLocalItem(STORAGE_KEYS.LOCAIS, locais)
}

const coresPadraoLocaisPoker: Record<string, string> = { h2: '#77158D', montecarlo: '#5B120E' }

export function carregarConfiguracoesLocaisPoker(): LocalPokerConfig[] {
  const locais = carregarLocaisPoker()
  const salvas = getLocalItem<LocalPokerConfig[]>(STORAGE_KEYS.LOCAIS_CONFIG, [])
  const resultado = [...salvas]
  locais.forEach((nome) => {
    const existe = resultado.some((item) => item.nome.toLowerCase() === nome.toLowerCase() || item.aliases?.some((alias) => alias.toLowerCase() === nome.toLowerCase()))
    if (!existe) resultado.push({ nome, cor: coresPadraoLocaisPoker[nome.toLowerCase()] || '#475569' })
  })
  return resultado
}

export async function sincronizarConfiguracoesLocaisPoker(): Promise<LocalPokerConfig[]> {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return carregarConfiguracoesLocaisPoker()
  const remotas = data.user.user_metadata?.poker_locais_config
  if (Array.isArray(remotas)) {
    const configs = remotas as LocalPokerConfig[]
    if (configs.length) salvarLocaisPoker(configs.map((item) => item.nome))
    setLocalItem(STORAGE_KEYS.LOCAIS_CONFIG, configs)
  }
  const configs = carregarConfiguracoesLocaisPoker()
  return Promise.all(configs.map(async (config) => {
    if (!config.storage_path) return config
    const { data: signed, error: signedError } = await supabase.storage.from('poker-fotos').createSignedUrl(config.storage_path, 3600)
    return signedError || !signed ? config : { ...config, fotoUrl: signed.signedUrl }
  }))
}

export async function salvarConfiguracoesLocaisPoker(configs: LocalPokerConfig[]): Promise<void> {
  setLocalItem(STORAGE_KEYS.LOCAIS_CONFIG, configs.map(({ fotoUrl: _fotoUrl, ...config }) => config))
  salvarLocaisPoker(configs.map((config) => config.nome))
  const { data } = await supabase.auth.getUser()
  if (!data.user) return
  const { error } = await supabase.auth.updateUser({
    data: { ...data.user.user_metadata, poker_locais_config: configs.map(({ fotoUrl: _fotoUrl, ...config }) => config) }
  })
  if (error) throw error
}

export async function enviarLogoLocalPoker(args: { nome: string; nomeArquivo: string; tipoMime: string; uri: string; arquivoWeb?: Blob }): Promise<FotoPoker> {
  return adicionarFotoPoker({
    mesBase: '__config_locais__',
    dataCartao: '__logo_local__',
    local: args.nome,
    nomeArquivo: args.nomeArquivo,
    tipoMime: args.tipoMime,
    uri: args.uri,
    arquivoWeb: args.arquivoWeb
  })
}

export async function removerLogoLocalPoker(storagePath: string): Promise<void> {
  const { data } = await supabase.auth.getUser()
  const usuarioId = data.user?.id
  if (!usuarioId || !storagePath.startsWith(`${usuarioId}/`)) throw new Error('Não foi possível validar a imagem do local.')
  const { error: storageError } = await supabase.storage.from('poker-fotos').remove([storagePath])
  if (storageError) throw storageError
  const { error } = await (supabase as any).from('poker_sessao_fotos').delete().eq('storage_path', storagePath).eq('usuario_id', usuarioId)
  if (error) throw error
}

export function carregarCartoesPoker(): string[] {
  return getLocalItem<string[]>(STORAGE_KEYS.CARTOES_POKER, CARTOES_PADRAO)
}

export function salvarCartoesPoker(cartoes: string[]): void {
  setLocalItem(STORAGE_KEYS.CARTOES_POKER, cartoes)
}

// Aliases para retrocompatibilidade
export const carregarLancamentosMA = carregarLancamentosPoker
export const salvarLancamentosMA = salvarLancamentosPoker
export const LANCAMENTOS_INICIAIS = LANCAMENTOS_POKER_INICIAIS

