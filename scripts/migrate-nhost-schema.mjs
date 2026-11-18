import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const { Pool } = pg
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const migrationsDir = path.join(root, 'supabase', 'migrations')

function splitSqlStatements(sql) {
  const statements = []
  let current = ''
  let singleQuoted = false
  let doubleQuoted = false
  let lineComment = false
  let blockComment = false
  let dollarTag = null

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i]
    const next = sql[i + 1]

    if (lineComment) {
      current += char
      if (char === '\n') lineComment = false
      continue
    }
    if (blockComment) {
      current += char
      if (char === '*' && next === '/') {
        current += next
        i += 1
        blockComment = false
      }
      continue
    }
    if (dollarTag) {
      if (sql.startsWith(dollarTag, i)) {
        current += dollarTag
        i += dollarTag.length - 1
        dollarTag = null
      } else current += char
      continue
    }
    if (!singleQuoted && !doubleQuoted && char === '-' && next === '-') {
      current += '--'
      i += 1
      lineComment = true
      continue
    }
    if (!singleQuoted && !doubleQuoted && char === '/' && next === '*') {
      current += '/*'
      i += 1
      blockComment = true
      continue
    }
    if (!singleQuoted && !doubleQuoted && char === '$') {
      const match = sql.slice(i).match(/^\$[A-Za-z_][A-Za-z_0-9]*\$|^\$\$/)
      if (match) {
        dollarTag = match[0]
        current += dollarTag
        i += dollarTag.length - 1
        continue
      }
    }
    if (char === "'" && !doubleQuoted) {
      current += char
      if (singleQuoted && next === "'") {
        current += next
        i += 1
      } else singleQuoted = !singleQuoted
      continue
    }
    if (char === '"' && !singleQuoted) {
      current += char
      if (doubleQuoted && next === '"') {
        current += next
        i += 1
      } else doubleQuoted = !doubleQuoted
      continue
    }
    if (char === ';' && !singleQuoted && !doubleQuoted) {
      if (current.trim()) statements.push(current.trim())
      current = ''
      continue
    }
    current += char
  }
  if (current.trim()) statements.push(current.trim())
  return statements
}

function stripLeadingComments(sql) {
  let value = sql.trim()
  while (value.startsWith('--') || value.startsWith('/*')) {
    if (value.startsWith('--')) {
      const newline = value.indexOf('\n')
      value = newline < 0 ? '' : value.slice(newline + 1).trimStart()
    } else {
      const end = value.indexOf('*/')
      value = end < 0 ? '' : value.slice(end + 2).trimStart()
    }
  }
  return value
}

function adaptStatement(statement) {
  let sql = statement.replaceAll('raw_user_meta_data', 'metadata')
  const normalized = stripLeadingComments(sql)

  // Nhost Storage uses storage.files and its own bucket permissions, not Supabase storage.objects RLS.
  if (/^(create|drop)\s+policy\b/i.test(normalized) && /\bon\s+storage\.objects\b/i.test(normalized)) return null
  if (/^(create|drop)\s+trigger\b/i.test(normalized) && /\bon\s+auth\.users\b/i.test(normalized)) return null
  if (/^insert\s+into\s+storage\.buckets\b/i.test(normalized)) return null
  return sql
}

const connectionString = process.env.EXPO_CS_NHOST
if (!connectionString) throw new Error('EXPO_CS_NHOST não está definido no .env.')

const pool = new Pool({
  connectionString,
  connectionTimeoutMillis: 10000,
  ssl: { rejectUnauthorized: false }
})
const client = await pool.connect()

try {
  const publicTables = await client.query(
    "select count(*)::int as count from information_schema.tables where table_schema='public' and table_type='BASE TABLE'"
  )
  if (publicTables.rows[0].count > 0) {
    throw new Error('O schema public não está vazio; a migration foi interrompida para evitar conflito.')
  }

  const files = (await fs.readdir(migrationsDir)).filter((name) => name.endsWith('.sql')).sort()
  await client.query('begin')
  await client.query('create schema if not exists app_migrations')
  await client.query(`
    create table if not exists app_migrations.applied (
      version text primary key,
      applied_at timestamptz not null default now()
    )
  `)
  await client.query(`
    do $$ begin
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
      if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
    end $$
  `)
  await client.query(`
    create or replace function auth.uid()
    returns uuid language sql stable
    set search_path = pg_catalog, auth
    as $$
      select nullif((nullif(current_setting('hasura.user', true), '')::jsonb)->>'x-hasura-user-id', '')::uuid
    $$
  `)
  await client.query(`
    create or replace function auth.jwt()
    returns jsonb language plpgsql stable security definer
    set search_path = pg_catalog, auth
    as $$
    declare
      claims jsonb := coalesce(nullif(current_setting('hasura.user', true), '')::jsonb, '{}'::jsonb);
      user_email text;
      user_id uuid;
    begin
      user_id := nullif(claims->>'x-hasura-user-id', '')::uuid;
      if user_id is not null then
        select email::text into user_email from auth.users where id = user_id;
        if user_email is not null then claims := claims || jsonb_build_object('email', user_email); end if;
      end if;
      return claims;
    end
    $$
  `)
  await client.query(`
    insert into storage.buckets (id, max_upload_file_size)
    values ('poker-fotos', 20971520)
    on conflict (id) do update set max_upload_file_size = excluded.max_upload_file_size
  `)

  for (const file of files) {
    const alreadyApplied = await client.query('select 1 from app_migrations.applied where version = $1', [file])
    if (alreadyApplied.rowCount) continue
    const contents = await fs.readFile(path.join(migrationsDir, file), 'utf8')
    const statements = splitSqlStatements(contents)
    for (const statement of statements) {
      const adapted = adaptStatement(statement)
      if (adapted) await client.query(adapted)
    }
    await client.query('insert into app_migrations.applied (version) values ($1)', [file])
    console.log(`Applied ${file}`)
  }

  await client.query('commit')
  const count = await client.query("select count(*)::int as count from information_schema.tables where table_schema='public' and table_type='BASE TABLE'")
  console.log(`Schema aplicado. Tabelas públicas: ${count.rows[0].count}.`)
} catch (error) {
  await client.query('rollback').catch(() => {})
  console.error(`Migration revertida: ${error.message}`)
  process.exitCode = 1
} finally {
  client.release()
  await pool.end()
}
