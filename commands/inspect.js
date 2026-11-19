// ⟦EXPERT⟧ .inspect — full breakdown of a message
//   .inspect        reply to any message (or bare = inspect this command)
//   .inspect raw    same + sanitized JSON file
// Owner only. Full internals: media keys, URLs, thumbnails, paths — nothing redacted.
import { expertCtx } from '../lib/expert.admin.js'
import { expertNumber, expertUptime, expertBytes } from '../lib/expert.utils.js'

// ── constants ─────────────────────────────────────────────────────────────
const WRAPPERS = {
  ephemeralMessage: 'ephemeral',
  viewOnceMessage: 'view-once',
  viewOnceMessageV2: 'view-once v2',
  viewOnceMessageV2Extension: 'view-once v2+',
  documentWithCaptionMessage: 'document+caption',
  editedMessage: 'edited',
  associatedChildMessage: 'associated-child'
}

const TYPES = {
  conversation: ['💬', 'Text'],
  extendedTextMessage: ['💬', 'Text (link / reply / mentions)'],
  imageMessage: ['🖼️', 'Image'],
  videoMessage: ['🎬', 'Video'],
  audioMessage: ['🎵', 'Audio'],
  stickerMessage: ['🧩', 'Sticker'],
  documentMessage: ['📄', 'Document'],
  contactMessage: ['👤', 'Contact'],
  contactsArrayMessage: ['👥', 'Contacts'],
  locationMessage: ['📍', 'Location'],
  liveLocationMessage: ['📡', 'Live location'],
  pollCreationMessage: ['📊', 'Poll'],
  pollCreationMessageV2: ['📊', 'Poll'],
  pollCreationMessageV3: ['📊', 'Poll'],
  pollUpdateMessage: ['🗳️', 'Poll vote'],
  reactionMessage: ['😀', 'Reaction'],
  protocolMessage: ['⚙️', 'Protocol event'],
  buttonsMessage: ['🔘', 'Buttons'],
  buttonsResponseMessage: ['🔘', 'Button tap'],
  listMessage: ['📋', 'List'],
  listResponseMessage: ['📋', 'List selection'],
  templateMessage: ['🧾', 'Template'],
  templateButtonReplyMessage: ['🔘', 'Template button tap'],
  interactiveMessage: ['🧩', 'Interactive'],
  interactiveResponseMessage: ['🧩', 'Interactive reply'],
  groupInviteMessage: ['🔗', 'Group invite'],
  productMessage: ['🛍️', 'Product'],
  orderMessage: ['🛒', 'Order'],
  albumMessage: ['🖼️', 'Album'],
  eventMessage: ['📅', 'Event'],
  newsletterAdminInviteMessage: ['📢', 'Channel admin invite'],
  stickerPackMessage: ['📦', 'Sticker pack'],
  lottieStickerMessage: ['✨', 'Lottie sticker'],
  requestPhoneNumberMessage: ['📱', 'Phone number request'],
  keepInChatMessage: ['📌', 'Keep in chat'],
  pinInChatMessage: ['📍', 'Pin in chat'],
  scheduledCallCreationMessage: ['📞', 'Scheduled call'],
  callLogMessage: ['📞', 'Call log']
}

const PROTOCOL_TYPES = {
  0: 'REVOKE (delete)',
  1: 'EPHEMERAL_SETTING',
  2: 'EPHEMERAL_SYNC_RESPONSE',
  3: 'HISTORY_SYNC_NOTIFICATION',
  4: 'APP_STATE_SYNC_KEY_SHARE',
  5: 'APP_STATE_SYNC_KEY_REQUEST',
  6: 'MSG_FANOUT_BACKFILL_REQUEST',
  7: 'INITIAL_SECURITY_NOTIFICATION_SETTING_SYNC',
  8: 'APP_STATE_FATAL_EXCEPTION_NOTIFICATION',
  14: 'MESSAGE_EDIT',
  15: 'PEER_DATA_OPERATION_REQUEST_MESSAGE',
  16: 'PEER_DATA_OPERATION_REQUEST_RESPONSE_MESSAGE'
}


// ── helpers ───────────────────────────────────────────────────────────────
const num = (v) => {
  if (v == null) return null
  if (typeof v === 'object') return v.toNumber?.() ?? Number(v.low ?? v) ?? null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

const hex = (v) => {
  if (!v) return null
  try {
    return (typeof v === 'string' ? Buffer.from(v, 'base64') : Buffer.from(v)).toString('hex')
  } catch {
    return null
  }
}

const clip = (s, n = 160) => {
  const t = String(s ?? '')
  return t.length > n ? `${t.slice(0, n)}…` : t
}

const dur = (s) => {
  const n = Math.floor(Number(s) || 0)
  if (n >= 3600) return `${Math.floor(n / 3600)}h ${Math.floor((n % 3600) / 60)}m`
  if (n >= 60) return `${Math.floor(n / 60)}m ${n % 60}s`
  return `${n}s`
}

const expiry = (s) =>
  ({ 86400: '24 hours', 604800: '7 days', 7776000: '90 days' }[s] || dur(s))

const who = (jid) => {
  if (!jid) return '—'
  const n = expertNumber(jid)
  const lid = String(jid).includes('@lid') ? ' (LID)' : ''
  return `${n || jid}${lid}`
}

function chatKind(jid = '') {
  if (jid === 'status@broadcast') return 'Status'
  if (jid.endsWith('@g.us')) return 'Group'
  if (jid.endsWith('@newsletter')) return 'Channel'
  if (jid.endsWith('@broadcast')) return 'Broadcast'
  if (jid.endsWith('@lid') || jid.endsWith('@s.whatsapp.net')) return 'Private'
  return 'Unknown'
}

/** Peel ephemeral / view-once / edit wrappers */
function peel(message) {
  const chain = []
  let cur = message || {}
  let editTarget = null

  for (let i = 0; i < 10 && cur; i++) {
    const wrapKey = Object.keys(WRAPPERS).find((w) => cur[w]?.message)
    if (wrapKey) {
      chain.push(WRAPPERS[wrapKey])
      cur = cur[wrapKey].message
      continue
    }

    // protocol edit
    if (cur.protocolMessage?.editedMessage) {
      chain.push('edit')
      editTarget = cur.protocolMessage.key?.id || null
      cur = cur.protocolMessage.editedMessage
      continue
    }

    // nested editedMessage (some builds)
    if (cur.editedMessage?.message) {
      chain.push('edited')
      cur = cur.editedMessage.message
      continue
    }
    break
  }

  // dedupe consecutive identical labels
  const deduped = chain.filter((c, i) => c !== chain[i - 1])
  return { chain: deduped, inner: cur || {}, editTarget }
}

/** Primary body type (skip context-only keys) */
function primaryType(inner) {
  const skip = new Set([
    'messageContextInfo',
    'senderKeyDistributionMessage',
    'deviceSentMessage'
  ])
  return Object.keys(inner || {}).find((k) => !skip.has(k)) || 'unknown'
}

function extractText(type, body) {
  if (typeof body === 'string') return body
  if (!body || typeof body !== 'object') return ''
  return (
    body.text ||
    body.caption ||
    body.conversation ||
    body.selectedDisplayText ||
    body.selectedId ||
    body.title ||
    body.name ||
    body.contentText ||
    body.description ||
    ''
  )
}

// ── sanitizer for raw dump ────────────────────────────────────────────────
function clean(v, depth = 0, seen = new WeakSet()) {
  if (v == null) return v
  if (v instanceof Uint8Array || Buffer.isBuffer(v)) return `<bytes ${v.length}>`
  if (typeof v === 'bigint') return String(v)
  if (typeof v === 'string') {
    return v.length > 8000 ? `${v.slice(0, 8000)}…(+${v.length - 8000} chars)` : v
  }
  if (typeof v !== 'object') return v
  if (typeof v.toNumber === 'function') return v.toNumber()
  if (seen.has(v)) return '<circular>'
  seen.add(v)
  if (depth > 12) return '<too deep>'
  if (Array.isArray(v)) return v.slice(0, 50).map((x) => clean(x, depth + 1, seen))
  return Object.fromEntries(
    Object.entries(v).map(([k, x]) => [k, clean(x, depth + 1, seen)])
  )
}

function section(out, title, rows) {
  const list = (rows || []).filter((r) => r != null && r !== '')
  if (!list.length) return
  out.push('', `╭──❖ ${title}`, ...list.map((r) => `│ ◈ ${r}`), '╰───────────────❖')
}

// ── command ───────────────────────────────────────────────────────────────
export default {
  name: 'inspect',
  aliases: ['msginfo', 'minfo', 'analyze', 'msginspect'],
  owner: true,
  desc: 'Full breakdown of a replied message (.inspect raw for JSON)',

  async run(z) {
    const wantRaw = ['raw', 'json', 'dump'].includes(String(z.args[0] || '').toLowerCase())
    const ctx = expertCtx(z)
    const cache = globalThis.__expertRecentMessages

    // Target: replied message (prefer full cached copy) → else this command
    let full = null
    let source = ''

    if (ctx?.stanzaId) {
      const cacheKey = `${z.session.number}:${z.jid}:${ctx.stanzaId}`
      full = cache?.get?.(cacheKey) || null
      source = full
        ? 'full copy (seen since bot started)'
        : 'reply context only (older than bot memory)'
    } else {
      full = z.msg
      source = 'this command message — reply to a message to inspect that one'
    }

    const message = full?.message || ctx?.quotedMessage
    if (!message) {
      return z.reply(
        '❌ *Inspect*\nReply to a message the bot has received.\nOptional: `.inspect raw`'
      )
    }

    const key = full?.key || {
      remoteJid: z.jid,
      id: ctx?.stanzaId,
      participant: ctx?.participant,
      fromMe: false
    }

    const { chain, inner, editTarget } = peel(message)
    const type = primaryType(inner)
    const body = inner[type]
    const [icon, label] = TYPES[type] || ['❓', type]
    const info = body && typeof body === 'object' ? body.contextInfo : undefined

    // Identity
    const inGroup = key.remoteJid?.endsWith('@g.us')
    const sender =
      key.participant ||
      key.participantPn ||
      (key.fromMe ? z.sock.user?.id : inGroup ? null : key.remoteJid)
    const ts = num(full?.messageTimestamp)
    const when = ts ? new Date(ts * (ts < 1e12 ? 1000 : 1)) : null
    const age = when ? Math.max(0, (Date.now() - when.getTime()) / 1000) : null

    const out = []
    out.push(
      '╭━━━━━━━━━━━━━━━━━━━━╮',
      '┃  🔍 *MESSAGE INSPECTOR*',
      '╰━━━━━━━━━━━━━━━━━━━━╯',
      `_Source: ${source}_`
    )

    section(out, '🆔 *IDENTITY*', [
      `ID » \`${key.id || '—'}\``,
      `Chat » ${chatKind(key.remoteJid)} (${expertNumber(key.remoteJid) || key.remoteJid || '—'})`,
      `From » *${who(sender)}*${
        key.fromMe || (sender && expertNumber(sender) === z.session.number) ? ' (you)' : ''
      }`,
      full?.pushName ? `Name » ${clip(full.pushName, 40)}` : null,
      when
        ? `Sent » ${when.toISOString().replace('T', ' ').slice(0, 19)} UTC`
        : 'Sent » unknown (no timestamp)',
      age != null ? `Age » ${expertUptime(age)} ago` : null,
      key.fromMe != null ? `fromMe » ${key.fromMe}` : null
    ])

    // Content
    const text = extractText(type, body)
    const contentRows = [`Type » *${label}* \`${type}\``]
    if (chain.length) contentRows.push(`Wrapped in » ${chain.join(' → ')}`)

    if (text) {
      const links = text.match(/https?:\/\/[^\s<>"']+/gi) || []
      const words = text.trim() ? text.trim().split(/\s+/).length : 0
      contentRows.push(
        `Text » ${text.length} chars · ${words} word${words === 1 ? '' : 's'}`,
        `Preview » ${clip(text.replace(/\s+/g, ' '), 140)}`
      )
      if (links.length) {
        contentRows.push(
          `Links » ${links.length}: ${links
            .slice(0, 4)
            .map((l) => clip(l, 55))
            .join(' · ')}`
        )
      }
    }

    if (type === 'extendedTextMessage' && (body?.title || body?.canonicalUrl || body?.matchedText)) {
      contentRows.push(
        `Link card » ${clip(
          [body.title, body.canonicalUrl || body.matchedText].filter(Boolean).join(' — '),
          140
        )}`
      )
    }

    if (/^pollCreation/.test(type) && body) {
      contentRows.push(
        `Poll » "${clip(body.name || '', 80)}" · ${body.options?.length || 0} options · pick ${
          body.selectableOptionsCount ?? 'any'
        }`
      )
      if (Array.isArray(body.options) && body.options.length) {
        contentRows.push(
          `Options » ${body.options
            .slice(0, 6)
            .map((o, i) => `${i + 1}. ${clip(o.optionName || o.name || '?', 30)}`)
            .join(' · ')}`
        )
      }
    }

    if (type === 'contactMessage' && body) {
      contentRows.push(`Contact » ${body.displayName || body.vcard?.match(/FN:(.+)/)?.[1] || '—'}`)
    }
    if (type === 'contactsArrayMessage' && body) {
      contentRows.push(`Contacts » ${body.contacts?.length || 0} cards`)
    }
    if (/locationMessage$/i.test(type) && body) {
      const lat = body.degreesLatitude
      const lon = body.degreesLongitude
      contentRows.push(
        `Coords » ${lat != null ? Number(lat).toFixed(5) : '?'}, ${
          lon != null ? Number(lon).toFixed(5) : '?'
        }${body.name ? ` · ${clip(body.name, 50)}` : ''}`
      )
    }
    if (type === 'reactionMessage' && body) {
      contentRows.push(
        `Emoji » ${body.text || '(removed)'}`,
        `On message » \`${body.key?.id || '—'}\``
      )
    }
    if (type === 'protocolMessage' && body) {
      const pType = body.type
      const labelP = PROTOCOL_TYPES[pType] || String(pType ?? '—')
      contentRows.push(
        `Event » ${labelP}${body.key?.id ? ` on \`${body.key.id}\`` : ''}`
      )
    }
    if (type === 'groupInviteMessage' && body) {
      contentRows.push(`Invite to » ${clip(body.groupName || '—', 60)}`)
    }
    if (type === 'buttonsResponseMessage' && body) {
      contentRows.push(
        `Button id » \`${body.selectedButtonId || '—'}\``,
        `Display » ${clip(body.selectedDisplayText || '', 60)}`
      )
    }
    if (type === 'listResponseMessage' && body) {
      const single = body.singleSelectReply || {}
      contentRows.push(
        `Row id » \`${single.selectedRowId || body.selectedRowId || '—'}\``,
        `Title » ${clip(body.title || single.selectedDisplayText || '', 60)}`
      )
    }
    if (type === 'interactiveResponseMessage' && body) {
      contentRows.push(`Interactive reply » ${clip(JSON.stringify(body.nativeFlowResponseMessage || body).slice(0, 120), 120)}`)
    }
    if (editTarget) {
      contentRows.push(`Edit of » \`${editTarget}\` (this is the NEW version)`)
    }

    section(out, `${icon} *CONTENT*`, contentRows)

    // Media
    if (body && typeof body === 'object' && /^(image|video|audio|sticker|document)Message$/.test(type)) {
      const size = num(body.fileLength)
      const sha = hex(body.fileSha256)
      const encSha = hex(body.fileEncSha256)
      const mediaKeyHex = hex(body.mediaKey)
      const mediaRows = [
        body.mimetype ? `MIME » ${body.mimetype}` : null,
        size != null ? `Size » ${expertBytes(size)}` : null,
        body.width && body.height ? `Dimensions » ${body.width} × ${body.height}` : null,
        body.seconds != null ? `Duration » ${dur(num(body.seconds))}` : null,
        body.pageCount ? `Pages » ${body.pageCount}` : null,
        body.fileName ? `File » ${clip(body.fileName, 80)}` : null,
        type === 'audioMessage' ? `Kind » ${body.ptt ? 'voice note (PTT)' : 'audio file'}` : null,
        body.gifPlayback ? 'Kind » GIF-style video' : null,
        type === 'stickerMessage'
          ? `Kind » ${body.isAnimated ? 'animated' : 'static'} sticker`
          : null,
        body.url ? `URL » ${body.url}` : null,
        body.directPath ? `directPath » ${body.directPath}` : null,
        mediaKeyHex ? `mediaKey » ${mediaKeyHex}` : null,
        body.mediaKeyTimestamp != null ? `mediaKeyTimestamp » ${String(body.mediaKeyTimestamp)}` : null,
        sha ? `fileSha256 » ${sha}` : null,
        encSha ? `fileEncSha256 » ${encSha}` : null,
        body.jpegThumbnail
          ? `jpegThumbnail » <bytes ${Buffer.isBuffer(body.jpegThumbnail) ? body.jpegThumbnail.length : (body.jpegThumbnail?.length || '?')}>`
          : null,
        body.thumbnailDirectPath ? `thumbnailDirectPath » ${body.thumbnailDirectPath}` : null,
        hex(body.thumbnailSha256) ? `thumbnailSha256 » ${hex(body.thumbnailSha256)}` : null,
        hex(body.thumbnailEncSha256) ? `thumbnailEncSha256 » ${hex(body.thumbnailEncSha256)}` : null
      ]
      section(out, '📎 *MEDIA*', mediaRows)
    }

    // Flags
    const flags = []
    if (chain.some((c) => c.startsWith('view-once')) || body?.viewOnce) flags.push('👁️ View-once')
    if (info?.isForwarded) {
      const score = info.forwardingScore
      flags.push(
        `↪️ Forwarded${
          score
            ? ` (score ${score}${score >= 5 ? ', widely forwarded' : ''})`
            : ''
        }`
      )
    }
    if (info?.forwardedNewsletterMessageInfo) {
      const n = info.forwardedNewsletterMessageInfo
      flags.push(`📢 Channel: ${clip(n.newsletterName || n.newsletterJid || '—', 50)}`)
    }
    if (info?.expiration) flags.push(`⏳ Disappears after ${expiry(num(info.expiration))}`)
    if (chain.includes('edit') || chain.includes('edited')) flags.push('✏️ Edited')
    if (info?.mentionedJid?.length) {
      flags.push(
        `🔔 Mentions ${info.mentionedJid.length}: ${info.mentionedJid
          .slice(0, 5)
          .map(expertNumber)
          .join(', ')}${info.mentionedJid.length > 5 ? '…' : ''}`
      )
    }
    if (info?.groupMentions?.length) flags.push(`👥 Group mentions: ${info.groupMentions.length}`)
    if (info?.externalAdReply) {
      flags.push(`📣 External card: ${clip(info.externalAdReply.title || '—', 50)}`)
    }
    if (info?.isGroupStatusMentionMessage) flags.push('📢 Group status mention')
    section(out, '🏷️ *FLAGS*', flags.length ? flags : ['none'])

    // Reply context
    if (info?.quotedMessage || info?.stanzaId) {
      const qInner = peel(info.quotedMessage).inner
      const qt = primaryType(qInner)
      section(out, '↩️ *REPLY TO*', [
        `Message » \`${info.stanzaId || '—'}\``,
        `Author » ${who(info.participant)}`,
        `Type » ${(TYPES[qt] || ['', qt])[1]}`
      ])
    }

    // Group metadata
    if (inGroup) {
      try {
        const meta = await z.sock.groupMetadata(key.remoteJid)
        const me = sender ? expertNumber(sender) : null
        const p =
          me &&
          meta.participants?.find((x) =>
            [x.id, x.phoneNumber, x.lid]
              .filter(Boolean)
              .map(expertNumber)
              .includes(me)
          )
        section(out, '👥 *GROUP*', [
          `Name » ${clip(meta.subject || '—', 60)}`,
          `Members » ${meta.participants?.length ?? '?'}`,
          `Sender role » ${
            !sender
              ? 'unknown'
              : !p
                ? 'not in group anymore'
                : p.admin === 'superadmin'
                  ? 'creator'
                  : p.admin
                    ? 'admin'
                    : 'member'
          }`,
          `Chat mode » ${meta.announce ? 'admins only' : 'everyone can send'}`
        ])
      } catch {
        /* optional */
      }
    }

    // Footer tip
    if (!wantRaw) {
      out.push('', `_Tip: \`.inspect raw\` for sanitized JSON dump_`)
    }

    const textOut = out.join('\n')
    // WhatsApp text limit ~65k, stay safe under 4k for readability
    const chunks = []
    if (textOut.length <= 3900) {
      chunks.push(textOut)
    } else {
      let rest = textOut
      while (rest.length) {
        chunks.push(rest.slice(0, 3900))
        rest = rest.slice(3900)
      }
    }
    for (const chunk of chunks) {
      await z.sock.sendMessage(z.jid, { text: chunk }, { quoted: z.msg })
    }

    if (wantRaw) {
      const dump = clean({
        key,
        pushName: full?.pushName,
        messageTimestamp: full?.messageTimestamp,
        message
      })
      await z.sock.sendMessage(
        z.jid,
        {
          document: Buffer.from(JSON.stringify(dump, null, 2)),
          mimetype: 'application/json',
          fileName: `inspect-${String(key.id || 'message').slice(0, 24)}.json`,
          caption: '🧾 Full raw message dump (keys, URLs, paths included)'
        },
        { quoted: z.msg }
      )
    }
  }
}
