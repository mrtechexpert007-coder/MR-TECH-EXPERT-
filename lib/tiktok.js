// ⟦EXPERT⟧ lib/tiktok.js — TikTok engine (serves commands/tiktok.js)
// Sources: TikWM → BK9 → Omnify.  Handles video, slideshow images, mp3.
import axios from 'axios'
import { resolveAnyUrl, downloadBuffer } from './ytMedia.js'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const BK9 = (process.env.BK9_API || 'https://api.bk9.dev').replace(/\/$/, '')
const TIKTOK_RE = /https?:\/\/(?:[\w-]+\.)?(?:tiktok\.com|tiktokv\.com)\/\S+/i

const http = axios.create({
  timeout: 45000,
  headers: { 'User-Agent': UA, Accept: 'application/json' },
  validateStatus: () => true
})

const isHttp = (v) => typeof v === 'string' && /^https?:\/\//i.test(v)

/** Pull the first TikTok link out of any text */
export function extractTiktokUrl(text) {
  return String(text || '').match(TIKTOK_RE)?.[0]?.replace(/[)\]>.,]+$/, '') || null
}

// ── Source 1: TikWM ─────────────────────────────────────────
async function fromTikwm(url) {
  const errors = []
  for (const base of ['https://www.tikwm.com', 'https://tikwm.com']) {
    try {
      const res = await http.get(`${base}/api/`, { params: { url, hd: 1 }, timeout: 30000 })
      const d = res.data?.data
      if (res.status >= 400 || res.data?.code !== 0 || !d) {
        errors.push(`${base}: ${res.data?.msg || 'HTTP ' + res.status}`)
        continue
      }
      const abs = (u) => (u && u.startsWith('/') ? base + u : u)
      const videos = [d.hdplay, d.play, d.wmplay].filter(Boolean).map(abs)
      const images = Array.isArray(d.images) ? d.images.map(abs) : []
      if (!videos.length && !images.length) {
        errors.push(`${base}: no media`)
        continue
      }
      return {
        source: 'tikwm',
        title: String(d.title || '').slice(0, 150),
        author: d.author?.nickname || d.author?.unique_id || '',
        videos: [...new Set(images.length ? [] : videos)],
        images,
        audio: abs(d.music) || null
      }
    } catch (e) {
      errors.push(`${base}: ${e.message}`)
    }
  }
  throw new Error(errors.join(' | '))
}

// ── Source 2: BK9 ───────────────────────────────────────────
async function fromBk9(url) {
  const errors = []
  for (const path of ['/download/tiktok', '/api/download/tiktok']) {
    try {
      const res = await http.get(`${BK9}${path}`, { params: { url } })
      if (typeof res.data === 'string' && res.data.trim().startsWith('<!')) {
        errors.push(`${path}: HTML`)
        continue
      }
      if (res.status >= 400 || res.data?.status === false) {
        errors.push(`${path}: HTTP ${res.status}`)
        continue
      }
      const data = res.data
      const b = data?.BK9 || data?.result || data?.data || data || {}
      const videos = [b.hd, b.hdplay, b.nowm, b.video, b.videoUrl, b.play, b.sd, b.download_url, b.url, data?.url]
        .filter(isHttp)
      if (!videos.length) {
        errors.push(`${path}: no video`)
        continue
      }
      return {
        source: 'bk9',
        title: String(b.title || b.desc || '').slice(0, 150),
        author: b.author?.nickname || (typeof b.author === 'string' ? b.author : '') || b.username || '',
        videos: [...new Set(videos)],
        images: [],
        audio: [b.audio, b.music, b.audioUrl].find(isHttp) || null
      }
    } catch (e) {
      errors.push(`${path}: ${e.message}`)
    }
  }
  throw new Error(errors.join(' | '))
}

// ── Source 3: Omnify ────────────────────────────────────────
async function fromOmnify(url) {
  const m = await resolveAnyUrl(url)
  const isAudio = /audio/i.test(m.mimetype || '')
  return {
    source: 'omnify',
    title: m.title || '',
    author: '',
    videos: isAudio ? [] : [m.url],
    images: [],
    audio: isAudio ? m.url : null
  }
}

/** Resolve a TikTok link → { source, title, author, videos[], images[], audio } */
export async function resolveTiktok(input) {
  const url = extractTiktokUrl(input)
  if (!url) throw new Error('Hiyo si link ya TikTok.')
  const errs = []
  for (const [name, fn] of [
    ['tikwm', fromTikwm],
    ['bk9', fromBk9],
    ['omnify', fromOmnify]
  ]) {
    try {
      return { ...(await fn(url)), url }
    } catch (e) {
      errs.push(`${name}: ${e.message}`)
    }
  }
  throw new Error(errs.join(' → '))
}

async function firstBuffer(urls, max) {
  let last
  for (const u of urls) {
    try {
      return await downloadBuffer(u, max)
    } catch (e) {
      last = e
    }
  }
  throw last || new Error('Imeshindwa kupakua faili.')
}

/**
 * Main entry used by commands/tiktok.js
 *   .tiktok <link>          → video
 *   .tiktok mp3 <link>      → audio only
 *   (or reply to a message that contains the link)
 */
export async function handleTiktok(expert) {
  const raw = (expert.text || '').trim()
  const wantAudio = /^(mp3|audio|sound|muziki)\b/i.test(raw)
  const quoted =
    expert.quoted?.text ||
    expert.quoted?.body ||
    expert.msg?.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation ||
    ''
  const link = extractTiktokUrl(raw) || extractTiktokUrl(quoted)

  if (!link) {
    return expert.reply(
      '🎵 *TikTok Downloader*\n\n' +
        '• `.tiktok <link>` → video (bila watermark)\n' +
        '• `.tiktok mp3 <link>` → sauti tu\n' +
        '• Au reply ujumbe wenye link kisha andika `.tiktok`'
    )
  }

  await expert.react('🎵').catch(() => {})
  try {
    await expert.reply('⏳ *Inapakua TikTok…*').catch(() => {})
    const t = await resolveTiktok(link)
    const caption =
      '🎵 *TikTok*' +
      (t.title ? `\n📝 ${t.title}` : '') +
      (t.author ? `\n👤 ${t.author}` : '') +
      `\n🏷️ ${t.source}`
    const opts = { quoted: expert.msg }

    if (wantAudio) {
      if (!t.audio) throw new Error('Sauti haijapatikana kwa video hii.')
      const buf = await downloadBuffer(t.audio, 25 * 1024 * 1024)
      await expert.sock.sendMessage(expert.jid, { audio: buf, mimetype: 'audio/mpeg', ptt: false }, opts)
    } else if (t.images.length) {
      // photo slideshow → up to 5 images
      let n = 0
      for (const img of t.images.slice(0, 5)) {
        try {
          const buf = await downloadBuffer(img, 15 * 1024 * 1024)
          await expert.sock.sendMessage(expert.jid, { image: buf, caption: n === 0 ? caption : undefined }, opts)
          n++
        } catch {}
      }
      if (!n) throw new Error('Picha hazikupakuliwa.')
    } else {
      if (!t.videos.length) throw new Error('Video haijapatikana.')
      const buf = await firstBuffer(t.videos)
      await expert.sock.sendMessage(expert.jid, { video: buf, mimetype: 'video/mp4', caption }, opts)
    }
    await expert.react('✅').catch(() => {})
  } catch (e) {
    console.error('[tiktok]', e)
    await expert.reply(`❌ *TikTok imeshindwa*\n${e.message}`)
    await expert.react('❌').catch(() => {})
  }
  }
