
// ⟦EXPERT⟧ web pairing API — POST /api/webpair/start, GET /api/webpair/status
import express from 'express'
import path from 'node:path'
import { expertCfg } from '../config/expert.config.js'
import { expertHub } from './expert.hub.js'
import { expertStartSock, expertIsRegistered, expertDropSession, expertResendWelcome } from './expert.sock.js'
import { expertListNumbers } from './expert.auth.js'
import { expertGet, expertSet } from '../lib/expert.store.js'
import { expertLog } from '../lib/expert.utils.js'
import { expertWebhookRoute } from '../lib/expert.webhook.js'
import { expertVoteLocalBg, EXPERT_VOTE_KEY } from '../lib/expert.vote.js'
import { expertHumanEnabled, expertHumanSitekey, expertCheckPass, expertExchangeToken } from '../lib/expert.human.js'

const lastByIp = new Map()
const VALID = /^\d{7,15}$/
const SERVER_NAME = process.env.SERVER_NAME || expertCfg.botName

// Public counters (saved through the settings store, so they survive restarts)
let views = 0, pairs = 0, dirty = false
const countView = () => { views++; dirty = true }
const lastContact = new Map() // ip -> last support message time (spam guard)
const clientIp = (req) => String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim()
setInterval(() => { const old = Date.now() - 3600000; for (const [k, t] of lastContact) if (t < old) lastContact.delete(k) }, 600000).unref()
const countPair = () => { pairs++; dirty = true }

// Server stats (cached 15s): total = accounts that finished pairing, online = currently connected
let statsCache = { at: 0, data: null }
async function expertStats() {
  if (statsCache.data && Date.now() - statsCache.at < 15000) return statsCache.data
  let total = 0
  for (const n of await expertListNumbers()) if (await expertIsRegistered(n)) total++
  const online = [...expertHub.sessions.values()].filter((s) => s.opened).length
  statsCache = { at: Date.now(), data: { server: SERVER_NAME, total, online, capacity: expertCfg.maxSessions } }
  return statsCache.data
}

export function expertServe() {
  const app = express()
  views = Number(expertGet('webpair', 'views', 0)) || 0
  pairs = Number(expertGet('webpair', 'pairs', 0)) || 0
  setInterval(() => {
    if (!dirty) return
    dirty = false
    try { expertSet('webpair', 'views', views); expertSet('webpair', 'pairs', pairs) } catch (e) { expertLog.warn('counter save: ' + e.message) }
  }, 10000).unref()
  app.set('trust proxy', 1)
  expertWebhookRoute(app)            // GitHub push → auto-deploy (needs the raw body, so before express.json)
  app.use(express.json({ limit: '8kb' }))

  // CORS: lets webpair.html on one server talk to the other servers' /api
  app.use('/api', (req, res, next) => {
    res.set({
      'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    })
    if (req.method === 'OPTIONS') return res.sendStatus(204)
    next()
  })

  // Server-to-server: another server's .vote command asks THIS server's accounts to vote.
  // Protected by VOTE_KEY (same value on every server).
  app.post('/api/vote', async (req, res) => {
    if (req.body?.key !== EXPERT_VOTE_KEY) return res.status(403).json({ error: 'forbidden' })
    const { code, postId, option } = req.body || {}
    if (!code || !postId || !option) return res.status(400).json({ error: 'bad request' })
    try { res.json(expertVoteLocalBg(String(code), String(postId), Number(option))) }
    catch (e) { res.status(500).json({ error: String(e?.message || e).slice(0, 120) }) }
  })

  app.get('/api/stats', async (_, res) => {
    try { res.json({ ...(await expertStats()), views, pairs }) }
    catch (e) { res.status(500).json({ error: 'stats unavailable' }) }
  })

  // Human check (Cloudflare Turnstile)
  app.get('/api/captcha', (_, res) => res.json({ enabled: expertHumanEnabled(), sitekey: expertHumanSitekey() }))
  app.post('/api/verify', async (req, res) => {
    const r = await expertExchangeToken(req.body?.token, clientIp(req))
    if (!r.ok) return res.status(r.status || 403).json({ error: r.error })
    res.json({ ok: true, pass: r.pass })
  })
  const needHuman = (req, res, next) => {
    if (expertCheckPass(req.body?.pass)) return next()
    res.status(403).json({ error: 'Please complete the human check first.', captcha: true })
  }

  app.get('/', (_, res) => res.redirect('/webpair'))
  app.get('/webpair', (_, res) => { countView(); res.sendFile(path.join(expertCfg.publicDir, 'webpair.html')) })
  app.get('/assets/logo.jpg', (_, res) => res.sendFile(expertCfg.logo))
  app.get('/assets/logo-small.jpg', (_, res) => { res.set('Cache-Control', 'public, max-age=604800'); res.sendFile(path.join(path.dirname(expertCfg.logo), 'logo-small.jpg')) })
  app.get('/health', (_, res) => res.json({
    status: 'ok',
    bot: expertCfg.botName,
    uptime: Math.floor(process.uptime()) + 's',
    linked: [...expertHub.sessions.values()].filter((s) => s.opened).length
  }))

  // Support form: the message is sent by the bot straight to the owner's WhatsApp
  app.post('/api/contact', needHuman, async (req, res) => {
    const clean = (v, n) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, n)
    const message = clean(req.body?.message, 500)
    const name = clean(req.body?.name, 40)
    const number = String(req.body?.number || '').replace(/\D/g, '').slice(0, 15)
    if (message.length < 5) return res.status(400).json({ error: 'Message too short.' })
    if (number && !VALID.test(number)) return res.status(400).json({ error: 'Invalid number.' })

    const ip = clientIp(req), now = Date.now()
    if (now - (lastContact.get(ip) || 0) < 60000) return res.status(429).json({ error: 'Please wait a minute.' })

    const ownerJid = `${expertCfg.owner}@s.whatsapp.net`
    const open = [...expertHub.sessions.values()].filter((s) => s.opened && s.sock)
    const sess = open.find((s) => expertCfg.owners.includes(String(s.number))) || open[0]
    if (!sess) return res.status(503).json({ error: 'No connected WhatsApp on this server.' })

    const time = new Date().toLocaleString('en-GB', { timeZone: 'Africa/Dar_es_Salaam', hour12: false })
    const text = [
      '📩 *PRINCE MINI · Support message*',
      '',
      `👤 Name: ${name || '-'}`,
      `📞 Number: ${number ? '+' + number : '-'}`,
      number ? `💬 wa.me/${number}` : null,
      `🕒 ${time}`,
      `🖥 ${SERVER_NAME}`,
      '',
      message
    ].filter((x) => x !== null).join('\n')

    try {
      await sess.sock.sendMessage(ownerJid, { text })
      lastContact.set(ip, now)
      res.json({ ok: true })
    } catch (e) {
      expertLog.err('support message: ' + e.message)
      res.status(502).json({ error: 'Could not deliver the message.' })
    }
  })

  app.post('/api/webpair/start', needHuman, async (req, res) => {
    const number = String(req.body?.number || '').replace(/\D/g, '')
    if (!VALID.test(number)) return res.status(400).json({ error: 'Enter a valid phone number with country code.' })

    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim()
    const now = Date.now()
    if (now - (lastByIp.get(ip) || 0) < 60000) {
      return res.status(429).json({ error: 'Please wait one minute before another pairing request.' })
    }
    const existingPair = expertHub.pair.get(number)
    if (existingPair?.status === 'pending' && now - Number(existingPair.at || now) < 120000) {
      return res.status(409).json({ error: 'A pairing request for this number is already running. Wait a moment for its code.' })
    }
    // Recover from an abandoned request left pending by an older socket or page.
    if (existingPair?.status === 'pending') expertHub.pair.delete(number)
    lastByIp.set(ip, now)

    // If the account is already linked and connected, do not issue a second code.
    const registered = await expertIsRegistered(number)
    if (!registered) {
      const st = await expertStats().catch(() => null)
      if (st && st.total >= st.capacity) {
        lastByIp.delete(ip)
        return res.status(503).json({ error: 'This server is full. Please choose another server.' })
      }
    }
    const live = expertHub.sessions.get(number)
    if (registered) expertResendWelcome(number).catch(() => {}) // welcome on every pair, even if paired before
    if (registered && live?.opened) {
      return res.status(202).json({ status: 'already-paired' })
    }

    // IMPORTANT: registered credentials must be resumed first. Previously this
    // path returned HTTP 409 without ever opening a socket, so an offline saved
    // session could never recover itself from the web-pair page. Preserve the
    // saved auth and let Baileys reconnect; if WhatsApp confirms logout, the
    // socket handler removes only this number's invalid auth and status polling
    // can then request a fresh code.
    if (registered) {
      expertHub.pair.set(number, { status: 'recovering', at: now })
      try {
        await expertStartSock(number)
        countPair()
        return res.status(202).json({ status: 'recovering' })
      } catch (e) {
        expertHub.pair.set(number, { status: 'error', error: `Could not resume the saved session: ${e.message}`, at: Date.now() })
        return res.status(500).json({ error: 'Could not resume the saved WhatsApp session. Please try again shortly.' })
      }
    }

    try {
      // stale, unregistered half-finished link → start clean so WhatsApp issues a fresh code
      await expertDropSession(number)
      expertHub.pair.set(number, { status: 'pending', at: now })
      await expertStartSock(number, { wantCode: true })
      countPair()
      return res.status(202).json({ status: 'started' })
    } catch (e) {
      expertHub.pair.delete(number)
      expertLog.err(`webpair start ${number}: ${e.message}`)
      return res.status(500).json({ error: 'Unable to start pairing right now.' })
    }
  })

  app.get('/api/webpair/status', async (req, res) => {
    const number = String(req.query.number || '').replace(/\D/g, '')
    if (!VALID.test(number)) return res.status(400).json({ error: 'Invalid phone number.' })

    const p = expertHub.pair.get(number)
    if (p?.status === 'ready') return res.json({ status: 'ready', code: p.code })
    if (p?.status === 'error') { expertHub.pair.delete(number); return res.status(500).json({ status: 'error', error: p.error }) }
    if (expertHub.sessions.get(number)?.opened) {
      expertHub.pair.delete(number)
      return res.json({ status: 'already-paired' })
    }

    // A saved session may be cleared by the socket handler only after WhatsApp
    // explicitly reports logout. Once that happens, continue the user's original
    // request by creating a fresh first-link socket. This is scoped to the number
    // that initiated recovery; no other user's sessions are touched.
    if (p?.status === 'recovering' && !(await expertIsRegistered(number))) {
      expertHub.pair.set(number, { status: 'pending', at: Date.now() })
      try {
        await expertStartSock(number, { wantCode: true })
      } catch (e) {
        expertHub.pair.set(number, { status: 'error', error: `Fresh pairing could not start: ${e.message}`, at: Date.now() })
        return res.status(500).json({ status: 'error', error: 'The old session was cleared, but a fresh pairing request could not start. Please retry.' })
      }
      return res.json({ status: 'pending' })
    }

    if (p?.status === 'recovering') {
      if (Date.now() - Number(p.at || Date.now()) > 90000) {
        return res.status(503).json({ status: 'error', error: 'The saved session is still offline. It has been preserved, not deleted. Check the original WhatsApp account for a linked-device or logout notice, then retry.' })
      }
      return res.json({ status: 'recovering' })
    }
    return res.json({ status: 'pending' })
  })

  app.listen(expertCfg.port, () => expertLog.ok(`web pair panel on port ${expertCfg.port} → /webpair`))
  return app
      }
