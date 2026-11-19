// Distributed session routing for Railway API + worker services.
// A session keeps one owner; failed workers are NOT silently reassigned because
// doing so can start two WhatsApp sockets with the same credentials.
import pg from 'pg'
import { expertLog } from '../lib/expert.utils.js'

export const expertRole = (process.env.ROLE || 'combined').toLowerCase()
const workerId = process.env.WORKER_ID || `worker-${process.env.RAILWAY_SERVICE_ID || process.pid}`
const publicUrl = (process.env.PUBLIC_URL || process.env.RAILWAY_PUBLIC_DOMAIN || '').replace(/\/$/, '')
const secret = process.env.INTERNAL_API_SECRET || ''
let pool
let heartbeatTimer

export async function expertClusterInit() {
  if (!process.env.DATABASE_URL) {
    if (expertRole !== 'combined') throw new Error('DATABASE_URL is required when ROLE=api or ROLE=worker')
    return
  }
  const url = process.env.DATABASE_URL
  const ssl = /rlwy\.net|proxy|amazonaws\.com|heroku/.test(url) || process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined
  pool = new pg.Pool({ connectionString: url, ssl, max: 5 })
  await pool.query(`create table if not exists expert_workers (
    worker_id text primary key, base_url text not null, status text not null default 'online',
    capacity integer not null default 50, last_seen timestamptz not null default now(), created_at timestamptz not null default now())`)
  await pool.query(`create table if not exists expert_assignments (
    session text primary key, worker_id text not null, state text not null default 'assigned',
    created_at timestamptz not null default now(), updated_at timestamptz not null default now())`)
  if (expertRole === 'worker') {
    if (!publicUrl) throw new Error('PUBLIC_URL (the worker service URL) is required when ROLE=worker')
    await beat()
    heartbeatTimer = setInterval(() => beat().catch(e => expertLog.err('worker heartbeat: ' + e.message)), 15000)
    heartbeatTimer.unref?.()
    expertLog.ok(`cluster worker ${workerId} registered`)
  }
}
async function beat() {
  if (!pool) return
  await pool.query(`insert into expert_workers(worker_id,base_url,status,capacity,last_seen)
    values($1,$2,'online',$3,now()) on conflict(worker_id) do update set base_url=excluded.base_url,status='online',capacity=excluded.capacity,last_seen=now()`,
    [workerId, publicUrl, Number(process.env.MAX_SESSIONS) || 50])
}
export async function expertRouteForSession(number) {
  if (!pool) throw new Error('PostgreSQL is required for distributed routing')
  const existing = await pool.query(`select a.worker_id,w.base_url,w.last_seen from expert_assignments a left join expert_workers w using(worker_id) where a.session=$1`, [number])
  if (existing.rows[0]) {
    const r = existing.rows[0]
    if (!r.base_url || Date.now() - new Date(r.last_seen || 0).getTime() > 45000) throw new Error('This session’s assigned worker is offline. Its assignment is preserved to prevent duplicate WhatsApp connections.')
    return r.base_url
  }
  const client = await pool.connect()
  try {
    await client.query('begin')
    const workers = await client.query(`select w.worker_id,w.base_url,count(a.session)::int as sessions,w.capacity
      from expert_workers w left join expert_assignments a using(worker_id)
      where w.status='online' and w.last_seen > now() - interval '45 seconds'
      group by w.worker_id,w.base_url,w.capacity having count(a.session) < w.capacity
      order by count(a.session),w.worker_id limit 1`)
    if (!workers.rows[0]) throw new Error('No available worker is online. Please try again shortly.')
    const w = workers.rows[0]
    await client.query(`insert into expert_assignments(session,worker_id,state) values($1,$2,'assigned') on conflict(session) do nothing`, [number,w.worker_id])
    const actual = await client.query(`select a.worker_id,w.base_url,w.last_seen from expert_assignments a left join expert_workers w using(worker_id) where a.session=$1`, [number])
    await client.query('commit')
    const r = actual.rows[0]
    if (!r?.base_url || Date.now() - new Date(r.last_seen || 0).getTime() > 45000) throw new Error('Assigned worker is not available; retry shortly.')
    return r.base_url
  } catch (e) { await client.query('rollback').catch(()=>{}); throw e }
  finally { client.release() }
}
export async function expertProxyToWorker(number, endpoint, options = {}) {
  const base = await expertRouteForSession(number)
  const headers = { ...(options.headers || {}) }
  if (secret) headers['x-expert-internal-secret'] = secret
  const response = await fetch(`${base}${endpoint}`, { method: options.method || 'GET', headers, body: options.body, signal: AbortSignal.timeout(20000) })
  const body = await response.text()
  return { status: response.status, body, contentType: response.headers.get('content-type') || 'application/json' }
}
export function expertInternalAuthorized(req) {
  if (!secret) return false
  return req.headers['x-expert-internal-secret'] === secret
}
export async function expertClusterClose() {
  if (heartbeatTimer) clearInterval(heartbeatTimer)
  if (pool) {
    if (expertRole === 'worker') await pool.query("update expert_workers set status='offline',last_seen=now() where worker_id=$1", [workerId]).catch(()=>{})
    await pool.end().catch(()=>{})
  }
}
export async function expertOwnedSessions(numbers) {
  if (expertRole !== 'worker' || !pool) return numbers
  const { rows } = await pool.query('select session from expert_assignments where worker_id=$1', [workerId])
  const owned = new Set(rows.map(r => r.session))
  return numbers.filter(n => owned.has(n))
        }
