// ⟦EXPERT⟧ .memberroles — owner, admins and member counts
import { expertIsAdm, expertMention, expertTag } from '../lib/expert.activity.js'
import { expertBox } from '../lib/expert.frame.js'

export default {
  name: 'memberroles',
  aliases: ['roles'],
  desc: 'Who is owner, admin or member',
  async run(z) {
    if (!z.isGroup) return z.reply('👥 Groups only.')
    const meta = await z.sock.groupMetadata(z.jid)
    const supers = meta.participants.filter((p) => p.admin === 'superadmin')
    const admins = meta.participants.filter((p) => p.admin === 'admin')
    const members = meta.participants.length - supers.length - admins.length
    await z.sock.sendMessage(z.jid, {
      text: expertBox('🎭', 'MEMBER ROLES', [
        `👑 Creator: ${supers.length ? supers.map(expertTag).join(' ') : '—'}`,
        `🛡️ Admins (${admins.length}):`, ...(admins.length ? admins.map((p) => `  • ${expertTag(p)}`) : ['  —']),
        `👤 Members: *${members}*`
      ]),
      mentions: [...supers, ...admins].map(expertMention)
    }, { quoted: z.msg })
  }
}
