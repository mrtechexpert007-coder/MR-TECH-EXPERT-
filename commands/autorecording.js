// ⟦EXPERT⟧ .autorecording on|off|dm|groups|all|time <sekunde>|status
// Shows "recording audio…" to anyone who messages you. Owner (and sudo) only.
import { expertGet, expertSet } from '../lib/expert.store.js'

const ON = ['on', 'enable', 'washa', '1', 'true']
const OFF = ['off', 'disable', 'zima', 'zimisha', '0', 'false']
const SCOPES = { all: 'kila chat', dm: 'DM (chat za mtu mmoja) tu', groups: 'makundi tu' }
const MIN_SECS = 1
const MAX_SECS = 30

export default {
  name: 'autorecording',
  aliases: ['autorecord', 'recording'],
  owner: true,
  desc: 'Show "recording audio…" when someone messages you. Usage: .autorecording on | off | dm | groups | all | time <sekunde>',
  async run(z) {
    const ns = z.session.number
    const sub = (z.args[0] || '').toLowerCase()
    const arg = z.args[1]
    const enabled = !!expertGet(ns, 'autorecording', false)
    const scope = expertGet(ns, 'autorecording:scope', 'all')
    const secs = expertGet(ns, 'autorecording:secs', 5)

    const status = () =>
      `🎙️ *Autorecording*: ${enabled ? '🟢 IMEWASHWA' : '🔴 IMEZIMWA'}\n` +
      `📍 Wapi: *${SCOPES[scope] || SCOPES.all}*\n` +
      `⏱️ Muda: *sekunde ${secs}*`

    const usage = `${z.prefix}autorecording on | off | dm | groups | all | time <sekunde>`

    if (!sub || sub === 'status') {
      return z.buttons({
        text: `${status()}\n\n_${usage}_`,
        buttons: [
          { id: `${z.prefix}autorecording on`, text: '🟢 Washa' },
          { id: `${z.prefix}autorecording off`, text: '🔴 Zima' }
        ]
      })
    }

    if (ON.includes(sub)) {
      expertSet(ns, 'autorecording', true)
      let extra = ''
      if (expertGet(ns, 'autotyping', false)) {
        expertSet(ns, 'autotyping', false) // typing and recording can't both show at once
        extra = '\n_(autotyping imezimwa — kimoja tu kinaweza kuonekana kwa wakati mmoja)_'
      }
      return z.reply(`✅ Autorecording *imewashwa*. Watu wataona "recording audio…" wakikutumia ujumbe.${extra}\n\n${status()}`)
    }

    if (OFF.includes(sub)) {
      expertSet(ns, 'autorecording', false)
      return z.reply(`🔴 Autorecording *imezimwa*.\n\n${z.prefix}autorecording on — kuwasha`)
    }

    if (SCOPES[sub]) {
      expertSet(ns, 'autorecording:scope', sub)
      return z.reply(`📍 Autorecording itaonekana: *${SCOPES[sub]}*${enabled ? '' : `\n\n⚠️ Bado imezimwa. Tuma ${z.prefix}autorecording on`}`)
    }

    if (['time', 'muda', 'secs', 'seconds'].includes(sub)) {
      const n = Math.round(Number(arg))
      if (!Number.isFinite(n) || n < MIN_SECS || n > MAX_SECS) {
        return z.reply(`Usage: ${z.prefix}autorecording time <sekunde ${MIN_SECS}-${MAX_SECS}>\nMfano: ${z.prefix}autorecording time 10`)
      }
      expertSet(ns, 'autorecording:secs', n)
      return z.reply(`⏱️ "recording audio…" itaonekana kwa *sekunde ${n}*.`)
    }

    return z.reply(`${status()}\n\nUsage: ${usage}`)
  }
        }
