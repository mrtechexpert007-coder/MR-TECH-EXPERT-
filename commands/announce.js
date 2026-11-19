// ⟦EXPERT⟧ .announce <text> — styled announcement that pings everyone (admins only). Reply to an image/video to attach it.
import { expertGuard, expertGetMedia, expertQuoted } from '../lib/expert.admin.js'
import { expertMention } from '../lib/expert.activity.js'
import { expertNumber } from '../lib/expert.utils.js'
import { expertBox } from '../lib/expert.frame.js'

export default {
  name: 'announce',
  aliases: ['announcement'],
  desc: 'Post an announcement that tags everyone. Usage: .announce <text> (reply to media to attach it)',
  async run(z) {
    const g = await expertGuard(z)
    if (!g) return
    if (!z.text) return z.reply('Usage: .announce <your announcement>')
    const text = expertBox('📢', 'ANNOUNCEMENT', [z.text, '', `— @${expertNumber(z.sender)}`])
    const mentions = [...g.meta.participants.map(expertMention), z.sender]
    const q = expertQuoted(z)
    if (q && Object.keys(q).some((k) => /^(image|video)Message$/.test(k))) {
      const media = await expertGetMedia(z)
      if (media?.type === 'imageMessage') return z.sock.sendMessage(z.jid, { image: media.buffer, caption: text, mentions })
      if (media?.type === 'videoMessage') return z.sock.sendMessage(z.jid, { video: media.buffer, caption: text, mentions })
    }
    await z.sock.sendMessage(z.jid, { text, mentions })
  }
}
