// ⟦EXPERT⟧ all-servers totals — asks every server's /api/stats and adds them up
import { expertHub } from '../core/expert.hub.js'
import { expertListNumbers } from '../core/expert.auth.js'
import { expertIsRegistered } from '../core/expert.sock.js'

// Keep in sync with SERVERS in public/webpair.html (override: SERVER_URLS="url1,url2,...")
export const EXPERT_SERVERS = (process.env.SERVER_URLS
  ? process.env.SERVER_URLS.split(',').map((u) => u.trim()).filter(Boolean)
  : [
    'https://pserver1-f0745103802a.herokuapp.com',
    'https://pserver2-cbafd4933d14.herokuapp.com',
    'https://psrrver3-118cf0a47160.herokuapp.com',
    'https://pserver4-180f6772e03a.herokuapp.com',
    'https://pserver5-cb65079ca276.herokuapp.com',
    'https://pserver6-b11a33bbeb84.herokuapp.com',
    'https://pserver7-5e02c94cb1c9.herokuapp.com',
    'https://pserver8-ea1130cbd24e.herokuapp.com',
    'https://pserver9-7fea5f60b1ac.herokuapp.com',
    'https://pserver10-7c602c8f65b7.herokuapp.com'
  ]).map((u) => u.replace(/\/$/, ''))

const norm = (u) => String(u || '').replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase()
const SELF = norm(process.env.PUBLIC_URL || (process.env.HEROKU_APP_NAME ? `${process.env.HEROKU_APP_NAME}.herokuapp.com` : ''))

/** 1-based number of THIS server in EXPERT_SERVERS (0 if unknown) */
export const expertSelfIndex = () => (SELF ? EXPERT_SERVERS.findIndex((u) => norm(u) === SELF) + 1 : 0)

async function localStats() {
  let total = 0
  for (const n of await expertListNumbers()) if (await expertIsRegistered(n)) total++
  const online = [...expertHub.sessions.values()].filter((s) => s.opened).length
  return { total, online }
}

let cache = { at: 0, data: null }

/** { servers:[{name,total,online,ok}], total, online, reachable, count } — cached 20s */
export async function expertAllStats() {
  if (cache.data && Date.now() - cache.at < 20000) return cache.data
  const rows = await Promise.all(EXPERT_SERVERS.map(async (url, i) => {
    const name = `Server ${i + 1}`
    try {
      if (SELF && norm(url) === SELF) return { name, ok: true, ...(await localStats()) }
      const r = await fetch(`${url}/api/stats`, { signal: AbortSignal.timeout(8000) })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const j = await r.json()
      return { name, ok: true, total: Number(j.total) || 0, online: Number(j.online) || 0 }
    } catch {
      return { name, ok: false, total: 0, online: 0 }
    }
  }))
  const data = {
    servers: rows,
    total: rows.reduce((a, r) => a + r.total, 0),
    online: rows.reduce((a, r) => a + r.online, 0),
    reachable: rows.filter((r) => r.ok).length,
    count: rows.length
  }
  cache = { at: Date.now(), data }
  return data
}
