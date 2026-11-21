// ⟦EXPERT⟧ .vv — reveal a replied view-once photo/video/voice note (owner only)
import { expertQuoted, expertDownload } from '../lib/expert.admin.js'

export default {
  name: 'vv',
  aliases: ['viewonce', 'reveal'],
  owner: true,
  desc: 'Reveal a view-once message',
  async run(z) {
    const q = expertQuoted(z)
    const media = q && await expertDownload(q)
    if (!media) return z.reply('Reply to a view-once photo, video or voice note.\n(Tip: reply with just 🌚 to get it silently in your DM.)')
    const { buffer, type, content } = media
    const payload =
      type === 'imageMessage' ? { image: buffer, caption: content.caption || '' } :
      type === 'videoMessage' ? { video: buffer, caption: content.caption || '' } :
      type === 'audioMessage' ? { audio: buffer, mimetype: content.mimetype || 'audio/mpeg', ptt: !!content.ptt } :
      { document: buffer, mimetype: content.mimetype, fileName: content.fileName || 'file' }
    await z.sock.sendMessage(z.jid, payload, { quoted: z.msg })
  }
}
