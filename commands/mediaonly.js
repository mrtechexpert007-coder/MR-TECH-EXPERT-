// ⟦EXPERT⟧ .mediaonly on|off — only media (images, videos, audio, stickers, files) allowed; text messages from members are deleted (admins; bot must be admin)
import { expertGet, expertSet } from '../lib/expert.store.js'
import { expertGuard } from '../lib/expert.admin.js'

export default {
  name: 'mediaonly',
  desc: 'Only allow media (images, videos, audio, stickers, files). Usage: .mediaonly on | off',
  async run(z) {
    const g = await expertGuard(z)
    if (!g) return
    const ns = z.session.number
    const key = `only:${z.jid}`
    const mode = 'media'
    const arg = (z.args[0] || '').toLowerCase()
    const on = expertGet(ns, key, null) === mode
    if (!arg) return z.reply(on ? '🔒 *ON* — text messages from members are deleted. Turn off: .mediaonly off' : 'Usage: .mediaonly on | off')
    if (arg === 'on') { expertSet(ns, key, mode); return z.reply('🔒 *ON* — only media (images, videos, audio, stickers, files) allowed. text messages from members are deleted (admins exempt). This replaces .textonly if it was on.') }
    if (arg === 'off') { if (on) expertSet(ns, key, null); return z.reply('✅ *OFF* — all message types allowed again.') }
    z.reply('Usage: .mediaonly on | off')
  }
}
