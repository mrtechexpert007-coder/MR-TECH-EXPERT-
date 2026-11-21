
// ⟦EXPERT⟧ single-server totals
import { expertHub } from '../core/expert.hub.js'
import { expertListNumbers } from '../core/expert.auth.js'
import { expertIsRegistered } from '../core/expert.sock.js'

// Only one server
export const EXPERT_SERVERS = [
  'https://hello-5005ba6c5b16.herokuapp.com'
].map((u) => u.replace(/\/$/, ''))

const norm = (u) => String(u || '')
  .replace(/^https?:\/\//, '')
  .replace(/\/$/, '')
  .toLowerCase()

const SELF = norm(
  process.env.PUBLIC_URL ||
  (process.env.HEROKU_APP_NAME
    ? `${process.env.HEROKU_APP_NAME}.herokuapp.com`
    : '')
)

/** 1-based number of THIS server (0 if unknown) */
export const expertSelfIndex = () =>
  SELF ? EXPERT_SERVERS.findIndex((u) => norm(u) === SELF) + 1 : 0

async function localStats() {
  let total = 0

  for (const n of await expertListNumbers()) {
    if (await expertIsRegistered(n)) total++
  }

  const online = [...expertHub.sessions.values()]
    .filter((s) => s.opened).length

  return { total, online }
}

let cache = { at: 0, data: null }

/** Single-server stats — cached 20s */
export async function expertAllStats() {
  if (cache.data && Date.now() - cache.at < 20000) {
    return cache.data
  }

  const url = EXPERT_SERVERS[0]
  let row

  try {
    if (SELF && norm(url) === SELF) {
      row = { name: 'Server 1', ok: true, ...(await localStats()) }
    } else {
      const r = await fetch(`${url}/api/stats`, {
        signal: AbortSignal.timeout(8000)
      })

      if (!r.ok) throw new Error(`HTTP ${r.status}`)

      const j = await r.json()

      row = {
        name: 'Server 1',
        ok: true,
        total: Number(j.total) || 0,
        online: Number(j.online) || 0
      }
    }
  } catch {
    row = {
      name: 'Server 1',
      ok: false,
      total: 0,
      online: 0
    }
  }

  const data = {
    servers: [row],
    total: row.total,
    online: row.online,
    reachable: row.ok ? 1 : 0,
    count: 1
  }

  cache = { at: Date.now(), data }
  return data
}

