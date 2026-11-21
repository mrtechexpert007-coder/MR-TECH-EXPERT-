// ⟦EXPERT⟧ .peek <group invite link> — preview a group before joining
import { expertNumber } from '../lib/expert.utils.js'
import { expertBox } from '../lib/expert.frame.js'

export default {
  name: 'peek',
  desc: 'Preview a group from its invite link. Usage: .peek https://chat.whatsapp.com/XXXX',
  async run(z) {
    const code = (z.text.match(/chat\.whatsapp\.com\/([A-Za-z0-9]{10,})/) || [])[1]
    if (!code) return z.reply('Usage: .peek https://chat.whatsapp.com/XXXXXXXX')
    try {
      const info = await z.sock.groupGetInviteInfo(code)
      const lines = [
        `*${info.subject}*`,
        `👥 Members: *${info.size ?? info.participants?.length ?? '?'}*`,
        ...(info.owner ? [`👑 Creator: +${expertNumber(info.owner)}`] : []),
        ...(info.creation ? [`📅 Created: ${new Date(info.creation * 1000).toLocaleDateString('en-GB')}`] : []),
        ...(info.desc ? ['', `📝 ${String(info.desc).slice(0, 300)}`] : [])
      ]
      await z.reply(expertBox('🔭', 'GROUP PEEK', lines))
    } catch (e) {
      await z.reply('❌ That link is invalid, expired or revoked.')
    }
  }
}
