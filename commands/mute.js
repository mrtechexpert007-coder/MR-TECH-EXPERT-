// ⟦EXPERT⟧ .mute — only admins can send messages in the group
import { expertGuard } from '../lib/expert.admin.js'

export default {
  name: 'mute',
  aliases: ['closegroup', 'close'],
  desc: 'Only admins can send messages in the group',
  async run(z) {
    const g = await expertGuard(z)
    if (!g) return
    if (g.meta.announce) return z.reply('🔒 The group is already muted.')
    try {
      await z.sock.groupSettingUpdate(z.jid, 'announcement')
      await z.reply('🔒 Group muted — only admins can send messages now.')
    } catch (e) {
      await z.reply(`❌ Could not mute the group: ${e?.message || e}`)
    }
  }
}
