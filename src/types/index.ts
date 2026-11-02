import type { Database } from './database'

type Tabelas = Database['public']['Tables']

export type Linha<T extends keyof Tabelas> = Tabelas[T]['Row']
export type NovaLinha<T extends keyof Tabelas> = Tabelas[T]['Insert']
export type Atualizacao<T extends keyof Tabelas> = Tabelas[T]['Update']

// Valores aceitos pelos CHECKs do banco (o banco guarda como text).
export type TipoTransacao = 'receita' | 'despesa'
export type StatusTransacao = 'pendente' | 'confirmado' | 'cancelado'
export type TipoConta = 'corrente' | 'poupanca' | 'carteira' | 'investimento' | 'outro'
export type StatusParcela = 'pendente' | 'paga' | 'cancelada'
export type StatusMeta = 'ativa' | 'concluida' | 'cancelada'
export type BandeiraCartao = 'mastercard' | 'visa' | 'elo' | 'amex' | 'hipercard' | 'outro'

export type Perfil = Linha<'profiles'>
export type Categoria = Omit<Linha<'categorias'>, 'tipo'> & { tipo: TipoTransacao }
export type Conta = Omit<Linha<'contas'>, 'tipo'> & { tipo: TipoConta }
export type CartaoCredito = Omit<Linha<'cartoes_credito'>, 'bandeira'> & { bandeira: BandeiraCartao }
export type Transacao = Omit<Linha<'transacoes'>, 'tipo' | 'status'> & {
  tipo: TipoTransacao
  status: StatusTransacao
}
export type Parcela = Omit<Linha<'parcelas'>, 'status'> & { status: StatusParcela }
export type Meta = Omit<Linha<'metas'>, 'status'> & { status: StatusMeta }
export type Orcamento = Linha<'orcamentos'>

export type FechamentoMensal = {
  id: string
  usuario_id?: string
  mes_ano: string
  valor_cartoes: number
  valor_contas: number
  valor_dinheiro: number
  valor_pix: number
  valor_conta_corrente: number
  valor_salario: number
  valor_necessario: number
  observacao?: string | null
  criado_em?: string
  atualizado_em?: string
}

export type CartaoControleItem = {
  id: string
  usuario_id?: string
  mes_referencia?: string
  tabela_tipo: 'vigente' | 'detalhado_ma'
  cartao_nome: string
  valor: number
  valor_ma?: number
  valor_sem_ma?: number
  fechamento?: string
  pagamento?: string
  atualizado_em_texto?: string
  ordem?: number
  criado_em?: string
}

export type LancamentoPoker = {
  id: string
  usuario_id?: string
  mes_base: string
  data_cartao: string
  cartao_nome: string
  local: string
  valor: number
  taxa: number
  ordem?: number
  criado_em?: string
}

export type LancamentoMA = LancamentoPoker

export type SessaoPokerResumo = {
  data_cartao: string
  mes_base: string
  cashout: number
}


