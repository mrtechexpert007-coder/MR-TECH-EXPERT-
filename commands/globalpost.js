// NEXUS-MD MINI — owner-only global post across all connected sessions.
// Usage: .globalpost on | .globalpost off | .globalpost <text>
// Attach/reply to media to broadcast media with an optional caption.
import { expertGet, expertSet } from '../lib/expert.store.js'
import { expertGetMedia } from '../lib/expert.admin.js'
import { expertNumber, expertSleep } from '../lib/expert.utils.js'
import { expertHub } from '../core/expert.hub.js'
import { expertCfg } from '../config/expert.config.js'

const ENABLED_NS = 'globalpost'
const ENABLED_KEY = 'enabled'
const MAX_DESTINATIONS = 100
const DELAY_MS = 1200

const isGlobalOwner = (z) => expertCfg.owners.includes(expertNumber(z.sender))
const isMediaMessage = (m) => !!m && Object.keys(m).some((k) => /^(image|video|audio|document)Message$/.test(k))

export default {
  name: 'globalpost',
  aliases: ['gpostall'],
  owner: true,
  desc: 'Owner-only global post to groups and Status across connected sessions',
  async run(z) {
    if (!isGlobalOwner(z)) return z.reply('⛔ This command is reserved for the configured bot owner.')

    const raw = String(z.text || '').trim()
    const sub = raw.toLowerCase()
    if (sub === 'on' || sub === 'enable') {
      expertSet(ENABLED_NS, ENABLED_KEY, true)
      return z.reply('✅ GlobalPost is ON. Use `.globalpost Your announcement` to post to eligible groups and WhatsApp Status across connected sessions. Use `.globalpost off` to stop it.')
    }
    if (sub === 'off' || sub === 'disable') {
      expertSet(ENABLED_NS, ENABLED_KEY, false)
      return z.reply('🛑 GlobalPost is OFF. No global posts will be sent until you turn it on again.')
    }
    if (!expertGet(ENABLED_NS, ENABLED_KEY, false)) {
      return z.reply('GlobalPost is OFF. Turn it on first with `.globalpost on`.')
    }

    let media = null
    try { media = await expertGetMedia(z) } catch { /* text-only */ }
    const text = raw
    if (!text && !media && !isMediaMessage(z.msg?.message)) {
      return z.reply('Usage: `.globalpost on`, `.globalpost off`, or `.globalpost Your announcement` (you can attach/reply to media).')
    }

    const payload = media ? makeMediaPayload(media, text) : { text }
    const sessions = [...expertHub.sessions.values()].filter((s) => s?.opened && !s?.closed && s?.sock)
    if (!sessions.length) return z.reply('No connected WhatsApp sessions are available right now.')

    const destinations = []
    for (const session of sessions) {
      let groups = []
      try { groups = Object.values(await session.sock.groupFetchAllParticipating()) } catch { /* session may not support group listing */ }
      for (const group of groups) {
        if (group?.id?.endsWith('@g.us')) destinations.push({ kind: 'group', sock: session.sock, jid: group.id })
      }

      // WhatsApp Status audience: contacts known to this connected account.
      const contacts = session.sock.store?.contacts || session.sock.contacts || {}
      const audience = [...new Set(Object.entries(contacts).map(([key, contact]) => {
        const jid = contact?.id || contact?.jid || key
        return typeof jid === 'string' ? jid : ''
      }).filter((jid) => jid.endsWith('@s.whatsapp.net') || jid.endsWith('@lid')))]
      if (audience.length && (payload.text || payload.image || payload.video || payload.audio || payload.document)) {
        destinations.push({ kind: 'status', sock: session.sock, audience })
      }
    }

    if (!destinations.length) return z.reply('No eligible group or Status destinations were found across connected sessions.')
    if (destinations.length > MAX_DESTINATIONS) {
      return z.reply(`⚠️ Found ${destinations.length} destinations, above the ${MAX_DESTINATIONS}-destination limit. Narrow the connected sessions/groups before trying again.`)
    }

    await z.reply(`🌐 GlobalPost started: ${destinations.filter(d => d.kind === 'group').length} groups and ${destinations.filter(d => d.kind === 'status').length} account Status targets. Restricted or unavailable destinations will be skipped.`)
    let sent = 0, failed = 0
    for (const dest of destinations) {
      try {
        if (dest.kind === 'status') {
          await dest.sock.sendMessage('status@broadcast', payload, { statusJidList: dest.audience })
        } else {
          await dest.sock.sendMessage(dest.jid, payload)
        }
        sent++
      } catch {
        failed++
      }
      await expertSleep(DELAY_MS)
    }
    return z.reply(`✅ GlobalPost finished.\n• Sent: ${sent}\n• Skipped/failed: ${failed}\n• Total targets: ${destinations.length}`)
  }
}

function makeMediaPayload(media, text) {
  const caption = text || undefined
  switch (media.type) {
    case 'imageMessage': return { image: media.buffer, ...(caption ? { caption } : {}) }
    case 'videoMessage': return { video: media.buffer, ...(caption ? { caption } : {}) }
    case 'audioMessage': return { audio: media.buffer, mimetype: media.content?.mimetype || 'audio/mpeg', ptt: !!media.content?.ptt }
    case 'documentMessage': return { document: media.buffer, mimetype: media.content?.mimetype || 'application/octet-stream', fileName: media.content?.fileName || 'announcement-file', ...(caption ? { caption } : {}) }
    default: return { text: text || '' }
  }
}
