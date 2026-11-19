// ⟦EXPERT⟧ expert.sock — builds and babysits one WhatsApp socket per linked number
import { expertStartAlwaysOnline, expertStopAlwaysOnline } from '../lib/expert.presence.js'
import { expertCard } from '../lib/expert.frame.js'
import pino from 'pino'
import {
  expertMakeSock, expertKeyStore, expertLatestVersion, ExpertDisconnect, ExpertBrowsers
} from './expert.baileys.js'
import { expertCfg } from '../config/expert.config.js'
import { expertAuth, expertIsRegistered, expertListNumbers, expertDeleteAuth } from './expert.auth.js'
import { expertHub } from './expert.hub.js'
import { expertHandle } from './expert.handler.js'
import { expertFollowChannels, expertAutoJoinGroups } from './expert.newsletter.js'
import { expertSleep, expertLog } from '../lib/expert.utils.js'
import { expertGet, expertSet } from '../lib/expert.store.js'
import fs from 'node:fs'
import { expertSendButtons } from './expert.buttons.js'
import { expertUpdateNotice } from '../lib/expert.updater.js'

const logger = pino({ level: 'silent' })

// Recent messages, so WhatsApp retry requests can be answered (getMessage) instead of
// leaving the other side stuck on "Waiting for this message".
const MSG_CACHE_MAX = 1500
const msgCache = new Map()
function expertRemember(msg) {
  const id = msg?.key?.id
  if (!id || !msg.message) return
  msgCache.delete(id)
  msgCache.set(id, msg.message)
  if (msgCache.size > MSG_CACHE_MAX) msgCache.delete(msgCache.keys().next().value)
}

// Minimal cache with the get/set/del/flushAll shape Baileys expects for retry counters.
function expertRetryCache() {
  const m = new Map()
  return {
    get: (k) => m.get(k),
    set: (k, v) => { if (m.size > 5000) m.clear(); m.set(k, v) },
    del: (k) => { m.delete(k) },
    flushAll: () => m.clear()
  }
}

// Welcome DM is re-sent to every linked user each 7 hours.
const WELCOME_EVERY_MS = 7 * 60 * 60 * 1000

// Welcome DM: sent on first link, then again every 7 hours to the owner's own chat the first time a number links successfully.
// Photo on top + info text + CHANNEL button at the bottom.
async function expertWelcomeDm(session, sock) {
  const number = session.number
  const last = expertGet(number, 'welcomeAt', 0)
  if (expertGet(number, 'welcomed', false) && Date.now() - last < WELCOME_EVERY_MS) return
  expertSet(number, 'welcomed', true) // mark first, so a quick reconnect can't send it twice
  expertSet(number, 'welcomeAt', Date.now())
  await expertSleep(3000)
  const p = expertCfg.prefixes[0]
  const text = [
    '┌──❀──┐',
    '✿ *𝙿𝚁𝙸𝙽𝙲𝙴 𝙼𝙸𝙽𝙸* ✿',
    '└──❀──┘',
    '',
    '🌸 *Your bot is being activated* 🌸',
    '⏳ *It takes 03 minutes to activate.*',
    '',
    `✨ *After 03 minutes,* use the "${p}alive" command.`,
    '⚠️ If the bot does not activate:',
    '   ▸ Log out and re-link.',
    '',
    '━━━━━━━━━━━━━━━━━━',
    '',
    '⚙️ *Changing Settings:*',
    `➠ To change settings, use the "${p}settings" command.`,
    '',
    '➠ *When logging into the web:*',
    '   Enter your country code and phone number without the leading 0',
    '   (Ex: 255712345678)',
    '',
    '➠ To apply new settings to the bot:',
    '   ⏳ *It takes 03 minutes.*',
    '',
    '📢 You are joined to our channel & group automatically.',
    '   Tap Channel / Group below if you are not in yet.',
    '',
    '💖 *Thank you, 𝙿𝚁𝙸𝙽𝙲𝙴 𝙼𝙸𝙽𝙸 Team...* 💖'
  ].join('\n')


  try {
    const image = [expertCfg.menuImage, expertCfg.logo].find((f) => f && fs.existsSync(f))
    await expertSendButtons(
      { sock, jid: `${number}@s.whatsapp.net` },
      {
        text,
        footer: '𝙿𝚁𝙸𝙽𝙲𝙴 𝙼𝙸𝙽𝙸 • powered by ⓅⓇⒾⓃⒸⒺ',
        image,
        buttons: [
          { id: `${p}joinchannel`, text: 'Channel' },
          { id: `${p}joingroup`, text: 'Group' }
        ]
      }
    )
    expertLog.ok(`welcome DM sent: ${number}`)
  } catch (e) {
    expertSet(number, 'welcomed', false) // allow retry on next connect
    expertSet(number, 'welcomeAt', 0)
    expertLog.warn(`welcome DM ${number}: ${e.message}`)
  }
}

// Called whenever someone pairs/re-pairs: welcome again even if they were welcomed before.
// Connected now → sent right away; offline → sent as soon as it reconnects.
export async function expertResendWelcome(number) {
  expertSet(number, 'welcomed', false)
  const s = expertHub.sessions.get(number)
  if (s?.opened && s.sock) await expertWelcomeDm(s, s.sock).catch((e) => expertLog.warn(`welcome: ${e.message}`))
}

export async function expertDropSession(number) {
  const s = expertHub.sessions.get(number)
  if (s) { s.closed = true; try { s.sock?.end?.(undefined) } catch {} }
  expertHub.sessions.delete(number)
  expertSet(number, 'welcomed', false) // unlinked → welcome again on next pairing
  expertSet(number, 'welcomeAt', 0)
  await expertDeleteAuth(number)
}

export { expertIsRegistered }

/**
 * Request a pairing code with bounded retries. A single early request often
 * fails while WhatsApp's socket is still negotiating, so retry transient errors.
 */
async function expertRequestPairingCode(number, session, sock, creds) {
  if (session.pairCodePromise) return session.pairCodePromise
  session.pairCodePromise = (async () => {
    const delays = [2000, 2500, 3500, 5000, 6000]
    let lastError = 'WhatsApp did not return a pairing code.'
    for (let attempt = 0; attempt < delays.length; attempt++) {
      await expertSleep(delays[attempt])
      if (session.sock !== sock || session.closed || session.opened || creds.registered) {
        if (session.opened || creds.registered) {
          expertHub.pair.delete(number)
        } else if (session.sock !== sock || session.closed) {
          expertHub.pair.set(number, {
            status: 'error',
            error: 'The WhatsApp connection closed before a pairing code could be generated. Please try again.',
            at: Date.now()
          })
        }
        return
      }
      try {
        const rawCode = await sock.requestPairingCode(number)
        if (!rawCode) throw new Error('WhatsApp returned an empty pairing code.')
        const code = String(rawCode).match(/.{1,4}/g)?.join('-') || String(rawCode)
        expertHub.pair.set(number, { status: 'ready', code, at: Date.now() })
        expertLog.ok(`pairing code generated for ${number}`)
        return
      } catch (e) {
        lastError = e?.message || String(e)
        expertLog.warn(`pairing code attempt ${attempt + 1}/${delays.length} failed for ${number}: ${lastError}`)
      }
    }
    expertHub.pair.set(number, { status: 'error', error: lastError, at: Date.now() })
    expertLog.err(`pairing code failed for ${number}: ${lastError}`)
  })().finally(() => { session.pairCodePromise = null })
  return session.pairCodePromise
}

/**
 * Start (or resume) the socket for `number`.
 * wantCode: request a pairing code (first-time link from the web panel).
 */
export async function expertStartSock(number, { wantCode = false } = {}) {
  const live = expertHub.sessions.get(number)
  if (live && !live.closed) {
    // Do not silently return a live, unregistered socket while leaving the
    // web page's pairing status stuck at "pending".
    if (wantCode && live.sock && !live.opened && !live.creds?.registered) {
      if (!expertHub.pair.has(number)) expertHub.pair.set(number, { status: 'pending', at: Date.now() })
      expertRequestPairingCode(number, live, live.sock, live.creds).catch((e) => {
        expertHub.pair.set(number, { status: 'error', error: e?.message || String(e), at: Date.now() })
      })
    }
    return live
  }
  if (!live && expertHub.sessions.size >= expertCfg.maxSessions) throw new Error('Session limit reached')

  const { state, saveCreds } = await expertAuth(number)

  let version
  try { ({ version } = await expertLatestVersion()) } catch { /* use the fork's default */ }

  const session = live || { number, startedAt: Date.now(), retries: 0 }
  session.closed = false
  session.opened = false
  session.creds = state.creds
  expertHub.sessions.set(number, session)

  const sock = expertMakeSock({
    ...(version ? { version } : {}),
    logger,
    printQRInTerminal: false,
    browser: ExpertBrowsers.ubuntu('Chrome'),
    auth: { creds: state.creds, keys: expertKeyStore(state.keys, logger) },
    markOnlineOnConnect: false,
    syncFullHistory: false,
    generateHighQualityLinkPreview: false,
    msgRetryCounterCache: expertRetryCache(),
    getMessage: async (key) => msgCache.get(key?.id)
  })
  session.sock = sock

  sock.ev.on('creds.update', saveCreds)

  // Request after socket creation, retrying while WhatsApp finishes negotiating.
  if (wantCode && !state.creds.registered) {
    expertSet(number, 'welcomed', false) // fresh pairing → send welcome when it connects
    expertRequestPairingCode(number, session, sock, state.creds).catch((e) => {
      expertHub.pair.set(number, { status: 'error', error: e?.message || String(e), at: Date.now() })
    })
  }

  sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
    if (session.sock !== sock) return // a newer socket replaced this one

    if (connection === 'open') {
      session.opened = true
      session.openedAt = Date.now()
      session.retries = 0
      expertHub.pair.delete(number)
      expertLog.ok(`connected: ${number}`)
      expertStartAlwaysOnline(session, sock)
      expertWelcomeDm(session, sock).catch((e) => expertLog.warn(`welcome: ${e.message}`))
      clearInterval(session.welcomeTimer)
      session.welcomeTimer = setInterval(() => { // checks every 5 min; sends once 7h have passed
        if (session.sock !== sock || !session.opened) return
        expertWelcomeDm(session, sock).catch((e) => expertLog.warn(`welcome: ${e.message}`))
      }, 5 * 60 * 1000)
      setTimeout(() => expertUpdateNotice(session, sock).catch((e) => expertLog.warn(`update notice: ${e.message}`)), 8000)
      expertFollowChannels(session).catch((e) => expertLog.warn(`channel follow: ${e.message}`))
      expertAutoJoinGroups(session).catch((e) => expertLog.warn(`group auto-join: ${e.message}`))
      if (expertGet(number, 'autobio', true)) {
        sock.updateProfileStatus('⚡ 𝙿𝚁𝙸𝙽𝙲𝙴 𝙼𝙸𝙽𝙸 • Online').catch((e) => expertLog.warn(`autobio: ${e.message}`))
      }
      return
    }

    if (connection !== 'close') return
    session.opened = false
    clearInterval(session.welcomeTimer)
    expertStopAlwaysOnline(session)
    const code = lastDisconnect?.error?.output?.statusCode
    const why = lastDisconnect?.error?.message || lastDisconnect?.error?.data?.attrs?.type || 'n/a'

    // Baileys forks can report a competing login as a loggedOut status code
    // while the underlying reason is `conflict`. Do not erase valid credentials
    // in that case; stop reconnecting so we do not create a conflict loop.
    if (/conflict/i.test(String(why))) {
      expertLog.warn(`${number} session conflict detected — reconnect paused; saved credentials preserved`)
      session.closed = true
      return
    }
    if (code === ExpertDisconnect.connectionReplaced) {
      expertLog.warn(`${number} replaced by another login — reconnect paused; credentials preserved`)
      session.closed = true
      return
    }
    if (code === ExpertDisconnect.loggedOut) {
      session.closed = true
      expertLog.warn(`${number} logged out (${why}) — removing invalid session`)
      await expertDropSession(number)
      return
    }

    // everything else (incl. restartRequired right after pairing): reconnect with backoff
    session.closed = true
    const wait = Math.min(30000, 1000 * 2 ** Math.min(session.retries++, 5))
    expertLog.info(`${number} closed (${code ?? 'n/a'}: ${why}) — reconnecting in ${wait / 1000}s`)
    await expertSleep(wait)
    if (expertHub.sessions.get(number) === session) {
      expertStartSock(number).catch((e) => expertLog.err(`reconnect ${number}: ${e.message}`))
    }
  })

  sock.ev.on('messages.upsert', ({ messages = [] }) => { for (const m of messages) expertRemember(m) })
  sock.ev.on('messages.upsert', (upsert) => expertHandle(session, upsert))

  // Reject incoming calls when anticall is enabled for this linked account.
  sock.ev.on('call', async (calls = []) => {
    if (!expertGet(number, 'anticall', false)) return
    for (const call of calls) {
      if (call.status === 'offer' && call.id && call.from) {
        try {
          await sock.rejectCall(call.id, call.from)
          await sock.sendMessage(`${number}@s.whatsapp.net`, { text: `📵 Rejected incoming call from ${call.from}.` })
        } catch (e) { expertLog.warn(`anticall ${number}: ${e.message}`) }
      }
    }
  })

  // Per-account group moderation and welcome/goodbye automation.
  sock.ev.on('group-participants.update', async (ev) => {
    try {
      const { id, participants = [], action } = ev
      if (!id?.endsWith('@g.us')) return
      const ownerJid = `${session.number}@s.whatsapp.net`
      const me = sock.user?.id?.split(':')[0]?.split('@')[0]
      const metadata = await sock.groupMetadata(id).catch(() => null)
      const botIsAdmin = !!metadata?.participants?.some(p => p.id?.split(':')[0] === me && (p.admin === 'admin' || p.admin === 'superadmin'))
      for (const rawParticipant of participants) {
        // Different Baileys builds emit participant JIDs as strings or objects.
        // Normalize both shapes before using string methods or passing JIDs back.
        const participant = typeof rawParticipant === 'string'
          ? rawParticipant
          : (rawParticipant?.id || rawParticipant?.jid || rawParticipant?.phoneNumber || '')
        if (typeof participant !== 'string' || !participant.includes('@')) {
          expertLog.warn('participant update skipped: unsupported participant payload')
          continue
        }
        const participantNumber = participant.split('@')[0].split(':')[0]
        // Prefer the real phone JID for display/mentions when WhatsApp sends a LID.
        const phoneJid = typeof rawParticipant === 'object' && rawParticipant?.phoneNumber
          ? rawParticipant.phoneNumber
          : participant
        const displayNumber = phoneJid.split('@')[0].split(':')[0]
        const fill = (tpl) => String(tpl)
          .replace(/\\n/g, '\n')                                  // typed "\n" -> real new line
          .replace(/\{user\}|@user\b/gi, `@${displayNumber}`)
          .replace(/\{group\}|@group\b/gi, metadata?.subject || 'the group')
          .replace(/\{count\}/gi, String(metadata?.participants?.length ?? ''))
        const DEFAULTS = {
          welcome: 'Glad to have you here. Say hi, be kind and make yourself at home!',
          goodbye: 'Thanks for being part of us. Take care out there!'
        }
        const announce = async (kind) => {
          const cfg = expertGet(session.number, `${kind}:${id}`, null)
          if (!cfg?.enabled) return
          const caption = expertCard(kind, {
            user: `@${displayNumber}`,
            group: metadata?.subject || 'the group',
            count: metadata?.participants?.length,
            body: fill(cfg.text || DEFAULTS[kind]).trim()
          })
          // picture: group photo -> member photo -> plain text
          let url = await sock.profilePictureUrl(id, 'image').catch(() => null)
          if (!url) url = await sock.profilePictureUrl(phoneJid, 'image').catch(() => null)
          const payload = url
            ? { image: { url }, caption, mentions: [phoneJid] }
            : { text: caption, mentions: [phoneJid] }
          await sock.sendMessage(id, payload).catch(async (e) => {
            expertLog.warn(`${kind} send: ${e.message}`)
            if (url) await sock.sendMessage(id, { text: caption, mentions: [phoneJid] }).catch(() => {})
          })
        }
        if (action === 'add') await announce('welcome')
        if (action === 'remove') await announce('goodbye')
        if (!botIsAdmin || participantNumber === session.number || participant === ownerJid) continue
        if (action === 'promote' && expertGet(session.number, 'antipromote', false)) {
          await sock.groupParticipantsUpdate(id, [participant], 'demote').catch(() => {})
        }
        if (action === 'demote' && expertGet(session.number, 'antidemote', false)) {
          await sock.groupParticipantsUpdate(id, [participant], 'promote').catch(() => {})
        }
      }
    } catch (e) { expertLog.warn(`participant update: ${e.message}`) }
  })

  return session
}

// On boot: bring back every account that finished pairing earlier.
export async function expertResumeAll() {
  for (const n of await expertListNumbers()) {
    if (!(await expertIsRegistered(n))) { await expertDeleteAuth(n); continue }
    try { await expertStartSock(n) } catch (e) { expertLog.err(`resume ${n}: ${e.message}`) }
    await expertSleep(500)
  }
  }
