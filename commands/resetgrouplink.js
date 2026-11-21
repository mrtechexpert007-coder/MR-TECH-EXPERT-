import { expertGuard } from '../lib/expert.admin.js'
export default {
  name: 'resetgrouplink',
  aliases: ['revoke-link', 'resetlink'],
  desc: 'Reset the group invite link',
  async run(z) {
    if (!(await expertGuard(z))) return
    await z.sock.groupRevokeInvite(z.jid)
    const code = await z.sock.groupInviteCode(z.jid)
    return z.reply(`♻️ Invite link reset.\nhttps://chat.whatsapp.com/${code}`)
  }
}
