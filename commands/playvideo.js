// ⟦EXPERT⟧ .playvideo — YouTube mp4 via Silatech → Elite → (custom APIs) → yt-dlp (re-encoded to H.264/AAC when needed)
import { ytSearch, fetchVideo, ensurePlayableMp4 } from '../lib/video.js'

const MAX_MIN = Number(process.env.VIDEO_MAX_MIN) || 25   // skip search results longer than this (if a shorter one exists)
const VIDEO_LIMIT = 64 * 1024 * 1024                        // bigger than this is sent as a document, not a video

export default {
  name: 'playvideo',
  aliases: ['ytv', 'ytmp4', 'video'],
  desc: 'Play YouTube video',
  async run(expert) {
    const q = expert.text.trim()
    if (!q) return expert.reply('Usage: `.playvideo <name or YouTube url>`')

    await expert.react('🎬').catch(() => {})
    try {
      const hits = await ytSearch(q, 5)
      if (!hits.length) return expert.reply('No results found.')
      // first result that is not a live stream and not too long; otherwise the first result
      const item = hits.find((h) => !(h.duration < 0) && (!h.duration || h.duration <= MAX_MIN * 60)) || hits[0]
      await expert.reply(`⏳ *Downloading video…*\n📌 ${item.title}`)

      const media = await fetchVideo(item.url)
      const title = media.title || item.title
      const caption = `🎬 *${title}*\n🔗 ${item.url}\n🏷️ ${media.source}\n_EXPERT MINI BOT_`

      // WhatsApp only plays H.264 + AAC mp4. If re-encoding fails, send the original as a document
      // instead of failing the whole command.
      let buf = media.buf
      let playable = true
      try {
        buf = await ensurePlayableMp4(media.buf)
      } catch (e) {
        playable = false
        console.warn('[playvideo] re-encode failed, sending as document:', e.message)
      }

      const payload = playable && buf.length <= VIDEO_LIMIT
        ? { video: buf, mimetype: 'video/mp4', caption }
        : { document: buf, mimetype: 'video/mp4', fileName: `${String(title).replace(/[\\/:*?"<>|]+/g, ' ').slice(0, 60).trim() || 'video'}.mp4`, caption }

      await expert.sock.sendMessage(expert.jid, payload, { quoted: expert.msg })
      await expert.react('✅').catch(() => {})
    } catch (e) {
      console.error('[playvideo]', e)
      await expert.reply(`❌ *Playvideo failed*\n${String(e.message).slice(0, 400)}`)
      await expert.react('❌').catch(() => {})
    }
  }
}
