// ⟦EXPERT⟧ .requests | .requests approve | .requests reject — pending join requests
import { expertGuard } from '../lib/expert.admin.js'

export default {
  name: 'requests',
  aliases: ['joinrequests'],
  desc: 'List / approve / reject join requests',
  async run(z) {
    if (!(await expertGuard(z))) return
    const list = await z.sock.groupRequestParticipantsList(z.jid)
    const sub = (z.args[0] || '').toLowerCase()
    if (!list?.length) return z.reply('✅ No pending join requests.')
    if (sub === 'approve' || sub === 'reject') {
      await z.sock.groupRequestParticipantsUpdate(z.jid, list.map((p) => p.jid), sub)
      return z.reply(`✅ ${sub === 'approve' ? 'Approved' : 'Rejected'} ${list.length} request(s).`)
    }
    await z.reply(`📥 *${list.length} pending request(s)*\n\n${list.slice(0, 40).map((p, i) => `${i + 1}. +${p.jid.split('@')[0].split(':')[0]}`).join('\n')}\n\nUse .requests approve or .requests reject`)
  }
}
