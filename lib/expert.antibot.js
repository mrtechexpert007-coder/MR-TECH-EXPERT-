// ⟦EXPERT⟧ detectors used by antibot / antigroupstatus (called from core/expert.handler.js)
import { expertHub } from '../core/expert.hub.js'
import { expertNumber } from './expert.utils.js'

// Message types a normal WhatsApp app cannot send — only bots/APIs produce them
const BOT_ONLY_TYPES = ['buttonsMessage', 'listMessage', 'templateMessage', 'interactiveMessage']

/**
 * true when the message looks like it was sent by another bot.
 * Signals: Baileys-style message id (BAE5… / exactly 16 chars) or bot-only message types.
 * Not 100% — a bot that randomizes its ids in a real-client format can slip through.
 */
export function expertLooksLikeBot(msg, content) {
  const id = String(msg?.key?.id || '')
  if (/^BAE5[0-9A-F]{12}$/i.test(id)) return 'baileys-id'            // old Baileys (16 chars)
  if (/^3EB0[0-9A-F]{18}$/i.test(id)) return 'baileys-v2-id'         // Baileys v6.7+/v7 (22 chars) — WhatsApp Web uses 20, so no clash
  if (/^(NJX|SUKI|EXPERT|B1E|FELZ|ATLAS)[-0-9A-Z]*$/i.test(id) && id.length < 32) return 'custom-bot-id'
  if (id.length === 16 && /^[0-9A-Z]+$/i.test(id)) return 'short-id'
  if (id.length < 20 && !/^[0-9A-F]{32}$/i.test(id)) return 'non-wa-id'   // real WhatsApp apps use 20 or 32 chars
  if (content && BOT_ONLY_TYPES.some((t) => content[t])) return 'bot-message-type'
  return null
}

/** true when the sender is one of the accounts linked to THIS bot (never punished by antibot) */
export function expertIsOwnSession(msg) {
  const ids = [msg.key.participant, msg.key.participantAlt].filter(Boolean).map(expertNumber)
  return ids.some((i) => expertHub.sessions.has(i))
}

/** true when the message is a WhatsApp *group status* post (looks for any groupStatus* key a few levels deep) */
export function expertIsGroupStatus(content, ctxInfo) {
  if (!content) return false
  if (ctxInfo?.isGroupStatus) return true
  const seen = new Set()
  const walk = (o, d) => {
    if (!o || typeof o !== 'object' || d > 5 || seen.has(o)) return false
    seen.add(o)
    for (const k of Object.keys(o)) {
      if (/^groupStatus/i.test(k) && o[k]) return true
      if (k === 'isGroupStatus' && o[k] === true) return true
      const v = o[k]
      if (v && typeof v === 'object' && !(v instanceof Uint8Array) && walk(v, d + 1)) return true
    }
    return false
  }
  return walk(content, 0)
      }
