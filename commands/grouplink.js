import { expertGuard } from '../lib/expert.admin.js'
export default {
  name: 'grouplink',
  aliases: ['invite-link', 'linkgroup'],
  desc: 'Get the group invite link',
  async run(z) {
    if (!(await expertGuard(z))) return
    const code = await z.sock.groupInviteCode(z.jid)
    return z.reply(`🔗 https://chat.whatsapp.com/${code}`)
  }
}
