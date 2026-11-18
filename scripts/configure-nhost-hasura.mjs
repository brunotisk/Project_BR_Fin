import pg from 'pg'

const { Pool } = pg
const subdomain = process.env.EXPO_PUBLIC_NHOST_SUBDOMAIN
const region = process.env.EXPO_PUBLIC_NHOST_REGION
const adminSecret = process.env.ADM_SECRET_HASURA_NHOST
const connectionString = process.env.EXPO_CS_NHOST

if (!subdomain || !region || !adminSecret || !connectionString) {
  throw new Error('Configure os endpoints Nhost, ADM_SECRET_HASURA_NHOST e EXPO_CS_NHOST no .env local.')
}

const source = 'default'
const role = 'user'
const endpoint = `https://${subdomain}.hasura.${region}.nhost.run/v1/metadata`

async function metadata(type, args) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-hasura-admin-secret': adminSecret },
    body: JSON.stringify({ type, args }),
    signal: AbortSignal.timeout(90000)
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok || body.code || body.error) {
    throw new Error(`${type} falhou (${response.status}): ${body.error || body.message || JSON.stringify(body)}`)
  }
  return body
}

const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 })
try {
  const [tableResult, fkResult] = await Promise.all([
    pool.query(`
      select t.table_name,
             array_agg(c.column_name order by c.ordinal_position) as columns
      from information_schema.tables t
      join information_schema.columns c using (table_schema, table_name)
      where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
      group by t.table_name order by t.table_name
    `),
    pool.query(`
      select child.relname as table_name, child_ns.nspname as table_schema,
             parent.relname as foreign_table_name, parent_ns.nspname as foreign_table_schema,
             con.conname as constraint_name,
             json_agg(json_build_object('local', child_col.attname, 'remote', parent_col.attname) order by keys.ordinality) as columns
      from pg_constraint con
      join pg_class child on child.oid = con.conrelid
      join pg_namespace child_ns on child_ns.oid = child.relnamespace
      join pg_class parent on parent.oid = con.confrelid
      join pg_namespace parent_ns on parent_ns.oid = parent.relnamespace
      cross join lateral unnest(con.conkey, con.confkey) with ordinality as keys(child_num, parent_num, ordinality)
      join pg_attribute child_col on child_col.attrelid = child.oid and child_col.attnum = keys.child_num
      join pg_attribute parent_col on parent_col.attrelid = parent.oid and parent_col.attnum = keys.parent_num
      where con.contype = 'f' and child_ns.nspname = 'public'
      group by child.relname, child_ns.nspname, parent.relname, parent_ns.nspname, con.conname
      order by child.relname, con.conname
    `)
  ])

  const tables = tableResult.rows.map((row) => ({
    name: row.table_name,
    columns: Array.isArray(row.columns) ? row.columns : row.columns.slice(1, -1).split(',')
  }))
  const exported = await metadata('export_metadata', {})
  const currentSource = exported.sources?.find((item) => item.name === source)
  if (!currentSource) throw new Error('Não encontrei a source PostgreSQL `default` no metadata do Hasura.')
  const tracked = new Set((currentSource.tables || []).map((item) => `${item.table.schema}.${item.table.name}`))
  const commands = []

  for (const table of tables) {
    const tableRef = { schema: 'public', name: table.name }
    if (!tracked.has(`public.${table.name}`)) {
      commands.push({ type: 'pg_track_table', args: { source, table: tableRef } })
    }
  }

  const existingRels = new Map()
  for (const trackedTable of currentSource.tables || []) {
    existingRels.set(`${trackedTable.table.schema}.${trackedTable.table.name}`, new Set([
      ...(trackedTable.object_relationships || []).map((item) => item.name),
      ...(trackedTable.array_relationships || []).map((item) => item.name)
    ]))
  }

  const fkByParent = new Map()
  for (const fk of fkResult.rows) {
    const mappings = Array.isArray(fk.columns) ? fk.columns : JSON.parse(fk.columns)
    const parentKey = `${fk.foreign_table_schema}.${fk.foreign_table_name}`
    const childKey = `${fk.table_schema}.${fk.table_name}`
    if (!fkByParent.has(parentKey)) fkByParent.set(parentKey, [])
    fkByParent.get(parentKey).push({ ...fk, mappings })
    const existing = existingRels.get(childKey) || new Set()
    const sameTarget = fkResult.rows.filter((item) => item.table_schema === fk.table_schema && item.table_name === fk.table_name && item.foreign_table_schema === fk.foreign_table_schema && item.foreign_table_name === fk.foreign_table_name)
    const objectName = sameTarget.length > 1 ? mappings[0].local.replace(/_id$/, '') : fk.foreign_table_name
    if (!existing.has(objectName)) {
      const using = mappings.length === 1
        ? { foreign_key_constraint_on: mappings[0].local }
        : { manual_configuration: {
            remote_table: { schema: fk.foreign_table_schema, name: fk.foreign_table_name },
            column_mapping: Object.fromEntries(mappings.map((item) => [item.local, item.remote]))
          } }
      commands.push({
        type: 'pg_create_object_relationship',
        args: { source, table: { schema: 'public', name: fk.table_name }, name: objectName, using }
      })
      existing.add(objectName)
      existingRels.set(childKey, existing)
    }
  }

  for (const [parentKey, fks] of fkByParent) {
    const [parentSchema, parent] = parentKey.split('.')
    const uniqueChildren = [...new Set(fks.map((item) => item.table_name))]
    for (const child of uniqueChildren) {
      const relName = child
      const existing = existingRels.get(parentKey) || new Set()
      if (existing.has(relName)) continue
      const fk = fks.find((item) => item.table_name === child)
      const using = fk.mappings.length === 1
        ? { foreign_key_constraint_on: { table: { schema: 'public', name: child }, column: fk.mappings[0].local } }
        : { manual_configuration: {
            remote_table: { schema: fk.table_schema, name: child },
            column_mapping: Object.fromEntries(fk.mappings.map((item) => [item.remote, item.local]))
          } }
      commands.push({
        type: 'pg_create_array_relationship',
        args: {
          source,
          table: { schema: parentSchema, name: parent },
          name: relName,
          using
        }
      })
      existing.add(relName)
      existingRels.set(parentKey, existing)
    }
  }

  const sessionId = 'X-Hasura-User-Id'
  const ownerFilter = (table) => {
    if (table.name === 'profiles') return { id: { _eq: sessionId } }
    if (table.name === 'agendas') {
      return { _or: [
        { proprietario_id: { _eq: sessionId } },
        { agenda_membros: { usuario_id: { _eq: sessionId } } }
      ] }
    }
    if (table.name === 'agenda_membros') {
      return { _or: [
        { usuario_id: { _eq: sessionId } },
        { agendas: { proprietario_id: { _eq: sessionId } } },
        { agendas: { agenda_membros: { usuario_id: { _eq: sessionId } } } }
      ] }
    }
    if (table.name === 'agenda_convites') return { convidado_por: { _eq: sessionId } }
    if (table.name === 'organizacao_itens') {
      return { _or: [
        { usuario_id: { _eq: sessionId } },
        { responsavel_id: { _eq: sessionId } },
        { agendas: { agenda_membros: { usuario_id: { _eq: sessionId } } } }
      ] }
    }
    const ownerColumn = table.columns.includes('usuario_id') ? 'usuario_id' : table.columns.includes('proprietario_id') ? 'proprietario_id' : null
    return ownerColumn ? { [ownerColumn]: { _eq: sessionId } } : null
  }

  for (const table of tables) {
    const tableRef = { schema: 'public', name: table.name }
    const filter = ownerFilter(table)
    if (table.name.startsWith('nhost_rpc_')) continue
    if (!filter) throw new Error(`Sem regra de proprietário definida para public.${table.name}; não vou expor essa tabela.`)
    const columns = table.columns
    const existing = (currentSource.tables || []).find((item) => item.table.name === table.name)
    const perms = existing || {}

    if (!(perms.select_permissions || []).some((item) => item.role === role)) {
      commands.push({ type: 'pg_create_select_permission', args: { source, table: tableRef, role, permission: { columns, filter, allow_aggregations: false } } })
    }

    const readOnly = ['agenda_membros', 'agenda_convites'].includes(table.name)
    if (readOnly) continue
    const insertCheck = filter
    if (!(perms.insert_permissions || []).some((item) => item.role === role)) {
      commands.push({ type: 'pg_create_insert_permission', args: { source, table: tableRef, role, permission: { columns, check: insertCheck } } })
    }
    if (!(perms.update_permissions || []).some((item) => item.role === role)) {
      const updateColumns = columns.filter((column) => column !== 'id')
      commands.push({ type: 'pg_create_update_permission', args: { source, table: tableRef, role, permission: { columns: updateColumns, filter, check: filter } } })
    }
    if (!(perms.delete_permissions || []).some((item) => item.role === role)) {
      commands.push({ type: 'pg_create_delete_permission', args: { source, table: tableRef, role, permission: { filter } } })
    }
  }

  const storageFileTable = currentSource.tables?.find((item) => item.table.schema === 'storage' && item.table.name === 'files')
  if (storageFileTable) {
    const storageFilter = { _and: [
      { uploaded_by_user_id: { _eq: sessionId } },
      { bucket_id: { _eq: 'poker-fotos' } }
    ] }
    const storageColumns = ['id', 'bucket_id', 'name', 'size', 'mime_type', 'etag', 'is_uploaded', 'uploaded_by_user_id', 'metadata']
    if (!(storageFileTable.select_permissions || []).some((item) => item.role === role)) {
      commands.push({ type: 'pg_create_select_permission', args: { source, table: { schema: 'storage', name: 'files' }, role, permission: { columns: storageColumns, filter: storageFilter } } })
    }
    if (!(storageFileTable.insert_permissions || []).some((item) => item.role === role)) {
      commands.push({ type: 'pg_create_insert_permission', args: { source, table: { schema: 'storage', name: 'files' }, role, permission: { columns: storageColumns, check: storageFilter, set: { uploaded_by_user_id: sessionId } } } })
    }
    if (!(storageFileTable.update_permissions || []).some((item) => item.role === role)) {
      commands.push({ type: 'pg_create_update_permission', args: { source, table: { schema: 'storage', name: 'files' }, role, permission: { columns: ['name', 'size', 'mime_type', 'etag', 'is_uploaded', 'metadata'], filter: storageFilter, check: storageFilter } } })
    }
    if (!(storageFileTable.delete_permissions || []).some((item) => item.role === role)) {
      commands.push({ type: 'pg_create_delete_permission', args: { source, table: { schema: 'storage', name: 'files' }, role, permission: { filter: storageFilter } } })
    }
  }

  const authUsersTable = currentSource.tables?.find((item) => item.table.schema === 'auth' && item.table.name === 'users')
  if (authUsersTable && !(authUsersTable.update_permissions || []).some((item) => item.role === role)) {
    const ownUser = { id: { _eq: sessionId } }
    commands.push({
      type: 'pg_create_update_permission',
      args: { source, table: { schema: 'auth', name: 'users' }, role, permission: { columns: ['metadata'], filter: ownUser, check: ownUser } }
    })
  }

  const functionTypes = [
    ['nhost_listar_membros_agenda', 'query'],
    ['nhost_listar_convites_recebidos', 'query'],
    ['nhost_convidar_para_agenda', 'mutation'],
    ['nhost_aceitar_convite_agenda', 'mutation'],
    ['nhost_atualizar_cor_agendas', 'mutation'],
    ['nhost_criar_transacao_parcelada_cartao', 'mutation'],
    ['nhost_excluir_sessao_poker', 'mutation'],
    ['nhost_salvar_sessao_poker', 'mutation'],
    ['nhost_excluir_local_sessao_poker', 'mutation']
  ]
  const trackedFunctions = new Set((currentSource.functions || []).map((item) => item.function?.name || item.name))
  for (const [name, exposedAs] of functionTypes) {
    const functionRef = { schema: 'public', name }
    if (!trackedFunctions.has(name)) {
      commands.push({ type: 'pg_track_function', args: { source, function: functionRef, configuration: { exposed_as: exposedAs } } })
    }
    const existingFunction = (currentSource.functions || []).find((item) => (item.function?.name || item.name) === name)
    if (!(existingFunction?.permissions || []).some((item) => item.role === role)) {
      commands.push({ type: 'pg_create_function_permission', args: { source, function: functionRef, role } })
    }
  }

  if (commands.length) {
    const batchSize = 8
    for (let i = 0; i < commands.length; i += batchSize) {
      const batch = commands.slice(i, i + batchSize)
      await metadata('bulk', batch)
      console.log(`Hasura metadata: ${Math.min(i + batch.length, commands.length)}/${commands.length} operações.`)
    }
    console.log(`Hasura atualizado: ${tables.length} tabelas da aplicação, ${commands.length} operações de metadata.`)
  } else {
    console.log('As tabelas e permissões já estão configuradas no Hasura.')
  }
} finally {
  await pool.end()
}
