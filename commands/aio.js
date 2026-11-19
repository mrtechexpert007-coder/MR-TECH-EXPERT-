// ⟦EXPERT⟧ .aio — all-in-one downloader
// Social (FB/IG/TT/…) via BK9 · YouTube via Omnify→BK9
// Sends video / image / audio — NOT a generic document
import axios from 'axios'
import {
  isYoutubeUrl,
  resolveYoutube,
  downloadBuffer,
  ytSearch
} from '../lib/ytMedia.js'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const BK9 = (process.env.BK9_API || 'https://api.bk9.dev').replace(/\/$/, '')

const http = axios.create({
  timeout: 60000,
  headers: { 'User-Agent': UA, Accept: 'application/json' },
  validateStatus: () => true
})

function normalizeUrl(u) {
  let s = String(u || '').trim()
  if (!s) return null
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s
  return s
}

function detectPlatform(url) {
  const u = String(url).toLowerCase()
  if (/facebook\.com|fb\.watch|fb\.com/i.test(u)) return 'fb'
  if (/instagram\.com|instagr\.am/i.test(u)) return 'ig'
  if (/tiktok\.com|vm\.tiktok\.com/i.test(u)) return 'tiktok'
  if (/twitter\.com|x\.com/i.test(u)) return 'twitter'
  if (/snapchat\.com|snapchat:\/\//i.test(u)) return 'snapchat'
  if (/(?:youtube\.com|youtu\.be|music\.youtube)/i.test(u)) return 'youtube'
  if (/threads\.net/i.test(u)) return 'threads'
  return 'generic'
}

function pickBk9Media(data) {
  const block = data?.BK9 || data?.result || data?.data || data || {}
  const title = block.title || data?.title || 'media'
  // Prefer HD video, then SD, then formats, then url
  const candidates = []
  if (block.download_url) candidates.push({ url: block.download_url, kind: 'video' })
  if (block.hd) candidates.push({ url: block.hd, kind: 'video' })
  if (block.sd) candidates.push({ url: block.sd, kind: 'video' })
  if (Array.isArray(block.formats)) {
    for (const f of block.formats) {
      const u = f.url || f.download_url || f.downloadUrl
      if (u) candidates.push({ url: u, kind: /audio/i.test(f.type || f.quality || '') ? 'audio' : 'video' })
    }
  }
  for (const k of ['url', 'downloadUrl', 'download_url', 'video', 'videoUrl', 'audio', 'audioUrl', 'image', 'imageUrl']) {
    if (block[k] && typeof block[k] === 'string' && /^https?:\/\//i.test(block[k])) {
      candidates.push({ url: block[k], kind: /audio/i.test(k) ? 'audio' : /image/i.test(k) ? 'image' : 'video' })
    }
  }
  if (data?.url && /^https?:\/\//i.test(data.url)) {
    candidates.push({ url: data.url, kind: 'video' })
  }
  const first = candidates.find((c) => c.url)
  if (!first) return null
  return {
    url: first.url,
    kind: first.kind,
    title: String(title).slice(0, 120),
    thumb: block.thumb || block.thumbnail || null,
    source: 'bk9'
  }
}

async function resolveBk9(pageUrl, platform) {
  const paths = {
    fb: ['/download/fb', '/api/download/fb'],
    ig: ['/download/ig', '/download/instagram', '/api/download/ig'],
    tiktok: ['/download/tiktok', '/api/download/tiktok'],
    twitter: ['/download/twitter', '/download/x', '/api/download/twitter'],
    snapchat: ['/download/snapchat', '/api/download/snapchat'],
    threads: ['/download/threads'],
    generic: ['/download/aio', '/api/download']
  }
  const list = paths[platform] || paths.generic
  const errors = []
  for (const path of list) {
    try {
      const res = await http.get(`${BK9}${path}`, {
        params: { url: pageUrl },
        timeout: 60000
      })
      if (res.status >= 400 || res.data?.status === false) {
        errors.push(`${path} HTTP ${res.status}`)
        continue
      }
      if (typeof res.data === 'string' && res.data.trim().startsWith('<!')) {
        errors.push(`${path} HTML`)
        continue
      }
      const media = pickBk9Media(res.data)
      if (media?.url) return media
      errors.push(`${path} no url`)
    } catch (e) {
      errors.push(`${path} ${e.message}`)
    }
  }
  throw new Error(errors[0] || 'BK9 failed')
}

function sniffKind(buf, contentType = '') {
  const ct = String(contentType).toLowerCase()
  if (ct.startsWith('video/')) return 'video'
  if (ct.startsWith('image/')) return 'image'
  if (ct.startsWith('audio/')) return 'audio'
  if (!buf || buf.length < 12) return 'unknown'
  // MP4 / M4A
  if (buf.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buf.toString('ascii', 8, 12)
    if (/mp4|isom|iso2|avc1|dash|M4V|M4A/i.test(brand) || brand.includes('mp4')) {
      // m4a often has M4A brand
      if (/M4A|mp42/i.test(brand) && !/mp41|isom|avc/i.test(brand)) return 'audio'
      return 'video'
    }
    return 'video'
  }
  // WebM
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return 'video'
  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'image'
  // PNG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image'
  // GIF
  if (buf.toString('ascii', 0, 3) === 'GIF') return 'image'
  // WEBP
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image'
  // MP3
  if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return 'audio'
  if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return 'audio'
  // OGG
  if (buf.toString('ascii', 0, 4) === 'OggS') return 'audio'
  return 'unknown'
}

async function sendMedia(expert, buf, kind, caption, mimeHint) {
  const detected = sniffKind(buf, mimeHint)
  const finalKind = detected !== 'unknown' ? detected : kind

  if (finalKind === 'video') {
    await expert.sock.sendMessage(
      expert.jid,
      { video: buf, mimetype: 'video/mp4', caption },
      { quoted: expert.msg }
    )
    return
  }
  if (finalKind === 'image') {
    await expert.sock.sendMessage(
      expert.jid,
      { image: buf, caption },
      { quoted: expert.msg }
    )
    return
  }
  if (finalKind === 'audio') {
    const mime = mimeHint && /^audio\//i.test(mimeHint) ? mimeHint : 'audio/mpeg'
    await expert.sock.sendMessage(
      expert.jid,
      { audio: buf, mimetype: mime, ptt: false },
      { quoted: expert.msg }
    )
    return
  }

  // Last resort document only if truly unknown
  await expert.sock.sendMessage(
    expert.jid,
    {
      document: buf,
      mimetype: mimeHint || 'application/octet-stream',
      fileName: 'download',
      caption
    },
    { quoted: expert.msg }
  )
}

export default {
  name: 'aio',
  aliases: ['dl', 'get'],
  desc: 'Download media from URL (video/image/audio)',
  async run(expert) {
    let input = expert.text.trim()
    if (!input) {
      return expert.reply(
        '📥 *AIO*\n`.aio <url>`\nSupports Facebook, Instagram, TikTok, Snapchat, YouTube, X…'
      )
    }

    await expert.react('📥').catch(() => {})

    try {
      // search query → youtube
      if (!/^https?:\/\//i.test(input) && !isYoutubeUrl(input)) {
        const hits = await ytSearch(input, 1)
        if (!hits.length) return expert.reply('No results.')
        input = hits[0].url
      }

      const url = normalizeUrl(input)
      const platform = detectPlatform(url)

      await expert
        .reply(`⏳ *Fetching ${platform.toUpperCase()}…*\n🔗 ${url}`)
        .catch(() => {})

      // YouTube path
      if (platform === 'youtube' || isYoutubeUrl(url)) {
        try {
          const media = await resolveYoutube('video', url)
          const buf = await downloadBuffer(media.url)
          await sendMedia(
            expert,
            buf,
            'video',
            `📥 *${media.title || 'YouTube'}*\n🏷️ ${media.source}`,
            media.mimetype
          )
          return expert.react('✅').catch(() => {})
        } catch {
          const media = await resolveYoutube('audio', url)
          const buf = await downloadBuffer(media.url, 25 * 1024 * 1024)
          await sendMedia(
            expert,
            buf,
            'audio',
            `🎵 *${media.title || 'YouTube'}*\n🏷️ ${media.source}`,
            media.mimetype || 'audio/mpeg'
          )
          return expert.react('✅').catch(() => {})
        }
      }

      // Social / other via BK9
      let media
      try {
        media = await resolveBk9(url, platform)
      } catch (e) {
        // try generic BK9 path once more
        try {
          media = await resolveBk9(url, 'generic')
        } catch {
          throw e
        }
      }

      const buf = await downloadBuffer(media.url)
      const caption = `📥 *${media.title}*\n🏷️ ${media.source} · ${platform}`
      await sendMedia(expert, buf, media.kind || 'video', caption)
      await expert.react('✅').catch(() => {})
    } catch (e) {
      console.error('[aio]', e)
      await expert.reply(`❌ *AIO failed*\n${e.message}`)
      await expert.react('❌').catch(() => {})
    }
  }
}
