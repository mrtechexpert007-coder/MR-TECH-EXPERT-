import { expertTargets } from '../lib/expert.admin.js'

export default {
  name: 'getpp',
  aliases: ['pp'],
  desc: 'Get someone\'s profile picture (tag, reply, or number)',
  async run(z) {
    const num = (z.args[0] || '').replace(/\D/g, '')
    const jid = expertTargets(z)[0] || (num.length > 6 ? `${num}@s.whatsapp.net` : z.isGroup ? z.sender : z.jid)
    try {
      const url = await z.sock.profilePictureUrl(jid, 'image')
      await z.sock.sendMessage(z.jid, { image: { url }, caption: `🖼️ @${jid.split('@')[0].split(':')[0]}`, mentions: [jid] }, { quoted: z.msg })
    } catch {
      await z.reply('❌ No profile picture (or it is private).')
    }
  }
}
