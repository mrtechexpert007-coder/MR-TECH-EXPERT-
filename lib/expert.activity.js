// ⟦EXPERT⟧ group activity tracker + shared helpers for the group-feature commands
import { expertGet, expertSet } from './expert.store.js'
import { expertNumber } from './expert.utils.js'
import { expertCtx, expertQuoted } from './expert.admin.js'

// ── participants ──
export const expertPIds = (p) => [p.id, p.phoneNumber, p.lid].filter(Boolean).map(expertNumber)
export const expertIsAdm = (p) => p?.admin === 'admin' || p?.admin === 'superadmin'
export const expertMention = (p) => p.phoneNumber || p.id
export const expertTag = (p) => `@${expertNumber(expertMention(p))}`
export function expertIsBot(z, p) {
  const me = [z.sock.user?.id, z.sock.user?.lid].filter(Boolean).map(expertNumber)
  return expertPIds(p).some((i) => me.includes(i))
}
// every number a person is known by (phone + LID)
export async function expertAliases(z, jid) {
  const num = expertNumber(jid)
  const out = new Set([num])
  if (z.isGroup) {
    try {
      const meta = await z.sock.groupMetadata(z.jid)
      const p = meta.participants.find((x) => expertPIds(x).includes(num))
      if (p) expertPIds(p).forEach((i) => out.add(i))
    } catch {}
  }
  return [...out]
}

// ── time ──
export const expertTz = (ns, gid) => expertGet(ns, `tz:${gid}`, 'Africa/Lagos')
export const expertDay = (ts = Date.now(), tz = 'UTC') =>
  new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ts)
export function expertDayShift(day, n) {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
function tzOffset(ts, tz) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' })
  const o = {}
  for (const p of f.formatToParts(new Date(ts))) o[p.type] = p.value
  return Date.UTC(+o.year, +o.month - 1, +o.day, +o.hour, +o.minute, +o.second) - Math.floor(ts / 1000) * 1000
}
// wall-clock time in a timezone → epoch ms
export function expertZoned(y, m, d, hh, mm, tz) {
  const guess = Date.UTC(y, m - 1, d, hh, mm)
  let t = guess - tzOffset(guess, tz)
  t = guess - tzOffset(t, tz)
  return t
}
export const expertFmt = (ts, tz) =>
  new Date(ts).toLocaleString('en-GB', { timeZone: tz, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
export function expertDur(ms) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60)
  if (d) return `${d}d ${h}h`
  if (h) return `${h}h ${m}m`
  if (m) return `${m}m`
  return `${s}s`
}
export function expertParseDur(str = '') {
  const m = String(str).trim().toLowerCase().match(/^(\d+)\s*(s|m|h|d)?$/)
  if (!m) return null
  return Number(m[1]) * { s: 1000, m: 60000, h: 3600000, d: 86400000 }[m[2] || 'm']
}

// ── activity tracking (in memory, flushed to the store every 30s) ──
const cache = new Map()
const dirty = new Set()
const K = (ns, gid) => `${ns}|${gid}`

export function expertActivity(ns, gid) {
  const k = K(ns, gid)
  if (!cache.has(k)) cache.set(k, expertGet(ns, `act:${gid}`, null) || { since: Date.now(), users: {} })
  return cache.get(k)
}
export function expertTrack(ns, gid, jid, pn) {
  const a = expertActivity(ns, gid)
  const id = expertNumber(jid)
  const u = (a.users[id] ??= { jid, total: 0, days: {} })
  u.jid = jid
  if (pn) u.pn = pn
  u.total++
  u.last = Date.now()
  const day = expertDay(u.last, expertTz(ns, gid))
  u.days[day] = (u.days[day] || 0) + 1
  const ds = Object.keys(u.days)
  if (ds.length > 60) delete u.days[ds.sort()[0]]
  dirty.add(K(ns, gid))
}
export function expertFlush() {
  for (const k of dirty) {
    const [ns, ...rest] = k.split('|')
    const gid = rest.join('|')
    try { expertSet(ns, `act:${gid}`, cache.get(k)) } catch {}
  }
  dirty.clear()
}
setInterval(expertFlush, 30000).unref?.()

export function expertEntryFor(a, p) {
  const ids = expertPIds(p)
  for (const [id, u] of Object.entries(a.users)) {
    if (ids.includes(id) || (u.pn && ids.includes(expertNumber(u.pn)))) return u
  }
  return null
}
export function expertCount(u, days, tz) {
  if (!u) return 0
  if (days === Infinity) return u.total
  const start = expertDayShift(expertDay(Date.now(), tz), -(days - 1))
  let n = 0
  for (const [d, c] of Object.entries(u.days)) if (d >= start) n += c
  return n
}
export const EXPERT_PERIODS = { today: 1, week: 7, month: 30, all: Infinity }

// ── replied-message helpers ──
export function expertQuotedKey(z) {
  const c = expertCtx(z)
  if (!c?.stanzaId) return null
  const me = [z.sock.user?.id, z.sock.user?.lid].filter(Boolean).map(expertNumber)
  const author = c.participant ? expertNumber(c.participant) : ''
  return { remoteJid: z.jid, fromMe: !!author && me.includes(author), id: c.stanzaId, ...(z.isGroup && c.participant ? { participant: c.participant } : {}) }
}
export function expertQuotedText(z) {
  const q = expertQuoted(z)
  if (!q) return ''
  return q.conversation || q.extendedTextMessage?.text || Object.values(q).find((v) => v && typeof v === 'object' && v.caption)?.caption || ''
}
