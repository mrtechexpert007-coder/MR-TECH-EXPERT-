// ⟦EXPERT⟧ .alwaysonline on|off|status|time <sekunde>
// Keeps this account showing "online" all the time. Owner (and sudo) only.
import { expertGet, expertSet } from '../lib/expert.store.js'

const ON = ['on', 'enable', 'washa', '1', 'true']
const OFF = ['off', 'disable', 'zima', 'zimisha', '0', 'false']
const MIN_SECS = 10
const MAX_SECS = 60

export default {
  name: 'alwaysonline',
  aliases: ['aonline'],
  owner: true,
  desc: 'Keep the account showing as online. Usage: .alwaysonline on | off | time <sekunde>',
  async run(z) {
    const ns = z.session.number
    const sub = (z.args[0] || '').toLowerCase()
    const enabled = !!expertGet(ns, 'alwaysonline', false)
    const secs = expertGet(ns, 'alwaysonline:secs', 20)

    const status = () =>
      `🟢 *Always Online*: ${enabled ? '🟢 IMEWASHWA' : '🔴 IMEZIMWA'}\n` +
      `⏱️ Inajirudia kila: *sekunde ${secs}*`

    const usage = `${z.prefix}alwaysonline on | off | time <sekunde ${MIN_SECS}-${MAX_SECS}>`

    if (!sub || sub === 'status') {
      return z.buttons({
        text: `${status()}\n\n_${usage}_`,
        buttons: [
          { id: `${z.prefix}alwaysonline on`, text: '🟢 Washa' },
          { id: `${z.prefix}alwaysonline off`, text: '🔴 Zima' }
        ]
      })
    }

    if (ON.includes(sub)) {
      expertSet(ns, 'alwaysonline', true)
      try { await z.sock.sendPresenceUpdate('available') } catch {}
      return z.reply(
        `✅ Always Online *imewashwa*. Akaunti itaonekana "online" muda wote.\n\n${status()}\n\n` +
        `_Kumbuka: ikiwa ON, simu yako inaweza kuletewa notification chache kwa sababu WhatsApp inadhani kifaa kiko active._`
      )
    }

    if (OFF.includes(sub)) {
      expertSet(ns, 'alwaysonline', false)
      try { await z.sock.sendPresenceUpdate('unavailable') } catch {}
      return z.reply(`🔴 Always Online *imezimwa*.\n\n${z.prefix}alwaysonline on — kuwasha`)
    }

    if (['time', 'muda', 'secs', 'seconds', 'interval'].includes(sub)) {
      const n = Math.round(Number(z.args[1]))
      if (!Number.isFinite(n) || n < MIN_SECS || n > MAX_SECS) {
        return z.reply(`Usage: ${z.prefix}alwaysonline time <sekunde ${MIN_SECS}-${MAX_SECS}>\nMfano: ${z.prefix}alwaysonline time 15`)
      }
      expertSet(ns, 'alwaysonline:secs', n)
      return z.reply(`⏱️ Always Online itajirudia kila *sekunde ${n}*.`)
    }

    return z.reply(`${status()}\n\nUsage: ${usage}`)
  }
}
