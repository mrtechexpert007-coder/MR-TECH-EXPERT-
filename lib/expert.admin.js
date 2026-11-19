// ⟦EXPERT⟧ shared helpers for group/admin/media commands
import { expertNumber } from './expert.utils.js'

const pIds = (p) => [p.id, p.phoneNumber, p.lid].filter(Boolean).map(expertNumber)
const isAdm = (p) => p?.admin === 'admin' || p?.admin === 'superadmin'

// peel ephemeral / view-once wrappers
export function expertUnwrap(m) {
  let cur = m
  for (let i = 0; i < 5 && cur; i++) {
    const inner = cur.ephemeralMessage?.message || cur.viewOnceMessage?.message ||
      cur.viewOnceMessageV2?.message || cur.viewOnceMessageV2Extension?.message ||
      cur.documentWithCaptionMessage?.message
    if (!inner) break
    cur = inner
  }
  return cur
}

// contextInfo of the command message (works for text, image captions, etc.)
export function expertCtx(z) {
  const m = expertUnwrap(z.msg.message) || {}
  return Object.values(m).find((v) => v && typeof v === 'object' && v.contextInfo)?.contextInfo
}

// the message the command replied to (unwrapped), or null
export function expertQuoted(z) {
  const q = expertCtx(z)?.quotedMessage
  return q ? expertUnwrap(q) : null
}

// members mentioned in the command or replied to
export function expertTargets(z) {
  const c = expertCtx(z)
  return [...new Set([...(c?.mentionedJid || []), ...(c?.participant ? [c.participant] : [])])]
}

// group metadata + whether the sender is an admin (z.isAdmin / z.groupMeta are filled in by the handler before each command)
export async function expertGroup(z) {
  const meta = z.groupMeta || await z.sock.groupMetadata(z.jid)
  if (typeof z.isAdmin === 'boolean') return { meta, senderAdmin: z.isAdmin, isAdm }
  const sender = expertNumber(z.sender)
  const senderP = meta.participants.find((p) => pIds(p).includes(sender))
  return { meta, senderAdmin: z.isOwner || isAdm(senderP), isAdm }
}

// standard guard: group only + sender admin. The bot's own admin status is NOT pre-checked — WhatsApp decides. Returns the group info or null.
export async function expertGuard(z) {
  if (!z.isGroup) { await z.reply('👥 Groups only.'); return null }
  const g = await expertGroup(z)
  if (!g.senderAdmin) { await z.reply('⛔ Group admins only.'); return null }
  return g
}

// download any media message → { buffer, type, content }
export async function expertDownload(content) {
  const { downloadContentFromMessage } = await import('@rennzsync/baileys')
  const type = content && Object.keys(content).find((k) => /^(image|video|audio|sticker|document)Message$/.test(k))
  if (!type) return null
  const stream = await downloadContentFromMessage(content[type], type.replace('Message', '').toLowerCase())
  const chunks = []
  for await (const c of stream) chunks.push(c)
  return { buffer: Buffer.concat(chunks), type, content: content[type] }
}

// media from the replied message, or from the command message itself (image + caption)
export async function expertGetMedia(z) {
  const src = expertQuoted(z) || expertUnwrap(z.msg.message)
  return expertDownload(src)
}

export const expertHttp = async (url, opts = {}) => {
  const r = await fetch(url, { signal: AbortSignal.timeout(15000), ...opts })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r
}
