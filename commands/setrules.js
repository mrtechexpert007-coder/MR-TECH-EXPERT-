import { expertGet, expertSet } from '../lib/expert.store.js'
import { expertGuard } from '../lib/expert.admin.js'

export default {
  name: 'setrules',
  desc: 'Set the group rules. Usage: .setrules text',
  async run(z) {
    if (!(await expertGuard(z))) return
    const text = z.text.trim()
    if (!text) return z.reply('Usage: .setrules 1. No spam\n2. Be respectful')
    const rules = expertGet(z.session.number, 'rules', {})
    rules[z.jid] = text.slice(0, 2000)
    expertSet(z.session.number, 'rules', rules)
    await z.reply('✅ Rules saved. Members can read them with .rules')
  }
}
