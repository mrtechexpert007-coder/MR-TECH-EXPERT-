// ⟦EXPERT⟧ .autotyping on|off|dm|groups|all|time <sekunde>|status
// Shows "typing…" to anyone who messages you. Owner (and sudo) only.
import { expertGet, expertSet } from '../lib/expert.store.js'

const ON = ['on', 'enable', 'washa', '1', 'true']
const OFF = ['off', 'disable', 'zima', 'zimisha', '0', 'false']
const SCOPES = { all: 'kila chat', dm: 'DM (chat za mtu mmoja) tu', groups: 'makundi tu' }
const MIN_SECS = 1
const MAX_SECS = 30

export default {
  name: 'autotyping',
  aliases: ['autotype', 'typing'],
  owner: true,
  desc: 'Show "typing…" when someone messages you. Usage: .autotyping on | off | dm | groups | all | time <sekunde>',
  async run(z) {
    const ns = z.session.number
    const sub = (z.args[0] || '').toLowerCase()
    const arg = z.args[1]
    const enabled = !!expertGet(ns, 'autotyping', false)
    const scope = expertGet(ns, 'autotyping:scope', 'all')
    const secs = expertGet(ns, 'autotyping:secs', 5)

    const status = () =>
      `⌨️ *Autotyping*: ${enabled ? '🟢 IMEWASHWA' : '🔴 IMEZIMWA'}\n` +
      `📍 Wapi: *${SCOPES[scope] || SCOPES.all}*\n` +
      `⏱️ Muda: *sekunde ${secs}*`

    const usage = `${z.prefix}autotyping on | off | dm | groups | all | time <sekunde>`

    if (!sub || sub === 'status') {
      return z.buttons({
        text: `${status()}\n\n_${usage}_`,
        buttons: [
          { id: `${z.prefix}autotyping on`, text: '🟢 Washa' },
          { id: `${z.prefix}autotyping off`, text: '🔴 Zima' }
        ]
      })
    }

    if (ON.includes(sub)) {
      expertSet(ns, 'autotyping', true)
      let extra = ''
      if (expertGet(ns, 'autorecording', false)) {
        expertSet(ns, 'autorecording', false) // typing and recording can't both show at once
        extra = '\n_(autorecording imezimwa — kimoja tu kinaweza kuonekana kwa wakati mmoja)_'
      }
      return z.reply(`✅ Autotyping *imewashwa*. Watu wataona "typing…" wakikutumia ujumbe.${extra}\n\n${status()}`)
    }

    if (OFF.includes(sub)) {
      expertSet(ns, 'autotyping', false)
      return z.reply(`🔴 Autotyping *imezimwa*.\n\n${z.prefix}autotyping on — kuwasha`)
    }

    if (SCOPES[sub]) {
      expertSet(ns, 'autotyping:scope', sub)
      return z.reply(`📍 Autotyping itaonekana: *${SCOPES[sub]}*${enabled ? '' : `\n\n⚠️ Bado imezimwa. Tuma ${z.prefix}autotyping on`}`)
    }

    if (['time', 'muda', 'secs', 'seconds'].includes(sub)) {
      const n = Math.round(Number(arg))
      if (!Number.isFinite(n) || n < MIN_SECS || n > MAX_SECS) {
        return z.reply(`Usage: ${z.prefix}autotyping time <sekunde ${MIN_SECS}-${MAX_SECS}>\nMfano: ${z.prefix}autotyping time 10`)
      }
      expertSet(ns, 'autotyping:secs', n)
      return z.reply(`⏱️ "typing…" itaonekana kwa *sekunde ${n}*.`)
    }

    return z.reply(`${status()}\n\nUsage: ${usage}`)
  }
  }
