import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const { Pool } = pg
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sql = await fs.readFile(path.join(root, 'nhost', 'migrations', '002_rpc_wrappers.sql'), 'utf8')
if (!process.env.EXPO_CS_NHOST) throw new Error('EXPO_CS_NHOST não está definido no .env.')
const pool = new Pool({ connectionString: process.env.EXPO_CS_NHOST, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 })
try {
  await pool.query('begin')
  await pool.query(sql)
  await pool.query('commit')
  console.log('Wrappers GraphQL das RPCs aplicados.')
} catch (error) {
  await pool.query('rollback').catch(() => {})
  console.error(`Migration de RPCs revertida: ${error.message}`)
  process.exitCode = 1
} finally {
  await pool.end()
}
