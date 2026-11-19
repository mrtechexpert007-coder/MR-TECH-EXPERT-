// ⟦EXPERT⟧ .play — YouTube audio as WhatsApp AUDIO
// Mpangilio: API (FAA ytmp3 → FAA ytplay → NexaDev ytplay → NexaDev aio) → yt-dlp (local) — na kama wimbo wa kwanza ukishindwa, unajaribu wa pili.
import { ytSearch, fetchYoutubeAudio } from '../lib/ytMedia.js'
import { ytdlpMedia } from '../lib/ytdlp.js'

const MAX_BYTES = 64 * 1024 * 1024        // kikomo cha kupakua
const AUDIO_BUBBLE_MAX = 20 * 1024 * 1024 // zaidi ya hapa → inatumwa kama document

function sniffAudioMime(buf, fallback = 'audio/mpeg') {
  if (!buf || buf.length < 12) return fallback
  if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return 'audio/mpeg'
  if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return 'audio/mpeg'
  if (buf[0] === 0x4f && buf[1] === 0x67 && buf[2] === 0x67 && buf[3] === 0x53) return 'audio/ogg'
  if (buf.toString('ascii', 4, 8) === 'ftyp') return 'audio/mp4'
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WAVE') return 'audio/wav'
  return fallback
}

/** Pakua audio ya video moja: API kwanza, kisha yt-dlp. Inarudisha { buf, title, mime, source } */
async function getAudio(item) {
  const errors = []

  // 1) API
  try {
    const media = await fetchYoutubeAudio(item.url, item.title, MAX_BYTES)
    const buf = media.buf
    const mime =
      media.mimetype && /^audio\//i.test(media.mimetype) ? media.mimetype : sniffAudioMime(buf)
    return { buf, title: media.title || item.title, mime: sniffAudioMime(buf, mime), source: media.source }
  } catch (e) {
    errors.push(`API: ${String(e.message).slice(0, 200)}`)
  }

  // 2) yt-dlp (haitegemei API za nje)
  try {
    const m = await ytdlpMedia('audio', item.url, MAX_BYTES)
    return { buf: m.buf, title: m.title || item.title, mime: m.mimetype || sniffAudioMime(m.buf), source: 'yt-dlp' }
  } catch (e) {
    errors.push(`yt-dlp: ${String(e.message).slice(0, 200)}`)
  }

  throw new Error(errors.join('\n'))
}

export default {
  name: 'play',
  aliases: ['yt', 'song', 'music', 'ytmp3', 'playaudio'],
  desc: 'Play YouTube audio',
  async run(expert) {
    const q = expert.text.trim()
    if (!q) return expert.reply('Usage: `.play <song name or YouTube url>`')

    await expert.react('🎵').catch(() => {})
    try {
      const hits = await ytSearch(q, 3)
      if (!hits.length) return expert.reply('No results found.')

      let result, item, lastErr
      for (const h of hits.slice(0, 2)) {           // jaribu matokeo 2 ya kwanza
        try {
          await expert.reply(`⏳ *Downloading audio…*\n📌 ${h.title}`)
          result = await getAudio(h)
          item = h
          break
        } catch (e) {
          lastErr = e
          console.warn('[play] failed for', h.url, e.message)
        }
      }
      if (!result) throw lastErr || new Error('Download failed')

      const { buf, title, mime, source } = result
      const ext = mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'mp3'
      const fileName = `${String(title).replace(/[\\/:*?"<>|]+/g, ' ').slice(0, 60).trim() || 'audio'}.${ext}`

      const payload =
        buf.length <= AUDIO_BUBBLE_MAX
          ? {
              audio: buf,
              mimetype: mime,
              ptt: false,
              fileName,
              contextInfo: {
                externalAdReply: {
                  title: String(title).slice(0, 80),
                  body: source ? `via ${source}` : 'NEXUS-MD',
                  mediaType: 1,
                  thumbnailUrl: item.thumbnail || undefined,
                  sourceUrl: item.url
                }
              }
            }
          : { document: buf, mimetype: mime, fileName }

      await expert.sock.sendMessage(expert.jid, payload, { quoted: expert.msg })
      await expert.reply(`🎵 *${title}*\n🔗 ${item.url}\n🏷️ ${source || 'ok'}`)
      await expert.react('✅').catch(() => {})
    } catch (e) {
      console.error('[play]', e)
      await expert.reply(`❌ *Play failed*\n${String(e.message).slice(0, 500)}`)
      await expert.react('❌').catch(() => {})
    }
  }
                     }
