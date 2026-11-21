// ⟦EXPERT⟧ buttons — classic buttonsMessage via the RennZSync fork
import fs from 'node:fs'
import { expertBuildButtons, expertSendClassic, expertGenMsg, expertPrepMedia, expertProto } from './expert.baileys.js'
import { expertCfg } from '../config/expert.config.js'
import { expertLog } from '../lib/expert.utils.js'

const thumbCache = new Map()
const urlCache = new Map()

// ─── Resolve any image source: file path, URL, or data URI ───
function readThumb(src) {
  if (!src) return null
  // Data URI → decode to buffer
  if (/^data:image\//i.test(src)) {
    try {
      const base64 = src.split(',')[1]
      return Buffer.from(base64, 'base64')
    } catch { return null }
  }
  // URL → return string, caller will fetch
  if (/^https?:\/\//i.test(src)) return src
  // File path → read from disk
  if (!thumbCache.has(src)) {
    try { thumbCache.set(src, fs.readFileSync(src)) }
    catch { thumbCache.set(src, null) }
  }
  return thumbCache.get(src)
}

// ─── Download a URL to a Buffer (cached) ───
async function fetchThumbBuffer(url) {
  if (urlCache.has(url)) return urlCache.get(url)
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(10000)
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())
    urlCache.set(url, buf)
    return buf
  } catch (e) {
    expertLog.warn(`thumb fetch failed: ${url} — ${e.message}`)
    urlCache.set(url, null)
    return null
  }
}

// ─── Unified resolver: always returns a Buffer or null ───
async function resolveImage(src) {
  if (!src) return null
  const resolved = readThumb(src)
  if (typeof resolved === 'string') {
    // URL → download
    return await fetchThumbBuffer(resolved)
  }
  return resolved
}

/**
 * expert.buttons({ text, footer?, buttons, header?: { thumb, title, subtitle }, image })
 * header.thumb and image accept: file path, https URL, or data URI.
 * Button kinds: { id, text } quick reply · { url, text } link · { sections, text } list · { copy, text } copy-to-clipboard
 */
export async function expertSendButtons(expert, { text, footer = expertCfg.footer, buttons = [], header, image }) {
  // native flow (url / list / copy buttons) inaruhusu batani hadi 5; classic buttons ni 3 tu
  const native = buttons.some((b) => b.url || b.sections || b.copy)
  let list = buttons.slice(0, native ? 5 : 3)

  if (native) {
    if (await sendNativeFlow(expert, { text, footer, buttons: list, image })) return true
    // fallback ya classic buttons (3 tu): list → `.menu all`, url → `.channel`
    const p = expertCfg.prefixes[0]
    // copy buttons can't exist as classic buttons → put the code in the text instead
    const copies = list.filter((b) => b.copy)
    if (copies.length) text = `${text}\n\n${copies.map((b) => `${b.text}: *${b.copy}*`).join('\n')}`
    list = list
      .filter((b) => !b.copy)
      .map((b) => (b.sections ? { id: `${p}menu all`, text: b.text } : b.url ? { id: `${p}channel`, text: b.text } : b))
      .filter((b, i, a) => a.findIndex((x) => x.id === b.id) === i) // HELP + CHANNEL both → .channel: keep one so CONNECT BOT isn't cut
      .slice(0, 3)
  }

  try {
    const opts = {
      text,
      footer,
      buttons: list.map((b) => ({ buttonId: b.id, buttonText: b.text }))
    }

    if (header?.thumb) {
      const thumbBuf = await resolveImage(header.thumb)
      if (thumbBuf) {
        opts.locationMessage = {
          jpegThumbnail: thumbBuf,
          name: header.title || expertCfg.botName,
          address: header.subtitle || expertCfg.engraved
        }
      }
    }

    await expertSendClassic(expert.sock, expert.jid, expertBuildButtons(opts))
    return true
  } catch (e) {
    expertLog.warn(`buttons failed, using fallback: ${e?.message || e}`)
    const p = expertCfg.prefixes[0]
    const hint = list.map((b) => `• ${b.id.startsWith(p) ? b.id : p + b.id} — ${b.text}`).join('\n')
    const body = `${text}\n\n${hint}\n\n_${footer}_`

    if (image) {
      try {
        const buf = await resolveImage(image)
        if (buf) {
          await expert.sock.sendMessage(expert.jid, { image: buf, caption: body }, { quoted: expert.msg })
          return false
        }
      } catch (err) {
        expertLog.warn(`image fallback failed: ${err?.message || err}`)
      }
    }
    await expert.sock.sendMessage(expert.jid, { text: body }, { quoted: expert.msg })
    return false
  }
}

export async function expertSendUrlButton(expert, { text, footer = expertCfg.footer, label, url }) {
  try {
    if (typeof expertGenMsg !== 'function') throw new Error('generateWAMessageFromContent not exported by fork')
    const sock = expert.sock
    const content = {
      viewOnceMessage: {
        message: {
          messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
          interactiveMessage: expertProto.Message.InteractiveMessage.create({
            body: { text },
            footer: { text: footer },
            header: { title: '', hasMediaAttachment: false },
            nativeFlowMessage: {
              buttons: [{
                name: 'cta_url',
                buttonParamsJson: JSON.stringify({ display_text: label, url, merchant_url: url })
              }]
            }
          })
        }
      }
    }
    const msg = expertGenMsg(expert.jid, content, { quoted: expert.msg, userJid: sock.user?.id })
    await sock.relayMessage(expert.jid, msg.message, { messageId: msg.key.id })
    return true
  } catch (e) {
    expertLog.warn(`url button failed: ${e?.message || e}`)
    return false
  }
}

async function sendNativeFlow(expert, { text, footer, buttons, image }) {
  try {
    if (typeof expertGenMsg !== 'function') throw new Error('generateWAMessageFromContent not exported by fork')
    const sock = expert.sock
    let hdr = { title: '', hasMediaAttachment: false }

    if (image) {
      const buf = await resolveImage(image)
      if (buf && typeof expertPrepMedia === 'function') {
        try {
          const media = await expertPrepMedia({ image: buf }, { upload: sock.waUploadToServer })
          hdr = { title: '', hasMediaAttachment: true, imageMessage: media.imageMessage }
        } catch (e) { expertLog.warn(`menu image header skipped: ${e?.message || e}`) }
      }
    }

    const content = {
      viewOnceMessage: {
        message: {
          messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
          interactiveMessage: expertProto.Message.InteractiveMessage.create({
            body: { text },
            footer: { text: footer },
            header: hdr,
            nativeFlowMessage: {
              buttons: buttons.map((b) => b.sections
                ? { name: 'single_select', buttonParamsJson: JSON.stringify({ title: b.text, sections: b.sections }) }
                : b.copy
                  ? { name: 'cta_copy', buttonParamsJson: JSON.stringify({ display_text: b.text, id: `copy_${Date.now()}`, copy_code: String(b.copy) }) }
                  : b.url
                  ? { name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: b.text, url: b.url, merchant_url: b.url }) }
                  : { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: b.text, id: b.id }) })
            }
          })
        }
      }
    }
    const msg = expertGenMsg(expert.jid, content, { quoted: expert.msg, userJid: sock.user?.id })
    await sock.relayMessage(expert.jid, msg.message, { messageId: msg.key.id })
    return true
  } catch (e) {
    expertLog.warn(`native-flow buttons failed: ${e?.message || e}`)
    return false
  }
              }
