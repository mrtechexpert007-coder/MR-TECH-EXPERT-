// ⟦EXPERT⟧ .goodbye on|off|<text>  (per group, per linked account)
import { expertGet, expertSet } from '../lib/expert.store.js'
import { expertGuard } from '../lib/expert.admin.js'

export const EXPERT_DEFAULT_GOODBYE = ''

export default {
  name: 'goodbye',
  desc: 'Say goodbye to leavers. Usage: .goodbye on | off | <your message> (use {user}, {group}, {count}; \\n = new line)',
  async run(expert) {
    const g = await expertGuard(expert)
    if (!g) return
    const ns = expert.session.number
    const key = `goodbye:${expert.jid}`
    const cur = expertGet(ns, key, { enabled: false, text: EXPERT_DEFAULT_GOODBYE })
    const input = expert.text.trim()
    const arg = input.toLowerCase()

    if (!input) {
      return expert.reply(
        `👋 Goodbye is *${cur.enabled ? 'ON' : 'OFF'}* for this group.\n\nMessage:\n${cur.text || '(default card message)'}\n\n` +
        `Usage:\n.goodbye on\n.goodbye off\n.goodbye <your message>  (use {user}, {group}, {count}; \\n = new line)`
      )
    }
    if (arg === 'on') {
      expertSet(ns, key, { ...cur, enabled: true })
      return expert.reply('✅ Goodbye messages are now *ON* for this group.')
    }
    if (arg === 'off') {
      expertSet(ns, key, { ...cur, enabled: false })
      return expert.reply('✅ Goodbye messages are now *OFF* for this group.')
    }
    if (arg === 'reset') {
      expertSet(ns, key, { enabled: cur.enabled, text: EXPERT_DEFAULT_GOODBYE })
      return expert.reply('✅ Goodbye message reset to default.')
    }
    expertSet(ns, key, { enabled: true, text: input })
    await expert.reply('✅ Goodbye message saved and turned *ON* for this group.')
  }
}
