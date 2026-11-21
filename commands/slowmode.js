// ⟦EXPERT⟧ .slowmode <seconds|off> — members can send one message every N seconds (admins; bot must be admin)
import { expertGet, expertSet } from '../lib/expert.store.js'
import { expertGuard } from '../lib/expert.admin.js'

export default {
  name: 'slowmode',
  aliases: ['slow'],
  desc: 'Limit how often members can message. Usage: .slowmode <seconds 3–3600> | off',
  async run(z) {
    const g = await expertGuard(z)
    if (!g) return
    const ns = z.session.number
    const key = `slow:${z.jid}`
    const arg = (z.args[0] || '').toLowerCase()
    if (!arg) {
      const cur = expertGet(ns, key, 0)
      return z.reply(cur ? `🐢 Slowmode is *ON*: one message per *${cur}s*.\nTurn off: .slowmode off` : '🐢 Slowmode is *OFF*.\nUsage: .slowmode 10')
    }
    if (arg === 'off') { expertSet(ns, key, 0); return z.reply('✅ Slowmode is now *OFF*.') }
    const n = parseInt(arg)
    if (!n || n < 3 || n > 3600) return z.reply('Usage: .slowmode <seconds, 3–3600> | off')
    expertSet(ns, key, n)
    await z.reply(`🐢 Slowmode *ON* — members can send one message every *${n}s*. Faster messages are deleted. Admins are exempt.`)
  }
}
