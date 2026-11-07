/**
 * Tipos do banco (escritos à mão, refletem as migrations até a 008).
 *
 * Depois de `npx supabase db push`, prefira regenerar:
 *   npx supabase gen types typescript --linked > src/types/database.ts
 */
type Relacao = {
  foreignKeyName: string
  columns: string[]
  isOneToOne: boolean
  referencedRelation: string
  referencedColumns: string[]
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; nome: string | null; email: string | null; criado_em: string; atualizado_em: string }
        Insert: { id: string; nome?: string | null; email?: string | null; criado_em?: string; atualizado_em?: string }
        Update: { id?: string; nome?: string | null; email?: string | null; criado_em?: string; atualizado_em?: string }
        Relationships: Relacao[]
      }
      agendas: {
        Row: { id: string; proprietario_id: string; nome: string; principal: boolean; criado_em: string }
        Insert: { id?: string; proprietario_id: string; nome?: string; principal?: boolean; criado_em?: string }
        Update: { id?: string; proprietario_id?: string; nome?: string; principal?: boolean; criado_em?: string }
        Relationships: Relacao[]
      }
      agenda_membros: {
        Row: { agenda_id: string; usuario_id: string; papel: string; cor: string; entrou_em: string }
        Insert: { agenda_id: string; usuario_id: string; papel?: string; cor?: string; entrou_em?: string }
        Update: { agenda_id?: string; usuario_id?: string; papel?: string; cor?: string; entrou_em?: string }
        Relationships: Relacao[]
      }
      agenda_convites: {
        Row: { id: string; agenda_id: string; email: string; convidado_por: string; status: string; criado_em: string }
        Insert: { id?: string; agenda_id: string; email: string; convidado_por: string; status?: string; criado_em?: string }
        Update: { id?: string; agenda_id?: string; email?: string; convidado_por?: string; status?: string; criado_em?: string }
        Relationships: Relacao[]
      }
      agenda_preferencias: {
        Row: { usuario_id: string; inicio_dia: string; fim_dia: string; atualizado_em: string }
        Insert: { usuario_id: string; inicio_dia?: string; fim_dia?: string; atualizado_em?: string }
        Update: { usuario_id?: string; inicio_dia?: string; fim_dia?: string; atualizado_em?: string }
        Relationships: Relacao[]
      }
      poker_dias_bloqueados: {
        Row: { id: string; usuario_id: string; data_cartao: string; travado: boolean; atualizado_em: string }
        Insert: { id?: string; usuario_id?: string; data_cartao: string; travado?: boolean; atualizado_em?: string }
        Update: { id?: string; usuario_id?: string; data_cartao?: string; travado?: boolean; atualizado_em?: string }
        Relationships: Relacao[]
      }
      organizacao_itens: {
        Row: { id: string; usuario_id: string; agenda_id: string; responsavel_id: string | null; prioridade: string; tipo: string; titulo: string; descricao: string | null; data: string; horario: string | null; horario_fim: string | null; mostrar_na_agenda: boolean; mostrar_na_todo: boolean; concluido: boolean; criado_em: string; atualizado_em: string }
        Insert: { id?: string; usuario_id?: string; agenda_id?: string; responsavel_id?: string | null; prioridade?: string; tipo: string; titulo: string; descricao?: string | null; data?: string; horario?: string | null; horario_fim?: string | null; mostrar_na_agenda?: boolean; mostrar_na_todo?: boolean; concluido?: boolean; criado_em?: string; atualizado_em?: string }
        Update: { id?: string; usuario_id?: string; agenda_id?: string; responsavel_id?: string | null; prioridade?: string; tipo?: string; titulo?: string; descricao?: string | null; data?: string; horario?: string | null; horario_fim?: string | null; mostrar_na_agenda?: boolean; mostrar_na_todo?: boolean; concluido?: boolean; criado_em?: string; atualizado_em?: string }
        Relationships: Relacao[]
      }
      categorias: {
        Row: { id: string; usuario_id: string; nome: string; tipo: string; cor: string | null; icone: string | null; criado_em: string }
        Insert: { id?: string; usuario_id?: string; nome: string; tipo: string; cor?: string | null; icone?: string | null; criado_em?: string }
        Update: { id?: string; usuario_id?: string; nome?: string; tipo?: string; cor?: string | null; icone?: string | null; criado_em?: string }
        Relationships: Relacao[]
      }
      contas: {
        Row: {
          id: string; usuario_id: string; nome: string; tipo: string; saldo_inicial: number
          instituicao: string | null; cor: string | null; ativa: boolean; criado_em: string; atualizado_em: string
        }
        Insert: {
          id?: string; usuario_id?: string; nome: string; tipo: string; saldo_inicial?: number
          instituicao?: string | null; cor?: string | null; ativa?: boolean; criado_em?: string; atualizado_em?: string
        }
        Update: {
          id?: string; usuario_id?: string; nome?: string; tipo?: string; saldo_inicial?: number
          instituicao?: string | null; cor?: string | null; ativa?: boolean; criado_em?: string; atualizado_em?: string
        }
        Relationships: Relacao[]
      }
      cartoes_credito: {
        Row: {
          id: string; usuario_id: string; nome: string; limite: number; dia_fechamento: number
          dia_vencimento: number; bandeira: string; cor: string; ativo: boolean; criado_em: string; atualizado_em: string
        }
        Insert: {
          id?: string; usuario_id?: string; nome: string; limite?: number; dia_fechamento?: number
          dia_vencimento?: number; bandeira?: string; cor?: string; ativo?: boolean; criado_em?: string; atualizado_em?: string
        }
        Update: {
          id?: string; usuario_id?: string; nome?: string; limite?: number; dia_fechamento?: number
          dia_vencimento?: number; bandeira?: string; cor?: string; ativo?: boolean; criado_em?: string; atualizado_em?: string
        }
        Relationships: Relacao[]
      }
      transacoes: {
        Row: {
          id: string; usuario_id: string; conta_id: string; cartao_id: string | null; categoria_id: string | null; tipo: string
          descricao: string; valor: number; data: string; observacao: string | null; status: string
          criado_em: string; atualizado_em: string
        }
        Insert: {
          id?: string; usuario_id?: string; conta_id: string; cartao_id?: string | null; categoria_id?: string | null; tipo: string
          descricao: string; valor: number; data?: string; observacao?: string | null; status?: string
          criado_em?: string; atualizado_em?: string
        }
        Update: {
          id?: string; usuario_id?: string; conta_id?: string; cartao_id?: string | null; categoria_id?: string | null; tipo?: string
          descricao?: string; valor?: number; data?: string; observacao?: string | null; status?: string
          criado_em?: string; atualizado_em?: string
        }
        Relationships: [
          { foreignKeyName: 'transacoes_conta_id_fkey'; columns: ['conta_id']; isOneToOne: false; referencedRelation: 'contas'; referencedColumns: ['id'] },
          { foreignKeyName: 'transacoes_categoria_id_fkey'; columns: ['categoria_id']; isOneToOne: false; referencedRelation: 'categorias'; referencedColumns: ['id'] },
          { foreignKeyName: 'transacoes_cartao_id_fkey'; columns: ['cartao_id']; isOneToOne: false; referencedRelation: 'cartoes_credito'; referencedColumns: ['id'] }
        ]
      }
      parcelas: {
        Row: {
          id: string; transacao_id: string; usuario_id: string; numero: number; total_parcelas: number
          valor: number; data_vencimento: string; status: string; criado_em: string
        }
        Insert: {
          id?: string; transacao_id: string; usuario_id?: string; numero: number; total_parcelas: number
          valor: number; data_vencimento: string; status?: string; criado_em?: string
        }
        Update: {
          id?: string; transacao_id?: string; usuario_id?: string; numero?: number; total_parcelas?: number
          valor?: number; data_vencimento?: string; status?: string; criado_em?: string
        }
        Relationships: [
          { foreignKeyName: 'parcelas_transacao_usuario_fk'; columns: ['transacao_id', 'usuario_id']; isOneToOne: false; referencedRelation: 'transacoes'; referencedColumns: ['id', 'usuario_id'] }
        ]
      }
      metas: {
        Row: {
          id: string; usuario_id: string; nome: string; valor_objetivo: number; valor_atual: number
          data_limite: string | null; status: string; criado_em: string; atualizado_em: string
        }
        Insert: {
          id?: string; usuario_id?: string; nome: string; valor_objetivo: number; valor_atual?: number
          data_limite?: string | null; status?: string; criado_em?: string; atualizado_em?: string
        }
        Update: {
          id?: string; usuario_id?: string; nome?: string; valor_objetivo?: number; valor_atual?: number
          data_limite?: string | null; status?: string; criado_em?: string; atualizado_em?: string
        }
        Relationships: Relacao[]
      }
      orcamentos: {
        Row: {
          id: string; usuario_id: string; categoria_id: string; mes: number; ano: number
          valor_limite: number; criado_em: string; atualizado_em: string
        }
        Insert: {
          id?: string; usuario_id?: string; categoria_id: string; mes: number; ano: number
          valor_limite: number; criado_em?: string; atualizado_em?: string
        }
        Update: {
          id?: string; usuario_id?: string; categoria_id?: string; mes?: number; ano?: number
          valor_limite?: number; criado_em?: string; atualizado_em?: string
        }
        Relationships: [
          { foreignKeyName: 'orcamentos_categoria_id_fkey'; columns: ['categoria_id']; isOneToOne: false; referencedRelation: 'categorias'; referencedColumns: ['id'] }
        ]
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      usuario_e_membro_agenda: { Args: { p_agenda_id: string }; Returns: boolean }
      convidar_para_agenda: { Args: { p_email: string }; Returns: string }
      listar_convites_recebidos: { Args: Record<PropertyKey, never>; Returns: { convite_id: string; agenda_id: string; agenda_nome: string; remetente: string; criado_em: string }[] }
      aceitar_convite_agenda: { Args: { p_convite_id: string }; Returns: undefined }
      atualizar_cor_agendas: { Args: { p_cor: string }; Returns: undefined }
      listar_membros_agenda: { Args: { p_agenda_id: string | null }; Returns: { usuario_id: string; nome: string; email: string | null; cor: string }[] }
      hoje: { Args: Record<PropertyKey, never>; Returns: string }
      criar_transacao_parcelada: {
        Args: {
          p_conta_id: string
          p_categoria_id: string | null
          p_descricao: string
          p_valor_total: number
          p_total_parcelas: number
          p_primeiro_vencimento: string
          p_tipo?: string
          p_data?: string | null
          p_observacao?: string | null
        }
        Returns: string
      }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
