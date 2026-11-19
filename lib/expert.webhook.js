// ⟦EXPERT⟧ GitHub webhook — a push to UPDATE_BRANCH deploys instantly (no waiting for the poller)
import crypto from 'node:crypto'
import express from 'express'
import { expertLog } from './expert.utils.js'
import { expertApplyUpdate, expertRestartSoon } from './expert.updater.js'

const secret = () => process.env.GITHUB_WEBHOOK_SECRET || ''
const branch = () => process.env.UPDATE_BRANCH || 'main'
const repo = () => (process.env.UPDATE_REPO || '').replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').trim().toLowerCase()

function validSignature(raw, header) {
  if (!secret() || typeof header !== 'string' || !header.startsWith('sha256=')) return false
  const want = Buffer.from('sha256=' + crypto.createHmac('sha256', secret()).update(raw).digest('hex'))
  const got = Buffer.from(header)
  return want.length === got.length && crypto.timingSafeEqual(want, got)
}

let pending = false
async function deploy(sha) {
  if (pending) return
  pending = true
  try {
    const u = await expertApplyUpdate()
    if (u.heroku) return expertLog.ok(`webhook: Heroku build ${u.build} started for ${sha.slice(0, 7)}`)
    expertLog.ok(`webhook: ${sha.slice(0, 7)} applied (${u.files} files) — restarting`)
    expertRestartSoon(1500)
  } catch (e) { expertLog.warn('webhook deploy: ' + e.message) }
  finally { pending = false }
}

// Mount BEFORE express.json() — the signature is computed over the raw body.
export function expertWebhookRoute(app) {
  app.post('/api/github/webhook', express.raw({ type: '*/*', limit: '2mb' }), (req, res) => {
    if (!secret()) return res.status(503).json({ error: 'GITHUB_WEBHOOK_SECRET is not set' })
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0)
    if (!validSignature(raw, req.get('x-hub-signature-256'))) return res.status(401).json({ error: 'bad signature' })

    const event = req.get('x-github-event')
    if (event === 'ping') return res.json({ ok: true, pong: true })
    if (event !== 'push') return res.json({ ok: true, ignored: event })

    let p
    try { p = JSON.parse(raw.toString('utf8')) } catch { return res.status(400).json({ error: 'bad json' }) }
    if (p.ref !== `refs/heads/${branch()}`) return res.json({ ok: true, ignored: p.ref })
    if (repo() && String(p.repository?.full_name || '').toLowerCase() !== repo()) return res.json({ ok: true, ignored: 'other repo' })
    if (p.deleted) return res.json({ ok: true, ignored: 'branch deleted' })

    res.status(202).json({ ok: true, deploying: String(p.after || '').slice(0, 7) })
    deploy(String(p.after || ''))   // answer GitHub first (10s limit), build in the background
  })
}
