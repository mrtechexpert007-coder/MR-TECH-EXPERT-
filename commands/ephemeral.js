// ⟦EXPERT⟧ .ephemeral off|24h|7d|90d — disappearing messages
import { expertGuard } from '../lib/expert.admin.js'

const OPTIONS = { off: 0, '24h': 86400, '7d': 604800, '90d': 7776000 }

export default {
  name: 'ephemeral',
  aliases: ['disappearing'],
  desc: 'Set disappearing messages: off, 24h, 7d, 90d',
  async run(z) {
    if (!(await expertGuard(z))) return
    const o = (z.args[0] || '').toLowerCase()
    if (!(o in OPTIONS)) return z.reply('Usage: .ephemeral off|24h|7d|90d')
    await z.sock.groupToggleEphemeral(z.jid, OPTIONS[o])
    await z.reply(o === 'off' ? '✅ Disappearing messages off.' : `✅ Messages now disappear after ${o}.`)
  }
}
