// ⟦EXPERT⟧ .textonly on|off — only text allowed; media from members are deleted (admins; bot must be admin)
import { expertGet, expertSet } from '../lib/expert.store.js'
import { expertGuard } from '../lib/expert.admin.js'

export default {
  name: 'textonly',
  desc: 'Only allow text. Usage: .textonly on | off',
  async run(z) {
    const g = await expertGuard(z)
    if (!g) return
    const ns = z.session.number
    const key = `only:${z.jid}`
    const mode = 'text'
    const arg = (z.args[0] || '').toLowerCase()
    const on = expertGet(ns, key, null) === mode
    if (!arg) return z.reply(on ? '🔒 *ON* — media from members are deleted. Turn off: .textonly off' : 'Usage: .textonly on | off')
    if (arg === 'on') { expertSet(ns, key, mode); return z.reply('🔒 *ON* — only text allowed. media from members are deleted (admins exempt). This replaces .mediaonly if it was on.') }
    if (arg === 'off') { if (on) expertSet(ns, key, null); return z.reply('✅ *OFF* — all message types allowed again.') }
    z.reply('Usage: .textonly on | off')
  }
}
