import { expertTargets } from '../lib/expert.admin.js'

export default {
  name: 'unblock',
  owner: true,
  desc: 'Unblock a contact (tag, reply, or number)',
  async run(z) {
    const num = (z.args[0] || '').replace(/\D/g, '')
    const jid = expertTargets(z)[0] || (num.length > 6 ? `${num}@s.whatsapp.net` : (!z.isGroup ? z.jid : null))
    if (!jid) return z.reply('Usage: .unblock 2348012345678  (or tag/reply)')
    await z.sock.updateBlockStatus(jid, 'unblock')
    await z.reply('✅ Unblocked.')
  }
}
