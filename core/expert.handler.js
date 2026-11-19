// ⟦EXPERT⟧ message router — text, button taps, list taps → command
import { expertCfg } from '../config/expert.config.js'
import { expertHub, expertRecordCmdError } from './expert.hub.js'
import { expertReactChannel } from './expert.newsletter.js'
import { expertSendButtons } from './expert.buttons.js'
import { expertNumber, expertLog } from '../lib/expert.utils.js'
import { expertGet, expertSet } from '../lib/expert.store.js'
import { expertGroupHooks } from '../lib/expert.grouphooks.js'
import { expertGroup } from '../lib/expert.admin.js'
import { expertIsExempt, expertPunish } from '../lib/expert.shield.js'
import { expertLooksLikeBot, expertIsOwnSession, expertIsGroupStatus } from '../lib/expert.antibot.js'
import { expertPresenceOnMessage } from '../lib/expert.presence.js'
import { antibugScan } from '../commands/antibug.js'
import { expertChatbot } from '../lib/expert.chatbot.js'
import fs from 'node:fs'
import path from 'node:path'

// peel ephemeral / view-once / edited wrappers
function unwrap(m) {
  let cur = m
  for (let i = 0; i < 5 && cur; i++) {
    const inner =
      cur.ephemeralMessage?.message ||
      cur.viewOnceMessage?.message ||
      cur.viewOnceMessageV2?.message ||
      cur.viewOnceMessageV2Extension?.message ||
      cur.documentWithCaptionMessage?.message ||
      cur.editedMessage?.message?.protocolMessage?.editedMessage
    if (!inner) break
    cur = inner
  }
  return cur
}

// text typed by the user OR the id of the button/row they tapped
export function expertText(m) {
  if (!m) return ''
  if (m.conversation) return m.conversation
  if (m.extendedTextMessage?.text) return m.extendedTextMessage.text
  if (m.imageMessage?.caption) return m.imageMessage.caption
  if (m.videoMessage?.caption) return m.videoMessage.caption
  if (m.buttonsResponseMessage?.selectedButtonId) return m.buttonsResponseMessage.selectedButtonId
  if (m.templateButtonReplyMessage?.selectedId) return m.templateButtonReplyMessage.selectedId
  if (m.listResponseMessage?.singleSelectReply?.selectedRowId) return m.listResponseMessage.singleSelectReply.selectedRowId
  const flow = m.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson
  if (flow) { try { return JSON.parse(flow).id || '' } catch {} }
  return ''
}

// whole-word, case-insensitive match against the account's banned-word list
const BACKSLASH_SPECIALS = /[.*+?^${}()|[\]\\]/g
function hasBadWord(text, words) {
  const t = text.toLowerCase()
  return words.some((w) => {
    const esc = w.replace(BACKSLASH_SPECIALS, '\\$&')
    return new RegExp(`(^|[^\\p{L}\\p{N}])${esc}($|[^\\p{L}\\p{N}])`, 'u').test(t)
  })
}

const recentMessages = globalThis.__expertRecentMessages ??= new Map()
const mediaType = (m) => m && Object.keys(m).find(k => /^(image|video|audio|sticker|document)Message$/.test(k))
const unwrapViewOnce = (m) => {
  let cur = m
  for (let i = 0; i < 5 && cur; i++) {
    const inner = cur.viewOnceMessage?.message || cur.viewOnceMessageV2?.message ||
      cur.viewOnceMessageV2Extension?.message || cur.ephemeralMessage?.message
    if (!inner) break
    cur = inner
  }
  return cur
}

async function sendOwnerCopy(session, original, title, body) {
  const sock = session.sock
  const ownerJid = `${session.number}@s.whatsapp.net`
  try {
    const content = original?.message || {}
    const m = content.ephemeralMessage?.message || content.viewOnceMessageV2?.message || content.viewOnceMessage?.message || content
    const t = mediaType(m)
    await sock.sendMessage(ownerJid, { text: `${title}\n${body}` })
    if (t) {
      const { downloadContentFromMessage } = await import('@rennzsync/baileys')
      const stream = await downloadContentFromMessage(m[t], t.replace('Message','').toLowerCase())
      const chunks=[]; for await (const c of stream) chunks.push(c)
      const buffer=Buffer.concat(chunks)
      const payload = t === 'imageMessage' ? { image: buffer, caption: m[t].caption || title } :
        t === 'videoMessage' ? { video: buffer, caption: m[t].caption || title } :
        t === 'audioMessage' ? { audio: buffer, mimetype: m[t].mimetype || 'audio/mpeg' } :
        t === 'stickerMessage' ? { sticker: buffer } :
        { document: buffer, mimetype: m[t].mimetype, fileName: m[t].fileName || 'deleted-media' }
      await sock.sendMessage(ownerJid, payload)
    }
  } catch (e) { expertLog.warn(`owner archive failed: ${e.message}`) }
}

// true if the message is a view-once photo/video/voice note
function isViewOnce(m) {
  let cur = m
  for (let i = 0; i < 5 && cur; i++) {
    if (cur.viewOnceMessage || cur.viewOnceMessageV2 || cur.viewOnceMessageV2Extension) return true
    const t = mediaType(cur)
    if (t && cur[t]?.viewOnce) return true
    cur = cur.ephemeralMessage?.message
  }
  return false
}

// Send ONLY the media to the owner's DM — no header text, no extra caption. Returns true on success.
async function sendOwnerMedia(session, original) {
  try {
    const m = unwrapViewOnce(original?.message || {})
    const t = mediaType(m)
    if (!t) return false
    const { downloadContentFromMessage } = await import('@rennzsync/baileys')
    const stream = await downloadContentFromMessage(m[t], t.replace('Message', '').toLowerCase())
    const chunks = []
    for await (const c of stream) chunks.push(c)
    const buffer = Buffer.concat(chunks)
    const cap = m[t].caption ? { caption: m[t].caption } : {}
    const payload =
      t === 'imageMessage' ? { image: buffer, ...cap } :
      t === 'videoMessage' ? { video: buffer, ...cap } :
      t === 'audioMessage' ? { audio: buffer, mimetype: m[t].mimetype || 'audio/mpeg', ptt: !!m[t].ptt } :
      t === 'stickerMessage' ? { sticker: buffer } :
      { document: buffer, mimetype: m[t].mimetype, fileName: m[t].fileName || 'file' }
    await session.sock.sendMessage(`${session.number}@s.whatsapp.net`, payload)
    return true
  } catch (e) { expertLog.warn(`secret vv failed: ${e.message}`); return false }
}

const statusReacted = new Set()

export async function expertHandle(session, upsert) {
  // Statuses that arrive while reconnecting come as 'append'; still process fresh ones.
  const freshStatus = upsert.type === 'append' && (upsert.messages || []).some((m) =>
    m?.key?.remoteJid === 'status@broadcast' && !m.key.fromMe && (Date.now() / 1000 - Number(m.messageTimestamp || 0)) < 600)
  if (upsert.type !== 'notify' && !freshStatus) return
  const { sock } = session

  for (const msg of upsert.messages || []) {
    let cmdRunning = false
    let runningCmd = null
    try {
      if (!msg?.message || !msg.key) continue
      const jid = msg.key.remoteJid
      if (!jid) continue

      // antibug: crash payloads are dropped (and deleted) before anything else touches them
      if (!msg.key.fromMe && (await antibugScan(session, msg))) continue

      // Archive revoke/edit protocol events for the linked account owner.
      const protocol = msg.message.protocolMessage
      if (protocol?.key && ([ 'REVOKE', 'MESSAGE_EDIT' ].includes(String(protocol.type)) || protocol.type === 0 || protocol.type === 14)) {
        const oldKey = protocol.key
        const cacheKey = `${session.number}:${oldKey.remoteJid}:${oldKey.id}`
        const cached = recentMessages.get(cacheKey)
        if ((protocol.type === 'REVOKE' || protocol.type === 0) && expertGet(session.number, 'antidelete', false) && cached)
          await sendOwnerCopy(session, cached, '🗑️ Deleted message', `Chat: ${oldKey.remoteJid}\nFrom: ${cached.key?.participant || oldKey.remoteJid}`)
        if (protocol.type === 'MESSAGE_EDIT' && expertGet(session.number, 'antiedit', false)) {
          await sendOwnerCopy(session, msg, '✏️ Edited message (new version)', `Chat: ${oldKey.remoteJid}`)
          if (cached) await sendOwnerCopy(session, cached, '✏️ Edited message (previous version)', `Chat: ${oldKey.remoteJid}`)
        }
        continue
      }
      if (jid === 'status@broadcast') {
        // Auto view / auto like status. `autostatusreact` (old combined switch) enables both.
        const both = expertGet(session.number, 'autostatusreact', false)
        const doLike = both || expertGet(session.number, 'autolikestatus', false)
        const doView = doLike || expertGet(session.number, 'autoviewstatus', false)
        const poster = msg.key.participant || msg.participant
        if (doView && !msg.key.fromMe && msg.key.id && poster) {
          const dedupe = `${session.number}:${msg.key.id}`
          if (!statusReacted.has(dedupe)) {
            statusReacted.add(dedupe)
            if (statusReacted.size > 2000) statusReacted.delete(statusReacted.values().next().value)
            const emojis = expertGet(session.number, 'autostatusreact:emojis', ['❤️','🔥','😍','💯','✨','👏','😂','🙌'])
            const text = emojis[Math.floor(Math.random() * emojis.length)]
            setTimeout(async () => {
              // 1) VIEW: send a real "read" receipt straight to the poster. (sock.readMessages downgrades to
              //    "read-self" when the account's read-receipts privacy is off, and throws if the privacy fetch
              //    fails — either way the status never shows as viewed.)
              try {
                await sock.sendReceipt('status@broadcast', poster, [msg.key.id], 'read')
              } catch (e) {
                expertLog.warn(`autoviewstatus receipt failed: ${e?.message || e}`)
                try { await sock.readMessages([msg.key]) } catch (e2) { expertLog.warn(`autoviewstatus view failed: ${e2?.message || e2}`) }
              }
              if (!doLike) return
              // 2) LIKE: WhatsApp identifies posters by LID. The status audience needs plain (device-less) JIDs,
              //    so resolve LID → phone number through Baileys' LID map and try a few audience shapes.
              const bare = (j) => (j ? `${String(j).split('@')[0].split(':')[0]}@${String(j).split('@')[1] || 's.whatsapp.net'}` : null)
              const own = `${session.number}@s.whatsapp.net`
              let posterPn = [msg.key.participantAlt, poster].find((j) => j && j.endsWith('@s.whatsapp.net'))
              if (!posterPn && poster.endsWith('@lid')) {
                try { posterPn = await sock.signalRepository?.lidMapping?.getPNForLID?.(poster) } catch {}
              }
              const posterLid = poster.endsWith('@lid') ? poster : null
              const ownLid = bare(sock.user?.lid)
              const lists = [
                [bare(posterPn), own],
                [bare(posterPn), bare(posterLid), own, ownLid],
                [bare(posterLid), ownLid, own]
              ].map((l) => [...new Set(l.filter(Boolean))]).filter((l) => l.length > 1)
              const reactKey = { remoteJid: 'status@broadcast', id: msg.key.id, participant: poster, fromMe: false }
              for (const list of lists) {
                try {
                  await sock.sendMessage('status@broadcast', { react: { text, key: reactKey } }, { statusJidList: list })
                  expertLog.info?.(`autolikestatus: reacted ${text} to status ${msg.key.id} from ${poster} (audience: ${list.join(', ')})`)
                  return
                } catch (e) { expertLog.warn(`autolikestatus send failed (${list.join(', ')}): ${e?.message || e}`) }
              }
            }, 1500 + Math.floor(Math.random() * 2500))
          }
        }
        if (expertGet(session.number, 'savestatus', false) && !msg.key.fromMe) {
          const senderJid = msg.key.participant || msg.key.remoteJid
          await sendOwnerCopy(session, msg, '📥 Saved WhatsApp status', `From: ${senderJid}`)
        }
        continue
      }
      // Secret view-once save: react 🌚 to a view-once message to send its media to this account owner's DM.
      const reaction = msg.message.reactionMessage
      if (reaction?.text === '🌚' && reaction?.key?.id && expertGet(session.number, 'viewonce', true)) {
        const targetKey = `${session.number}:${reaction.key.remoteJid || jid}:${reaction.key.id}`
        const target = recentMessages.get(targetKey)
        if (target) await sendOwnerCopy(session, target, '🌚 Secret view-once', `Chat: ${reaction.key.remoteJid || jid}`)
        continue
      }

      const cacheKey = `${session.number}:${jid}:${msg.key.id}`
      recentMessages.set(cacheKey, msg)
      if (recentMessages.size > 2000) recentMessages.delete(recentMessages.keys().next().value)
      if (expertGet(session.number, 'autoread', false) && !msg.key.fromMe) {
        try { await sock.readMessages([msg.key]) } catch {}
      }
      await expertPresenceOnMessage(sock, session, msg)
      if (expertGet(session.number, 'autoreact', false) && !msg.key.fromMe) {
        const emojis = ['❤️','🔥','👍','😂','✨','💯']
        try { await sock.sendMessage(jid, { react: { text: emojis[Math.floor(Math.random()*emojis.length)], key: msg.key } }) } catch {}
      }
      if (jid.endsWith('@g.us') && !msg.key.fromMe) {
        const c = unwrap(msg.message)
        // antisticker: stickers from non-admins -> delete + warn (admins/owner/sudo are exempt)
        if (expertGet(session.number, 'antisticker', false) && (c.stickerMessage || c.lottieStickerMessage)) {
          if (!(await expertIsExempt(sock, session, jid, msg))) {
            await expertPunish(sock, session, jid, msg, 'antisticker', 'stickers are not allowed')
            continue
          }
        }
        // antibot: messages that look like they were sent by another bot (our own linked sessions are skipped)
        // antibot (command mode): a member typing a bot command (.menu, !play, /ping ...) -> message deleted
        const abTxt = expertText(c).trim()
        const looksLikeBotCmd = /^[.!#\/$+~,;?&*%][a-z][\w-]*(\s|$)/i.test(abTxt)
        // antibot (chatbot mode): talking to a bot = replying to a bot's message or @mentioning one of our linked bots
        const abCtx = Object.values(c || {}).find((v) => v && typeof v === 'object' && v.contextInfo)?.contextInfo
        const talksToBot = !!abCtx && (
          expertHub.sessions.has(expertNumber(abCtx.participant)) ||
          (abCtx.stanzaId && expertLooksLikeBot({ key: { id: abCtx.stanzaId } }, null)) ||
          (abCtx.mentionedJid || []).some((j) => expertHub.sessions.has(expertNumber(j)))
        )
        if (expertGet(session.number, 'antibot', false) && (looksLikeBotCmd || talksToBot || expertLooksLikeBot(msg, c))) {
          if (!(await expertIsExempt(sock, session, jid, msg))) {
            await expertPunish(sock, session, jid, msg, 'antibot', 'bots are not allowed here')
            continue
          }
        }
        // antigroupstatus: group-status posts from non-admins
        const gsCtx = Object.values(c || {}).find((v) => v && typeof v === 'object' && v.contextInfo)?.contextInfo
        if (expertGet(session.number, 'antigroupstatus', false) && expertIsGroupStatus(c, gsCtx)) {
          if (!(await expertIsExempt(sock, session, jid, msg))) {
            await expertPunish(sock, session, jid, msg, 'antigroupstatus', 'group status posts are not allowed')
            continue
          }
        }
        const txt = expertText(c)
        // antilink: links from non-admins -> delete + warn (admins/owner/sudo are exempt)
        if (expertGet(session.number, 'antilink', false) && /(?:https?:\/\/|www\.|chat\.whatsapp\.com\/|wa\.me\/|t\.me\/|discord\.gg\/)/i.test(txt)) {
          if (!(await expertIsExempt(sock, session, jid, msg))) {
            await expertPunish(sock, session, jid, msg, 'antilink', 'links are not allowed')
            continue
          }
        }
        if (expertGet(session.number, 'antibadword', false) && txt && hasBadWord(txt, expertGet(session.number, 'badwords', []))) {
          try { await sock.sendMessage(jid, { delete: msg.key }) } catch {}
          continue
        }
        // contextInfo can live on any message type (text, image caption, video caption...)
        const ctxInfo = Object.values(c || {}).find((v) => v && typeof v === 'object' && v.contextInfo)?.contextInfo
        const mentions = ctxInfo?.mentionedJid || []
        if (expertGet(session.number, 'antitag', false) && mentions.length >= expertGet(session.number, 'antitag:max', 5)) {
          if (!(await expertIsExempt(sock, session, jid, msg))) {
            await expertPunish(sock, session, jid, msg, 'antitag', 'mass tagging is not allowed')
            continue
          }
        }
        // antimention: any @mention of a member by a non-admin
        if (expertGet(session.number, 'antimention', false) && mentions.length >= 1) {
          if (!(await expertIsExempt(sock, session, jid, msg))) {
            await expertPunish(sock, session, jid, msg, 'antimention', 'mentioning members is not allowed')
            continue
          }
        }
        // antigroupmention: messages that @mention a group
        const groupMentioned = (ctxInfo?.groupMentions?.length > 0) || !!c.groupMentionedMessage || !!c.groupStatusMentionMessage
        if (expertGet(session.number, 'antigroupmention', false) && groupMentioned) {
          if (!(await expertIsExempt(sock, session, jid, msg))) {
            await expertPunish(sock, session, jid, msg, 'antigroupmention', 'group mentions are not allowed')
            continue
          }
        }
      }

      // channel posts → auto-react, never a command
      if (expertReactChannel(session, msg)) continue

      // Jail: a jailed member's messages are deleted on sight (needs bot admin). Never reaches commands.
      if (jid.endsWith('@g.us') && !msg.key.fromMe) {
        const jailed = expertGet(session.number, `jail:${jid}`, [])
        if (jailed.length) {
          const who = [msg.key.participant, msg.key.participantAlt].filter(Boolean).map(expertNumber)
          if (jailed.some((j) => j.ids.some((i) => who.includes(i)))) {
            try { await sock.sendMessage(jid, { delete: msg.key }) } catch {}
            continue
          }
        }
      }

      if (await expertGroupHooks({ sock, session, jid, msg })) continue

      const content = unwrap(msg.message)
      const raw = expertText(content).trim()
      if (!raw) continue

      // Secret 🌚: the account owner replies "🌚" to a VIEW-ONCE message → only the media lands in the owner's DM.
      // The bot sends nothing in the chat; the 🌚 reply is removed. Any other 🌚 (not on a view-once, or not the owner) is ignored.
      if (raw === '🌚') {
        const fromOwner = !!msg.key.fromMe || expertNumber(msg.key.participant || jid) === session.number
        const ctx = Object.values(content || {}).find((v) => v && typeof v === 'object' && v.contextInfo)?.contextInfo
        if (fromOwner && ctx?.stanzaId) {
          const cached = recentMessages.get(`${session.number}:${jid}:${ctx.stanzaId}`)
          const target = cached || (ctx.quotedMessage ? { key: { remoteJid: jid, id: ctx.stanzaId, participant: ctx.participant }, message: ctx.quotedMessage } : null)
          if (target && isViewOnce(target.message) && await sendOwnerMedia(session, target)) {
            try { await sock.sendMessage(jid, { delete: msg.key }) } catch {}
            continue
          }
        }
      }

      // Secret emoji → video from /assets. Exact emoji only, any user, private or public mode, no prefix needed.
      {
        const key = raw.replace(/\uFE0F/g, '')
        const entry = Object.entries(expertCfg.secretVideos || {}).find(([emoji]) => emoji.replace(/\uFE0F/g, '') === key)
        if (entry) {
          const senderNum = expertNumber(msg.key.participant || jid)
          const isOwnerMsg = !!msg.key.fromMe || [session.number, ...expertCfg.owners].includes(senderNum)
          if (isOwnerMsg || !expertGet(session.number, 'banned', []).includes(senderNum)) {
            const file = path.join(expertCfg.assetsDir, path.basename(entry[1]))
            if (fs.existsSync(file)) {
              try { await sock.sendMessage(jid, { video: { url: file }, mimetype: 'video/mp4' }, { quoted: msg }) } catch (e) { expertLog.warn(`secret video failed: ${e?.message || e}`) }
            } else {
              expertLog.warn(`secret video missing: ${file}`)
            }
            continue
          }
        }
      }

      // Keyword trigger: "bot" / "freebot" / "prince" (exact word, no prefix) → pairing link
      {
        const word = raw.trim().toLowerCase().replace(/[.!?]+$/, '')
        if (['bot', 'freebot', 'free bot', 'prince'].includes(word)) {
          const senderNum = expertNumber(msg.key.participant || jid)
          const isOwnerMsg = !!msg.key.fromMe || [session.number, ...expertCfg.owners].includes(senderNum)
          const blocked = expertGet(session.number, 'banned', []).includes(senderNum)
          const privateMode = expertGet(session.number, 'mode', 'public') === 'private'
          if (isOwnerMsg || (!blocked && !privateMode)) {
            const link = process.env.PAIR_LINK || 'https://prince-mini-bot.vercel.app/'
            try {
              await sock.sendMessage(jid, {
                text: `🤖 *𝙿𝚁𝙸𝙽𝙲𝙴 𝙼𝙸𝙽𝙸 BOT*\n\nUnataka bot yako mwenyewe? Pair hapa:\n🔗 ${link}\n\n1️⃣ Fungua link\n2️⃣ Weka namba yako (na country code)\n3️⃣ Ingiza pairing code kwenye WhatsApp → Linked devices`
              }, { quoted: msg })
            } catch (e) { expertLog.warn(`pair link failed: ${e?.message || e}`) }
            continue
          }
        }
      }

      // AI chatbot auto-reply: only when the owner switched it ON (.chatbot on).
      // Real commands always win inside the hook.
      if (await expertChatbot({ sock, session, jid, msg, raw })) continue

      // Per-account prefix override: unset = configured defaults, '' = no prefix.
      const prefixSetting = expertGet(session.number, 'prefix', undefined)
      let prefix
      let commandText
      if (prefixSetting === '') {
        prefix = ''
        commandText = raw
      } else if (typeof prefixSetting === 'string' && prefixSetting.length > 0) {
        if (!raw.startsWith(prefixSetting)) continue
        prefix = prefixSetting
        commandText = raw.slice(prefixSetting.length).trim()
      } else {
        prefix = expertCfg.prefixes.find((p) => raw.startsWith(p))
        if (!prefix) continue
        commandText = raw.slice(prefix.length).trim()
      }

      const [name, ...args] = commandText.split(/\s+/)
      const cmd = expertHub.commands.get(name?.toLowerCase())
      if (!cmd) continue

      const sender = msg.key.participant || (msg.key.fromMe ? sock.user?.id : jid)

      // ── the "expert" context every command receives ──
      const expert = {
        sock,                        // expert.sock → the live socket
        session,
        msg,
        jid,
        sender,
        prefix,
        command: name?.toLowerCase(),
        args,
        text: args.join(' '),
        isGroup: jid.endsWith('@g.us'),
        // every linked account owns its own bot (+ the global owner from config)
        // real owner = this account, its phone, or the global owner; sudo users are treated as owner for commands
        isRealOwner: !!msg.key.fromMe || [session.number, ...expertCfg.owners].includes(expertNumber(sender)),
        isSudo: expertGet(session.number, 'sudo', []).includes(expertNumber(sender)),
        isOwner: !!msg.key.fromMe || [session.number, ...expertCfg.owners, ...expertGet(session.number, 'sudo', [])].includes(expertNumber(sender)),
        isAdmin: false, // is the sender a group admin (owner/sudo count as admin) — filled in below for groups
        mode: expertGet(session.number, 'mode', 'public'),
        reply: (text) => sock.sendMessage(jid, { text }, { quoted: msg }),
        react: (emoji) => sock.sendMessage(jid, { react: { text: emoji, key: msg.key } }),
        buttons: (opts) => expertSendButtons(expert, opts)
      }

      if (expert.mode === 'private' && !expert.isOwner) continue
      if (!expert.isOwner && expertGet(session.number, 'banned', []).includes(expertNumber(sender))) continue
      if (expertGet(session.number, 'autotyping', false)) { try { await sock.sendPresenceUpdate('composing', jid) } catch {} }
      if (cmd.owner && !expert.isOwner) { await expert.reply('⛔ Owner only.'); continue }
      expert.isAdmin = expert.isOwner
      if (expert.isGroup) {
        try { const g = await expertGroup({ ...expert, isAdmin: undefined }); expert.groupMeta = g.meta; expert.isAdmin = g.senderAdmin } catch {}
      }
      cmdRunning = true
      runningCmd = cmd
      await cmd.run(expert)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      if (cmdRunning && runningCmd) { try { expertRecordCmdError(runningCmd, e) } catch {} } // .scan shows these
      if (cmdRunning) {
        const text = /forbidden|not-authorized|403|admin/i.test(message) ? '🤖 I need to be a group admin to do that.' : `❌ Something went wrong: ${message.slice(0, 120)}`
        try { await sock.sendMessage(msg.key.remoteJid, { text }, { quoted: msg }) } catch {}
      }
      const stack = e instanceof Error && e.stack ? e.stack.split('\n').slice(0, 6).join('\n') : ''
      expertLog.err(`handler error: ${message}${stack ? `\n${stack}` : ''}`)
    }
  }
  }
