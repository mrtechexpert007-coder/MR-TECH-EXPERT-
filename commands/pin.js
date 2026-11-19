// ⟦EXPERT⟧ .pin [24h|7d|30d|off] — pin the replied message (admins; bot must be admin)
import { expertGuard } from '../lib/expert.admin.js'
import { expertQuotedKey } from '../lib/expert.activity.js'

const TIMES = { '24h': 86400, '1d': 86400, '7d': 604800, '30d': 2592000 }

export default {
  name: 'pin',
  aliases: ['unpin'],
  desc: 'Pin the replied message. Usage: .pin [24h|7d|30d] · .unpin',
  async run(z) {
    const g = await expertGuard(z)
    if (!g) return
    const key = expertQuotedKey(z)
    if (!key) return z.reply('↩️ Reply to the message you want to pin.')
    const arg = (z.args[0] || '7d').toLowerCase()
    const off = z.command === 'unpin' || arg === 'off'
    if (!off && !TIMES[arg]) return z.reply('Usage: .pin [24h|7d|30d] (reply to a message) · .unpin')
    try {
      await z.sock.sendMessage(z.jid, { pin: key, type: off ? 2 : 1, time: TIMES[arg] || 604800 })
      await z.react(off ? '📍' : '📌')
    } catch (e) {
      await z.reply(`❌ Could not ${off ? 'unpin' : 'pin'} that message: ${e?.message || e}`)
    }
  }
}
