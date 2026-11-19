// ⟦EXPERT⟧ auth storage — Postgres when DATABASE_URL is set (Railway/Heroku), else local files
import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'
import { expertAuthState, expertBufferJSON, expertInitCreds, expertProto } from './expert.baileys.js'
import { expertCfg } from '../config/expert.config.js'
import { expertLog } from '../lib/expert.utils.js'

const URL = process.env.DATABASE_URL
export const expertUsingDb = !!URL
let pool = null

const fileDir = (n) => path.join(expertCfg.sessionsDir, n)

export async function expertAuthInit() {
  if (!expertUsingDb) {
    expertLog.warn('DATABASE_URL not set → sessions stored on local disk (lost on redeploy without a volume)')
    return
  }
  // Railway's public proxy and Heroku Postgres need SSL; Railway's private network does not
  const ssl = /rlwy\.net|proxy|amazonaws\.com|heroku/.test(URL) || process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined
  pool = new pg.Pool({ connectionString: URL, ssl, max: 5 })
  await pool.query(`create table if not exists zuko_auth (
    session text not null, key text not null, value text not null,
    primary key (session, key))`)
  await pool.query(`create table if not exists expert_kv (k text primary key, v text not null)`)
  expertLog.ok('sessions stored in Postgres ✔')
}

// round-trip time to Postgres in ms (null when running without a database)
export async function expertDbPing() {
  if (!pool) return null
  const t0 = Date.now()
  await pool.query('select 1')
  return Date.now() - t0
}

// ── key/value (settings) ──────────────────────────────────
export async function expertKvAll() {
  if (!pool) return null
  const { rows } = await pool.query('select k, v from expert_kv')
  return Object.fromEntries(rows.map((r) => [r.k, JSON.parse(r.v)]))
}
export const expertKvPut = (k, v) =>
  pool?.query('insert into expert_kv(k,v) values($1,$2) on conflict (k) do update set v=excluded.v', [k, JSON.stringify(v)])
    .catch((e) => expertLog.err('kv write: ' + e.message))

// ── Postgres-backed Baileys auth state ────────────────────
async function dbAuth(number) {
  // ONE write queue per session: Postgres runs queries on parallel connections, so unqueued
  // upserts can land out of order and leave stale creds/keys behind (→ WhatsApp logs the device out).
  let chain = Promise.resolve()
  const enqueue = (fn) => {
    const run = chain.then(fn)
    chain = run.catch((e) => expertLog.err(`auth write (${number}): ${e.message}`))
    return run
  }
  const put = (key, val) => {
    const json = JSON.stringify(val, expertBufferJSON.replacer) // snapshot NOW, write later
    return enqueue(() => pool.query(
      'insert into zuko_auth(session,key,value) values($1,$2,$3) on conflict (session,key) do update set value=excluded.value',
      [number, key, json]
    ))
  }
  const del = (key) => enqueue(() => pool.query('delete from zuko_auth where session=$1 and key=$2', [number, key]))

  const row = await pool.query("select value from zuko_auth where session=$1 and key='creds'", [number])
  const creds = row.rows[0] ? JSON.parse(row.rows[0].value, expertBufferJSON.reviver) : expertInitCreds()

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          await chain // never read while writes are still pending
          const names = ids.map((id) => `${type}-${id}`)
          const { rows } = await pool.query('select key, value from zuko_auth where session=$1 and key = any($2)', [number, names])
          const found = new Map(rows.map((r) => [r.key, JSON.parse(r.value, expertBufferJSON.reviver)]))
          const out = {}
          for (const id of ids) {
            let v = found.get(`${type}-${id}`)
            if (type === 'app-state-sync-key' && v) v = expertProto.Message.AppStateSyncKeyData.fromObject(v)
            out[id] = v ?? null
          }
          return out
        },
        set: async (data) => {
          const jobs = []
          for (const type in data) for (const id in data[type]) {
            const v = data[type][id]
            jobs.push(v ? put(`${type}-${id}`, v) : del(`${type}-${id}`))
          }
          await Promise.all(jobs)
        }
      }
    },
    saveCreds: () => put('creds', creds)
  }
}

export async function expertAuth(number) {
  if (pool) return dbAuth(number)
  fs.mkdirSync(fileDir(number), { recursive: true })
  return expertAuthState(fileDir(number))
}

export async function expertIsRegistered(number) {
  try {
    if (pool) {
      const { rows } = await pool.query("select value from zuko_auth where session=$1 and key='creds'", [number])
      return !!(rows[0] && JSON.parse(rows[0].value).registered)
    }
    return !!JSON.parse(fs.readFileSync(path.join(fileDir(number), 'creds.json'), 'utf8')).registered
  } catch { return false }
}

export async function expertListNumbers() {
  if (pool) {
    const { rows } = await pool.query("select distinct session from zuko_auth where key='creds'")
    return rows.map((r) => r.session)
  }
  return fs.existsSync(expertCfg.sessionsDir) ? fs.readdirSync(expertCfg.sessionsDir).filter((n) => /^\d{7,15}$/.test(n)) : []
}

export async function expertDeleteAuth(number) {
  if (pool) await pool.query('delete from zuko_auth where session=$1', [number])
  fs.rmSync(fileDir(number), { recursive: true, force: true })
}
