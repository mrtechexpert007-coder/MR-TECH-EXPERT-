// ⟦EXPERT⟧ per-message group hooks: slowmode, text-only/media-only, activity tracking, AFK notices
import { expertGet, expertSet } from './expert.store.js'
import { expertNumber } from './expert.utils.js'
import { expertUnwrap } from './expert.admin.js'
import { expertCfg } from '../config/expert.config.js'
import { tttPlay } from './expert.ttt.js'
import { expertTrack, expertPIds, expertIsAdm, expertDur, expertTz } from './expert.activity.js'

const lastSent = new Map()   // slowmode: `${gid}|${num}` -> ts
const afkNotified = new Map() // `${gid}|${afkKey}` -> ts

async function isAdminSender(sock, jid, ids) {
  try {
    const meta = await sock.groupMetadata(jid)
    return expertIsAdm(meta.participants.find((p) => expertPIds(p).some((i) => ids.includes(i))))
  } catch { return false }
}

/** returns true when the message was deleted/handled and should not reach commands */
export async function expertGroupHooks({ sock, session, jid, msg }) {
  if (!jid.endsWith('@g.us') || msg.key.fromMe) return false
  const senderJid = msg.key.participant
  if (!senderJid) return false
  const ns = session.number
  const ids = [senderJid, msg.key.participantAlt].filter(Boolean).map(expertNumber)
  const content = expertUnwrap(msg.message) || {}
  const isText = !!(content.conversation || content.extendedTextMessage)
  const isMedia = Object.keys(content).some((k) => /^(image|video|audio|sticker|document)Message$/.test(k))
  const countable = isText || isMedia
  const trusted = ids.some((i) => [ns, expertCfg.owner, ...expertGet(ns, 'sudo', [])].includes(i))

  // ── slowmode + text-only / media-only ──
  const slow = expertGet(ns, `slow:${jid}`, 0)
  const only = expertGet(ns, `only:${jid}`, null)
  if (countable && (slow || only)) {
    const k = `${jid}|${ids[0]}`
    const now = Date.now()
    const tooFast = slow && lastSent.has(k) && now - lastSent.get(k) < slow * 1000
    const wrongType = (only === 'media' && isText) || (only === 'text' && isMedia)
    if (tooFast || wrongType) {
      if (trusted || (await isAdminSender(sock, jid, ids))) lastSent.set(k, now)
      else {
        try { await sock.sendMessage(jid, { delete: msg.key }) } catch {}
        return true
      }
    } else if (slow) lastSent.set(k, now)
  }

  // ── activity tracking ──
  if (countable) expertTrack(ns, jid, senderJid, msg.key.participantAlt)

  // ── Tic-Tac-Toe: a plain "1"–"9" counts as a move when a game is running ──
  const body = (content.conversation || content.extendedTextMessage?.text || '').trim()
  if (/^[1-9]$/.test(body)) await tttPlay(sock, ns, jid, msg, ids, +body - 1).catch(() => {})

  // ── AFK ──
  const afk = expertGet(ns, 'afk', null)
  if (afk && Object.keys(afk).length) {
    const own = Object.entries(afk).find(([, v]) => v.ids.some((i) => ids.includes(i)))
    if (own) {
      const [key, v] = own
      const rest = { ...afk }
      delete rest[key]
      expertSet(ns, 'afk', rest)
      await sock.sendMessage(jid, { text: `👋 Welcome back @${expertNumber(senderJid)}! You were away for *${expertDur(Date.now() - v.since)}*.`, mentions: [senderJid] }, { quoted: msg }).catch(() => {})
      return false
    }
    const ctx = Object.values(content).find((v) => v && typeof v === 'object' && v.contextInfo)?.contextInfo
    const hit = new Set([...(ctx?.mentionedJid || []), ...(ctx?.participant ? [ctx.participant] : [])].map(expertNumber))
    for (const [key, v] of Object.entries(afk)) {
      if (!v.ids.some((i) => hit.has(i))) continue
      const nk = `${jid}|${key}`
      if (Date.now() - (afkNotified.get(nk) || 0) < 300000) continue
      afkNotified.set(nk, Date.now())
      await sock.sendMessage(jid, { text: `💤 @${key} is AFK${v.reason ? `: ${v.reason}` : ''}\n⏱️ Away for ${expertDur(Date.now() - v.since)}`, mentions: [v.jid] }, { quoted: msg }).catch(() => {})
    }
  }
  return false
}
