import { createClient } from '@nhost/nhost-js'

const subdomain = process.env.EXPO_PUBLIC_NHOST_SUBDOMAIN
const region = process.env.EXPO_PUBLIC_NHOST_REGION

// Este módulo também é importado estaticamente quando o provedor ativo é Supabase.
// Deixe o cliente local inerte nesse caso; a configuração obrigatória é validada
// em supabase.ts somente quando o provedor Nhost está selecionado.
export const nhost = subdomain && region
  ? createClient({ subdomain, region })
  : createClient({ subdomain: 'local', region: 'local' })

type Filter = { column: string; operator: string; value: unknown }
type Sort = { column: string; direction: 'asc' | 'desc' }

function graphQLName(value: string) {
  if (!/^[_A-Za-z][_0-9A-Za-z]*$/.test(value)) throw new Error(`Nome inválido para GraphQL: ${value}`)
  return value
}

function graphQLValue(value: unknown): string {
  if (value === null) return 'null'
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return `[${value.map(graphQLValue).join(', ')}]`
  if (typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>).map(([key, item]) => `${graphQLName(key)}: ${graphQLValue(item)}`).join(', ')}}`
  }
  throw new Error('Valor não suportado em uma operação GraphQL.')
}

function splitSelect(input: string): string[] {
  const parts: string[] = []
  let start = 0
  let depth = 0
  for (let i = 0; i < input.length; i += 1) {
    if (input[i] === '(') depth += 1
    else if (input[i] === ')') depth -= 1
    else if (input[i] === ',' && depth === 0) {
      parts.push(input.slice(start, i).trim())
      start = i + 1
    }
  }
  const tail = input.slice(start).trim()
  if (tail) parts.push(tail)
  return parts.filter(Boolean)
}

function parseSelect(input: string): string {
  return splitSelect(input).map((part) => {
    if (part === '*') return '*'
    const relation = part.match(/^([_A-Za-z][_0-9A-Za-z]*)(?:\s*\((.*)\))?$/s)
    if (!relation) throw new Error(`Seleção Supabase não suportada no Nhost: ${part}`)
    const name = graphQLName(relation[1])
    return relation[2] === undefined ? name : `${name} { ${parseSelect(relation[2])} }`
  }).join(' ')
}

function parsePostgrestValue(value: unknown) {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
    const inner = trimmed.slice(1, -1)
    return inner ? inner.split(',').map((item) => item.trim().replace(/^"|"$/g, '')) : []
  }
  return trimmed
}

class NhostQuery implements PromiseLike<any> {
  private action: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select'
  private selectText: string | null = null
  private values: any
  private filters: Filter[] = []
  private orderBy: Sort[] = []
  private rowLimit: number | undefined
  private rowOffset: number | undefined
  private singleResult: 'single' | 'maybeSingle' | null = null
  private conflictColumns: string | null = null
  private ignoreDuplicates = false

  constructor(private readonly table: string, private readonly owner: NhostCompatClient) {}

  select(columns = '*') { this.selectText = columns; return this }
  insert(values: any) { this.action = 'insert'; this.values = values; return this }
  update(values: any) { this.action = 'update'; this.values = values; return this }
  delete() { this.action = 'delete'; return this }
  upsert(values: any, options: any = {}) {
    this.action = 'upsert'; this.values = values; this.conflictColumns = options.onConflict || null; this.ignoreDuplicates = !!options.ignoreDuplicates; return this
  }
  eq(column: string, value: unknown) { this.filters.push({ column, operator: '_eq', value }); return this }
  neq(column: string, value: unknown) { this.filters.push({ column, operator: '_neq', value }); return this }
  gt(column: string, value: unknown) { this.filters.push({ column, operator: '_gt', value }); return this }
  gte(column: string, value: unknown) { this.filters.push({ column, operator: '_gte', value }); return this }
  lt(column: string, value: unknown) { this.filters.push({ column, operator: '_lt', value }); return this }
  lte(column: string, value: unknown) { this.filters.push({ column, operator: '_lte', value }); return this }
  like(column: string, value: unknown) { this.filters.push({ column, operator: '_like', value }); return this }
  ilike(column: string, value: unknown) { this.filters.push({ column, operator: '_ilike', value }); return this }
  in(column: string, value: unknown[]) { this.filters.push({ column, operator: '_in', value }); return this }
  is(column: string, value: unknown) { this.filters.push({ column, operator: value === null ? '_is_null' : '_eq', value: value === null ? true : value }); return this }
  match(values: Record<string, unknown>) { for (const [column, value] of Object.entries(values)) this.eq(column, value); return this }
  not(column: string, operator: string, value: unknown) {
    this.filters.push({ column, operator: `_not_${operator.replace(/^_/, '')}`, value: parsePostgrestValue(value) }); return this
  }
  filter(column: string, operator: string, value: unknown) {
    const op = operator.startsWith('_') ? operator : `_${operator}`
    this.filters.push({ column, operator: op, value: parsePostgrestValue(value) }); return this
  }
  order(column: string, options: any = {}) { this.orderBy.push({ column, direction: options.ascending === false ? 'desc' : 'asc' }); return this }
  limit(count: number) { this.rowLimit = count; return this }
  range(from: number, to: number) { this.rowOffset = from; this.rowLimit = Math.max(0, to - from + 1); return this }
  single() { this.singleResult = 'single'; return this }
  maybeSingle() { this.singleResult = 'maybeSingle'; return this }

  then<TResult1 = any, TResult2 = never>(onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled || undefined, onrejected || undefined)
  }

  private whereExpression() {
    const fields = this.filters.map(({ column, operator, value }) => {
      const path = column.split('.').map(graphQLName)
      let operand: Record<string, unknown>
      if (operator.startsWith('_not_')) operand = { [`_${operator.slice(5)}`]: value }
      else operand = { [operator]: value }
      let nested: any = operand
      for (let index = path.length - 1; index >= 0; index -= 1) nested = { [path[index]]: nested }
      return operator.startsWith('_not_') ? { _not: nested } : nested
    })
    if (!fields.length) return ''
    return `where: ${graphQLValue(fields.length === 1 ? fields[0] : { _and: fields })}`
  }

  private async selection(fields: string) {
    if (!fields.includes('*')) return fields
    const scalarFields = await this.owner.scalarFields(this.table)
    return fields.replaceAll('*', scalarFields.join(' '))
  }

  private async execute() {
    try {
      const table = graphQLName(this.table)
      const where = this.whereExpression()
      const order = this.orderBy.length
        ? `order_by: [${this.orderBy.map(({ column, direction }) => `{${graphQLName(column)}: ${direction}}`).join(', ')}] `
        : ''
      const limit = this.rowLimit === undefined ? '' : `limit: ${this.rowLimit} `
      const offset = this.rowOffset === undefined ? '' : `offset: ${this.rowOffset} `
      const args = [where, order, limit, offset].filter(Boolean).join(', ')
      const requested = this.selectText ? await this.selection(parseSelect(this.selectText)) : 'id'
      let query: string
      let root: string
      let returning = false

      if (this.action === 'select') {
        root = table
        query = `query { ${root}${args ? `(${args})` : ''} { ${requested} } }`
      } else if (this.action === 'insert' || this.action === 'upsert') {
        root = `insert_${table}`
        const objects = Array.isArray(this.values) ? this.values : [this.values]
        let conflict = ''
        if (this.action === 'upsert') {
          const constraint = await this.owner.conflictConstraint(this.table, this.conflictColumns)
          const updates = this.ignoreDuplicates ? [] : [...new Set(objects.flatMap((item) => Object.keys(item || {})))].filter((field) => !this.conflictColumns?.split(',').includes(field) && field !== 'id')
          conflict = `, on_conflict: {constraint: ${constraint}, update_columns: [${updates.map(graphQLName).join(', ')}]}`
        }
        returning = true
        query = `mutation { ${root}(objects: ${graphQLValue(objects)}${conflict}) { affected_rows returning { ${requested} } } }`
      } else if (this.action === 'update') {
        root = `update_${table}`; returning = true
        query = `mutation { ${root}(${where || 'where: {}'}, _set: ${graphQLValue(this.values || {})}) { affected_rows returning { ${requested} } } }`
      } else {
        root = `delete_${table}`; returning = true
        query = `mutation { ${root}(${where || 'where: {}'}) { affected_rows returning { ${requested} } } }`
      }

      const response = await this.owner.request(query)
      if (response.error) return { data: null, error: response.error }
      let data = response.data?.[root]
      if (returning) data = data?.returning ?? null
      if (this.singleResult) {
        const rows = Array.isArray(data) ? data : data == null ? [] : [data]
        if (rows.length === 0 && this.singleResult === 'maybeSingle') data = null
        else if (rows.length !== 1) return { data: null, error: { message: `Esperava uma linha e encontrei ${rows.length}.`, code: 'PGRST116' } }
        else data = rows[0]
      }
      return { data, error: null, count: returning ? response.data?.[root]?.affected_rows ?? null : null }
    } catch (error) {
      return { data: null, error: { message: error instanceof Error ? error.message : String(error) } }
    }
  }
}

export class NhostCompatClient {
  private introspection = new Map<string, string[]>()
  private constraints = new Map<string, string[]>()

  readonly auth: any
  readonly storage: any

  constructor() {
    this.auth = this.createAuthCompat()
    this.storage = this.createStorageCompat()
  }

  from(table: string) { return new NhostQuery(table, this) }

  async rpc(name: string, args: Record<string, unknown> = {}) {
    const wrappers: Record<string, { field: string; kind: 'query' | 'mutation'; shape: 'rows' | 'uuid' | 'void'; columns: string }> = {
      listar_membros_agenda: { field: 'nhost_listar_membros_agenda', kind: 'query', shape: 'rows', columns: 'usuario_id nome email cor' },
      listar_convites_recebidos: { field: 'nhost_listar_convites_recebidos', kind: 'query', shape: 'rows', columns: 'convite_id agenda_id agenda_nome remetente criado_em' },
      convidar_para_agenda: { field: 'nhost_convidar_para_agenda', kind: 'mutation', shape: 'uuid', columns: 'result' },
      aceitar_convite_agenda: { field: 'nhost_aceitar_convite_agenda', kind: 'mutation', shape: 'void', columns: 'result' },
      atualizar_cor_agendas: { field: 'nhost_atualizar_cor_agendas', kind: 'mutation', shape: 'void', columns: 'result' },
      criar_transacao_parcelada_cartao: { field: 'nhost_criar_transacao_parcelada_cartao', kind: 'mutation', shape: 'uuid', columns: 'result' },
      excluir_sessao_poker: { field: 'nhost_excluir_sessao_poker', kind: 'mutation', shape: 'void', columns: 'result' },
      salvar_sessao_poker: { field: 'nhost_salvar_sessao_poker', kind: 'mutation', shape: 'uuid', columns: 'result' },
      excluir_local_sessao_poker: { field: 'nhost_excluir_local_sessao_poker', kind: 'mutation', shape: 'void', columns: 'result' }
    }
    try {
      const wrapper = wrappers[name]
      if (!wrapper) throw new Error(`RPC não migrada para Nhost: ${name}`)
      const input = Object.keys(args).length ? `(args: ${graphQLValue(args)})` : ''
      const operation = wrapper.kind === 'mutation' ? 'mutation' : 'query'
      const query = `${operation} { ${wrapper.field}${input} { ${wrapper.columns} } }`
      const result = await this.request(query)
      if (result.error) return { data: null, error: result.error }
      const rows = result.data?.[wrapper.field] || []
      if (wrapper.shape === 'rows') return { data: rows, error: null }
      if (wrapper.shape === 'uuid') return { data: rows[0]?.result ?? null, error: null }
      return { data: null, error: null }
    } catch (error) {
      return { data: null, error: { message: error instanceof Error ? error.message : String(error) } }
    }
  }

  async request(query: string) {
    try {
      const response = await nhost.graphql.request({ query })
      const body: any = response.body
      const errors = body?.errors
      if (errors?.length) return { data: null, error: { message: errors.map((item: any) => item.message).join('; '), code: errors[0].extensions?.code } }
      return { data: body?.data, error: null }
    } catch (error) {
      const detail = error as any
      const serverErrors = detail?.body?.errors
      const message = Array.isArray(serverErrors) && serverErrors.length
        ? serverErrors.map((item: any) => item.message).join('; ')
        : error instanceof Error ? error.message : String(error)
      const safeQuery = query.replace(/"(?:[^"\\]|\\.)*"/g, '"[valor oculto]"')
      console.error('[Nhost GraphQL] Consulta rejeitada', {
        message,
        status: detail?.status,
        code: serverErrors?.[0]?.extensions?.code,
        query: safeQuery
      })
      return { data: null, error: { message, code: serverErrors?.[0]?.extensions?.code } }
    }
  }

  async scalarFields(table: string) {
    const cached = this.introspection.get(table)
    if (cached) return cached
    const root = await this.request(`query { __type(name: "${graphQLName(table)}") { fields { name type { kind name ofType { kind name ofType { kind name } } } } } }`)
    if (root.error) throw new Error(root.error.message)
    const fields = root.data?.__type?.fields || []
    const scalar = fields.filter((field: any) => {
      let type = field.type
      while (type?.ofType) type = type.ofType
      return type?.kind === 'SCALAR' || type?.kind === 'ENUM'
    }).map((field: any) => graphQLName(field.name))
    if (!scalar.length) throw new Error(`Não encontrei colunas GraphQL para public.${table}.`)
    this.introspection.set(table, scalar)
    return scalar
  }

  async conflictConstraint(table: string, columns: string | null) {
    const fields = (columns || 'id').split(',').map((item) => item.trim())
    const key = `${table}:${fields.join(',')}`
    const cached = this.constraints.get(key)
    if (cached) return cached[0]
    const typeName = `${graphQLName(table)}_constraint`
    const result = await this.request(`query { __type(name: "${typeName}") { enumValues { name } } }`)
    if (result.error) throw new Error(result.error.message)
    const names: string[] = result.data?.__type?.enumValues?.map((item: any) => item.name) || []
    const knownConstraints: Record<string, string> = {
      'fechamentos_mensais:usuario_id,mes_ano': 'fechamento_usuario_mes_unique',
      'poker_sessoes_cashout:usuario_id,mes_base,data_cartao': 'poker_sessao_unique',
      'poker_dias_bloqueados:usuario_id,data_cartao': 'poker_dia_bloqueado_unique',
      'poker_sessoes:usuario_id,mes_base,data_cartao': 'poker_sessoes_usuario_fatura_data_unique'
    }
    const known = knownConstraints[key]
    const candidate = (known && names.includes(known) ? known : undefined)
      || names.find((name) => fields.length === 1 && name === `${table}_pkey`)
      || names.find((name) => name === `${table}_${fields.join('_')}_key`)
    if (!candidate) throw new Error(`Não encontrei uma constraint de conflito para ${table} (${fields.join(', ')}).`)
    this.constraints.set(key, [candidate])
    return candidate
  }

  private session() { return nhost.getUserSession() as any }
  private supabaseSession() {
    const current = this.session()
    if (!current?.user) return null
    return {
      access_token: current.accessToken,
      refresh_token: current.refreshToken,
      token_type: 'bearer',
      expires_in: current.accessTokenExpiresIn,
      expires_at: current.decodedToken?.exp,
      user: { ...current.user, user_metadata: current.user.metadata || {} }
    }
  }

  private createAuthCompat() {
    const errorFrom = (response: any) => response.status >= 200 && response.status < 300 ? null : new Error(response.body?.message || response.body?.error || 'Falha no serviço de autenticação Nhost.')
    return {
      getSession: async () => ({ data: { session: this.supabaseSession() }, error: null }),
      getUser: async () => ({ data: { user: this.supabaseSession()?.user || null }, error: null }),
      onAuthStateChange: (callback: (event: string, session: any) => void) => {
        const unsubscribe = nhost.sessionStorage.onChange((session: any) => callback(session ? 'SIGNED_IN' : 'SIGNED_OUT', this.supabaseSession()))
        return { data: { subscription: { unsubscribe } } }
      },
      signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
        try {
          const result = await nhost.auth.signInEmailPassword({ email, password })
          return { data: result.body, error: errorFrom(result) }
        } catch (error) { return { data: null, error: error instanceof Error ? error : new Error(String(error)) }
        }
      },
      signUp: async ({ email, password, options }: any) => {
        try {
          const result = await nhost.auth.signUpEmailPassword({
            email,
            password,
            options: {
              displayName: options?.data?.nome,
              metadata: options?.data || {}
            }
          })
          return { data: result.body, error: errorFrom(result) }
        } catch (error) { return { data: null, error: error instanceof Error ? error : new Error(String(error)) }
        }
      },
      resetPasswordForEmail: async (email: string) => {
        try {
          const result = await nhost.auth.sendPasswordResetEmail({ email })
          return { data: result.body, error: errorFrom(result) }
        } catch (error) { return { data: null, error: error instanceof Error ? error : new Error(String(error)) }
        }
      },
      signOut: async () => {
        try {
          const current = this.session()
          if (!current?.refreshTokenId) { nhost.clearSession(); return { error: null } }
          const result = await nhost.auth.signOut({ refreshToken: current.refreshTokenId })
          nhost.clearSession()
          return { error: errorFrom(result) }
        } catch (error) { return { error: error instanceof Error ? error : new Error(String(error)) }
        }
      },
      updateUser: async ({ password, data }: any) => {
        try {
          if (password) {
            const result = await nhost.auth.changeUserPassword({ newPassword: password })
            return { data: result.body, error: errorFrom(result) }
          }
          if (data) {
            const current = this.session()
            if (!current?.user?.id) return { data: null, error: new Error('Usuário não autenticado.') }
            const metadata = { ...(current.user.metadata || {}), ...data }
            const result = await this.request(`mutation { updateUser(pk_columns: {id: ${graphQLValue(current.user.id)}}, _set: {metadata: ${graphQLValue(metadata)}}) { id } }`)
            if (result.error) return { data: null, error: result.error }
            return { data: { user: { ...current.user, metadata, user_metadata: metadata } }, error: null }
          }
          return { data: null, error: null }
        } catch (error) { return { data: null, error: error instanceof Error ? error : new Error(String(error)) }
        }
      },
      startAutoRefresh: () => {},
      stopAutoRefresh: () => {}
    }
  }

  private createStorageCompat() {
    return {
      from: (bucketId: string) => ({
        upload: async (name: string, body: any, options: any = {}) => {
          try {
            const file = body instanceof Blob ? body : await fetch(body.uri || body).then((response) => response.blob())
            const result = await nhost.storage.uploadFiles({ 'bucket-id': bucketId, 'file[]': [file], 'metadata[]': [{ name, metadata: options.metadata }] })
            if (result.status < 200 || result.status >= 300) return { data: null, error: new Error((result.body as any)?.message || 'Falha ao enviar arquivo para o Nhost.') }
            return { data: { path: result.body.processedFiles[0]?.name || name }, error: null }
          } catch (error) { return { data: null, error: error instanceof Error ? error : new Error(String(error)) } }
        },
        createSignedUrl: async (name: string) => {
          const query = `query { files(where: {bucketId: {_eq: ${graphQLValue(bucketId)}}, name: {_eq: ${graphQLValue(name)}}}, limit: 1) { id } }`
          const files = await this.request(query)
          if (files.error || !files.data?.files?.length) return { data: null, error: files.error || new Error('Arquivo não encontrado no Nhost Storage.') }
          const signed = await nhost.storage.getFilePresignedURL(files.data.files[0].id)
          if (signed.status < 200 || signed.status >= 300) return { data: null, error: new Error('Não foi possível gerar a URL assinada do Nhost Storage.') }
          return { data: { signedUrl: signed.body.url }, error: null }
        },
        remove: async (names: string[]) => {
          const query = `query { files(where: {bucketId: {_eq: ${graphQLValue(bucketId)}}, name: {_in: ${graphQLValue(names)}}}) { id } }`
          const files = await this.request(query)
          if (files.error) return { data: null, error: files.error }
          for (const file of files.data?.files || []) {
            const result = await nhost.storage.deleteFile(file.id)
            if (result.status < 200 || result.status >= 300) return { data: null, error: new Error('Não foi possível remover arquivo do Nhost Storage.') }
          }
          return { data: names.map((name) => ({ name })), error: null }
        }
      })
    }
  }
}

export const nhostCompat = new NhostCompatClient()
