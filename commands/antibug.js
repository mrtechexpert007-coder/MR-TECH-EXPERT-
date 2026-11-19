// ⟦EXPERT⟧ .antibug — toggle protection against known crash-bug payloads
import { expertGet, expertSet } from '../lib/expert.store.js'

// ─── Known crash-bug signatures ───
// Each entry: { name, test(msg) -> boolean }
const BUG_SIGNATURES = [
  {
    name: 'stickerPack overflow',
    test: (m) => {
      const sp = m.stickerPackMessage
      if (!sp) return false
      if (sp.name && sp.name.length > 5000) return true
      if (Array.isArray(sp.stickers) && sp.stickers.length > 1000) return true
      if (sp.publisher && sp.publisher.length > 5000) return true
      return false
    }
  },
  {
    name: 'interactive button overflow',
    test: (m) => {
      const im = m.interactiveMessage
      if (!im) return false
      const nfm = im.nativeFlowMessage
      if (!nfm) return false
      const b = nfm.buttons
      if (Array.isArray(b) && b.length > 200) return true
      if (typeof nfm.messageParamsJson === 'string' && nfm.messageParamsJson.length > 10000) return true
      return false
    }
  },
  {
    // normal group-status posts are fine (use .antigroupstatus for those) — only absurdly large payloads count
    name: 'groupStatus overflow',
    test: (m) => {
      const g = m.groupStatusMessageV2 || m.groupStatusMessage
      if (!g) return false
      return JSON.stringify(g, (k, v) => (v instanceof Uint8Array ? v.length : v)).length > 20000
    }
  },
  {
    name: 'music attribution overflow',
    test: (m) => {
      const walk = (obj, depth = 0) => {
        if (!obj || depth > 6) return false
        if (obj.statusAttributions && Array.isArray(obj.statusAttributions)) {
          for (const a of obj.statusAttributions) {
            const t = a?.music?.title
            const au = a?.music?.author
            if ((t && t.length > 2000) || (au && au.length > 2000)) return true
          }
        }
        if (typeof obj === 'object') {
          for (const k of Object.keys(obj)) {
            if (walk(obj[k], depth + 1)) return true
          }
        }
        return false
      }
      return walk(m)
    }
  },
  {
    name: 'album message overflow',
    test: (m) => {
      const walk = (obj, depth = 0) => {
        if (!obj || depth > 6) return false
        if (obj.albumMessage) {
          const a = obj.albumMessage
          if ((a.expectedImageCount || 0) > 100 || (a.expectedVideoCount || 0) > 100) return true
        }
        if (typeof obj === 'object') {
          for (const k of Object.keys(obj)) {
            if (walk(obj[k], depth + 1)) return true
          }
        }
        return false
      }
      return walk(m)
    }
  },
  {
    name: 'placeholder mask injection',
    test: (m) => m.placeholderMessage?.type === 'MASK_LINKED_DEVICES'
  },
  {
    name: 'button array with empty objects',
    test: (m) => {
      const im = m.interactiveMessage
      const b = im?.nativeFlowMessage?.buttons
      if (!Array.isArray(b)) return false
      let emptyCount = 0
      for (const btn of b) {
        if (btn && typeof btn === 'object' && Object.keys(btn).length === 0) emptyCount++
      }
      return emptyCount > 50
    }
  }
]

// ─── Scan a message for any known bug ───
function detectBug(message) {
  if (!message) return null
  for (const sig of BUG_SIGNATURES) {
    try {
      if (sig.test(message)) return sig.name
    } catch {}
  }
  return null
}

export default {
  name: 'antibug',
  aliases: ['antifreeze', 'antistickerbug'],
  desc: 'Block known crash-bug payloads (per-chat toggle)',
  async run(z) {
    await z.react('🛡️').catch(() => {})
    try {
      const opt = (z.args?.[0] || '').toLowerCase()
      const key = 'antibug'
      if (z.isGroup && ['on', 'off'].includes(opt) && !z.isAdmin) return z.reply('⛔ Group admins only.')

      if (opt === 'on') {
        expertSet(z.jid, key, true)
        return z.reply('🛡️ *ANTIBUG ON*\nKnown crash payloads will be auto-deleted in this chat.')
      }

      if (opt === 'off') {
        expertSet(z.jid, key, false)
        return z.reply('🛡️ *ANTIBUG OFF*\nCrash payloads will no longer be blocked here.')
      }

      if (opt === 'test') {
        const fakes = [
          { stickerPackMessage: { name: 'A'.repeat(10000), stickers: [] } },
          { interactiveMessage: { nativeFlowMessage: { buttons: new Array(500) } } },
          { groupStatusMessageV2: { message: { conversation: 'A'.repeat(30000) } } },
          { placeholderMessage: { type: 'MASK_LINKED_DEVICES' } },
          { stickerPackMessage: { stickers: new Array(5000) } }
        ]
        const results = fakes.map((f, i) => {
          const hit = detectBug(f)
          return `${i + 1}. ${hit || '✅ clean'}`
        })
        return z.reply(`🛡️ *ANTIBUG SELF-TEST*\n\n${results.join('\n')}`)
      }

      const status = expertGet(z.jid, key, false)
      return z.reply(
        `🛡️ *ANTIBUG*\n\n` +
        `Status: ${status ? '🟢 ON' : '🔴 OFF'}\n\n` +
        `*Usage:*\n` +
        `• ${z.prefix}antibug on — enable\n` +
        `• ${z.prefix}antibug off — disable\n` +
        `• ${z.prefix}antibug test — run self-test\n\n` +
        `*Blocks:*\n` +
        `• sticker pack name overflow\n` +
        `• interactive button floods\n` +
        `• group status freeze payloads\n` +
        `• music attribution overflow\n` +
        `• album message overflows\n` +
        `• placeholder mask injections`
      )
    } catch (e) {
      console.error('[antibug]', e)
      await z.reply(`❌ *Antibug failed*\n${e.message}`)
      await z.react('❌').catch(() => {})
    }
  }
}

// ─── The scanner — the router (core/expert.handler.js) calls this on every incoming message ───
export async function antibugScan(session, msg) {
  if (!msg?.message) return false
  if (!msg.key) return false

  // Walk through wrappers to find the real content
  let cur = msg.message
  for (let i = 0; i < 5 && cur; i++) {
    const inner =
      cur.ephemeralMessage?.message ||
      cur.viewOnceMessage?.message ||
      cur.viewOnceMessageV2?.message ||
      cur.viewOnceMessageV2Extension?.message ||
      cur.documentWithCaptionMessage?.message
    if (!inner) break
    cur = inner
  }

  const hit = detectBug(cur)
  if (!hit) return false

  const jid = msg.key.remoteJid
  if (!jid) return false

  // Only act if enabled for this chat
  const enabled = expertGet(jid, 'antibug', false) || expertGet(session.number, 'antibug', false)
  if (!enabled) return false

  // Delete the message
  try {
    await session.sock.sendMessage(jid, { delete: msg.key })
  } catch (e) {
    console.warn('[antibug] delete failed:', e.message)
  }

  console.log(`🛡️ [antibug] blocked "${hit}" in ${jid} from ${msg.key.participant || jid}`)
  return true
                    }
