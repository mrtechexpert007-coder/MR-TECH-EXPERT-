import { expertGroup } from '../lib/expert.admin.js'

export default {
  name: 'listadmins',
  desc: 'List the group admins',
  async run(z) {
    if (!z.isGroup) return z.reply('👥 Groups only.')
    const { meta, isAdm } = await expertGroup(z)
    const admins = meta.participants.filter(isAdm)
    await z.sock.sendMessage(z.jid, {
      text: `👑 *Admins (${admins.length})*\n\n${admins.map((p, i) => `${i + 1}. @${p.id.split('@')[0].split(':')[0]}${p.admin === 'superadmin' ? ' ⭐' : ''}`).join('\n')}`,
      mentions: admins.map((p) => p.id)
    }, { quoted: z.msg })
  }
}
