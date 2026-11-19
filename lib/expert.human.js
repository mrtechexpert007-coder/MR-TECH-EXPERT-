// ⟦EXPERT⟧ human check — Cloudflare Turnstile.
// Visitor solves the widget → POST /api/verify → gets a signed 10-minute "pass".
// The pass is an HMAC, so every server that shares TURNSTILE_SECRET accepts it (multi-server friendly).
// Without TURNSTILE_SECRET + TURNSTILE_SITEKEY the check is OFF (so the site keeps working until you set the keys).
import crypto from 'node:crypto'
import { expertLog } from './expert.utils.js'

const secret = () => process.env.TURNSTILE_SECRET || ''
const sitekey = () => process.env.TURNSTILE_SITEKEY || ''
const TTL = 10 * 60_000
export const expertHumanEnabled = () => !!(secret() && sitekey())
export const expertHumanSitekey = () => (expertHumanEnabled() ? sitekey() : '')

const sign = (exp) => crypto.createHmac('sha256', 'pass:' + secret()).update(String(exp)).digest('hex')

export function expertCheckPass(pass) {
  if (!expertHumanEnabled()) return true
  const [exp, mac] = String(pass || '').split('.')
  if (!/^\d{10,15}$/.test(exp || '') || !/^[0-9a-f]{64}$/.test(mac || '')) return false
  if (Number(exp) < Date.now()) return false
  return crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(sign(exp)))
}

export async function expertExchangeToken(token, ip) {
  if (!expertHumanEnabled()) return { ok: true, pass: '' }
  if (typeof token !== 'string' || !token || token.length > 2048) return { ok: false, error: 'Missing human check.' }
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: secret(), response: token, remoteip: ip }),
      signal: AbortSignal.timeout(10000)
    })
    const j = await r.json()
    if (!j.success) return { ok: false, error: 'Human check failed. Please try again.' }
    const exp = Date.now() + TTL
    return { ok: true, pass: `${exp}.${sign(exp)}` }
  } catch (e) {
    expertLog.warn('turnstile: ' + e.message)
    return { ok: false, error: 'Human check unavailable. Try again shortly.', status: 503 }
  }
}
