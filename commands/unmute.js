// ⟦EXPERT⟧ .unmute — all members can send messages in the group
import { expertGuard } from '../lib/expert.admin.js'

export default {
  name: 'unmute',
  aliases: ['opengroup', 'open'],
  desc: 'Let all members send messages in the group',
  async run(z) {
    const g = await expertGuard(z)
    if (!g) return
    if (!g.meta.announce) return z.reply('🔓 The group is already open.')
    try {
      await z.sock.groupSettingUpdate(z.jid, 'not_announcement')
      await z.reply('🔓 Group opened — everyone can send messages now.')
    } catch (e) {
      await z.reply(`❌ Could not open the group: ${e?.message || e}`)
    }
  }
}
