// ⟦EXPERT⟧ presence features: autotyping · autorecording · autoread · alwaysonline
import { expertGet, expertSet } from './expert.store.js'

const pauseTimers = new Map() // `${number}|${jid}` -> timeout

/** "on" / "off" / (nothing → toggle) → boolean */
function parseSwitch(arg, current) {
  const a = String(arg || '').toLowerCase()
  if (['on', 'enable', 'true', '1'].includes(a)) return true
  if (['off', 'disable', 'false', '0'].includes(a)) return false
  return !current
}

/** builds an owner-only on/off switch command; `onChange(z, value)` runs after the switch is stored */
export function expertSwitchCommand({ name, aliases, desc, label, exclusive, onChange }) {
  return {
    name,
    aliases,
    owner: true,
    desc,
    async run(z) {
      const ns = z.session.number
      const cur = expertGet(ns, name, false)
      const next = parseSwitch(z.args[0], cur)
      expertSet(ns, name, next)
      if (next && exclusive) expertSet(ns, exclusive, false) // typing and recording can't both show at once
      if (onChange) await onChange(z, next)
      await z.reply(
        `⚙️ *${name}* is now *${next ? 'ON' : 'OFF'}*\n${label}` +
        (next && exclusive ? `\n_(${exclusive} was switched OFF — only one can show at a time)_` : '') +
        `\n\nUse: ${z.prefix}${name} on | off`
      )
    }
  }
}

const subscribed = new Set() // `${number}|${jid}` already presence-subscribed (WhatsApp needs it for "typing…" to show)

/** called for every incoming message: shows "typing…" / "recording…" */
export async function expertPresenceOnMessage(sock, session, msg) {
  if (!msg?.key || msg.key.fromMe) return
  const jid = msg.key.remoteJid
  if (!jid || jid === 'status@broadcast' || jid.endsWith('@newsletter') || jid.endsWith('@broadcast')) return
  if (msg.message?.protocolMessage || msg.message?.reactionMessage) return

  const ns = session.number
  const isGroup = jid.endsWith('@g.us')
  // autorecording wins if both are somehow on; each has its own scope (all | dm | groups) and duration
  const kind = expertGet(ns, 'autorecording', false) ? 'autorecording' : expertGet(ns, 'autotyping', false) ? 'autotyping' : null
  if (!kind) return
  const scope = expertGet(ns, `${kind}:scope`, 'all')
  if (scope === 'dm' && isGroup) return
  if (scope === 'groups' && !isGroup) return
  const state = kind === 'autorecording' ? 'recording' : 'composing'
  const secs = Math.min(30, Math.max(1, Number(expertGet(ns, `${kind}:secs`, 5)) || 5))

  try {
    const k = `${ns}|${jid}`
    if (!subscribed.has(k)) {
      subscribed.add(k)
      if (subscribed.size > 3000) subscribed.delete(subscribed.values().next().value)
      try { await sock.presenceSubscribe?.(jid) } catch {}
    }
    await sock.sendPresenceUpdate(state, jid)
    clearTimeout(pauseTimers.get(k))
    pauseTimers.set(k, setTimeout(() => {
      pauseTimers.delete(k)
      sock.sendPresenceUpdate('paused', jid).catch(() => {})
    }, secs * 1000))
  } catch {}
}

/** keeps the account showing "online" while alwaysonline is ON. Call once per socket when it opens. */
export function expertStartAlwaysOnline(session, sock) {
  clearTimeout(session.onlineTimer)
  const ns = session.number
  let wasOn = false
  const tick = async () => {
    if (session.sock !== sock || session.closed) return // old/closed socket → stop the loop
    if (session.opened) {
      const on = expertGet(ns, 'alwaysonline', false)
      try {
        if (on) await sock.sendPresenceUpdate('available')
        else if (wasOn) await sock.sendPresenceUpdate('unavailable')
      } catch {}
      wasOn = on
    }
    const secs = Math.min(60, Math.max(10, Number(expertGet(ns, 'alwaysonline:secs', 20)) || 20))
    session.onlineTimer = setTimeout(tick, secs * 1000)
    session.onlineTimer.unref?.()
  }
  tick()
}

export function expertStopAlwaysOnline(session) {
  clearTimeout(session.onlineTimer)
  session.onlineTimer = null
  }
