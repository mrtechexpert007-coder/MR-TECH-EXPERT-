// ⟦EXPERT⟧ .toimage — sticker → PNG image
import sharp from 'sharp'
import { downloadQuotedMedia } from '../lib/quotedMedia.js'

export default {
  name: 'toimage',
  aliases: ['toimg', 'img', 'photo'],
  desc: 'Convert sticker to image (reply to sticker)',
  async run(expert) {
    await expert.react('🖼️').catch(() => {})
    try {
      const media = await downloadQuotedMedia(expert)
      if (media.type !== 'stickerMessage' && !/webp/i.test(media.mimetype)) {
        // also allow webp documents
        if (!/image|webp/i.test(media.mimetype) && media.type !== 'imageMessage') {
          return expert.reply('Reply to a *sticker* with `.toimage`')
        }
      }

      const png = await sharp(media.buffer).png().toBuffer()
      await expert.sock.sendMessage(
        expert.jid,
        {
          image: png,
          caption: '🖼️ Converted from sticker'
        },
        { quoted: expert.msg }
      )
      await expert.react('✅').catch(() => {})
    } catch (e) {
      console.error('[toimage]', e)
      await expert.reply(`❌ *Toimage failed*\n${e.message}`)
      await expert.react('❌').catch(() => {})
    }
  }
}
