// ⟦EXPERT⟧ .welcome on|off|<text>  (per group, per linked account)
import { expertGet, expertSet } from '../lib/expert.store.js'
import { expertGuard } from '../lib/expert.admin.js'

export const EXPERT_DEFAULT_WELCOME = ''

export default {
  name: 'welcome',
  desc: 'Welcome new members. Usage: .welcome on | off | <your message> (use {user}, {group}, {count}; \\n = new line)',
  async run(expert) {
    const g = await expertGuard(expert)
    if (!g) return
    const ns = expert.session.number
    const key = `welcome:${expert.jid}`
    const cur = expertGet(ns, key, { enabled: false, text: EXPERT_DEFAULT_WELCOME })
    const input = expert.text.trim()
    const arg = input.toLowerCase()

    if (!input) {
      return expert.reply(
        `👋 Welcome is *${cur.enabled ? 'ON' : 'OFF'}* for this group.\n\nMessage:\n${cur.text || '(default card message)'}\n\n` +
        `Usage:\n.welcome on\n.welcome off\n.welcome <your message>  (use {user}, {group}, {count}; \\n = new line)`
      )
    }
    if (arg === 'on') {
      expertSet(ns, key, { ...cur, enabled: true })
      return expert.reply('✅ Welcome messages are now *ON* for this group.')
    }
    if (arg === 'off') {
      expertSet(ns, key, { ...cur, enabled: false })
      return expert.reply('✅ Welcome messages are now *OFF* for this group.')
    }
    if (arg === 'reset') {
      expertSet(ns, key, { enabled: cur.enabled, text: EXPERT_DEFAULT_WELCOME })
      return expert.reply('✅ Welcome message reset to default.')
    }
    expertSet(ns, key, { enabled: true, text: input })
    await expert.reply('✅ Welcome message saved and turned *ON* for this group.')
  }
}
