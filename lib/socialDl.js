// ⟦EXPERT⟧ shared social downloader — TikTok / Facebook / Instagram
// TikTok: BK9 | Facebook: Sparky | Instagram: Silatech → Prexzy (igv2 → instagram → igv3) → Blaze → BMB
// Fallback ya mwisho kwa zote: Omnify AIO
// Kama API moja ikitoa link lakini kupakua kukashindwa (403 n.k.), inajaribu API inayofuata.
import axios from 'axios'
import { resolveAnyUrl } from './ytMedia.js'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const strip = (v) => String(v).replace(/\/$/, '')
const BK9 = strip(process.env.BK9_API || 'https://api.bk9.dev')
const SPARKY = strip(process.env.SPARKY_API || 'https://api-aswin-sparky.koyeb.app')
const SILA = strip(process.env.SILA_API || 'https://api.silatech.site')
const PREXZY = strip(process.env.PREXZY_API || 'https://prexzyapis.com')
const BLAZE = strip(process.env.BLAZE_API || 'https://blaze-api.zone.id')
const BMB = strip(process.env.BMB_API || 'https://bmb-api.zone.id')
const MAX_BYTES = 90 * 1024 * 1024

const http = axios.create({
  timeout: 60000,
  headers: { 'User-Agent': UA, Accept: 'application/json' },
  validateStatus: () => true
})

// Kila platform ina orodha ya endpoints; zinajaribiwa kwa mpangilio huu.
// Kuongeza/kuondoa API: hariri `endpoints` tu.
export const PLATFORMS = {
  tiktok: {
    label: 'TikTok',
    icon: '🎵',
    re: /(?:tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com)/i,
    home: 'https://www.tiktok.com/',
    endpoints: [
      { base: BK9, path: '/download/tiktok', source: 'bk9' },
      { base: BK9, path: '/api/download/tiktok', source: 'bk9' }
    ]
  },
  facebook: {
    label: 'Facebook',
    icon: '📘',
    re: /(?:facebook\.com|fb\.watch|fb\.com|m\.facebook\.com)/i,
    home: 'https://www.facebook.com/',
    endpoints: [{ base: SPARKY, path: '/api/downloader/fbdl', source: 'sparky' }]
  },
  instagram: {
    label: 'Instagram',
    icon: '📸',
    re: /(?:instagram\.com|instagr\.am)/i,
    home: 'https://www.instagram.com/',
    endpoints: [
      { base: SILA, path: '/downloader/instagramv2', source: 'silatech' },
      { base: PREXZY, path: '/download/igv2', source: 'prexzy-v2' },
      { base: PREXZY, path: '/download/instagram', source: 'prexzy' },
      { base: PREXZY, path: '/download/igv3', source: 'prexzy-v3' },
      { base: BLAZE, path: '/api/instagram/download', source: 'blaze' },
      { base: BMB, path: '/api/instagram/download', source: 'bmb' }
    ]
  }
}

export function normalizeUrl(u) {
  let s = String(u || '').trim().split(/\s+/)[0]
  if (!s) return null
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s
  return s
}

const isHttp = (v) => typeof v === 'string' && /^https?:\/\//i.test(v)

// Links za kurasa za platform (si media) — zisichaguliwe kama video
const PAGE_RE = /^https?:\/\/(?:www\.|m\.|vm\.|vt\.)?(?:instagram|facebook|fb|tiktok)\.com\//i
// Majina ya fields ambayo si media kuu (picha ndogo, avatar, n.k.)
const SKIP_KEY = /thumb|cover|avatar|profile|icon|poster|logo|preview/i

function kindOf(url, hint = '') {
  const s = `${hint} ${url}`.toLowerCase()
  if (/\.(jpe?g|png|webp|gif)(\?|$)/.test(s) || /image/.test(hint)) return 'image'
  if (/\.(mp3|m4a|ogg|wav)(\?|$)/.test(s) || /audio/.test(hint)) return 'audio'
  return 'video'
}

// Hutembea ndani ya JSON yoyote na kukusanya links (fallback kwa miundo isiyojulikana)
function deepScan(node, push, key = '', depth = 0) {
  if (node == null || depth > 6) return
  if (typeof node === 'string') {
    if (!SKIP_KEY.test(key)) push(node, key)
    return
  }
  if (Array.isArray(node)) {
    for (const v of node) deepScan(v, push, key, depth + 1)
    return
  }
  if (typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) deepScan(v, push, k, depth + 1)
  }
}

function pickMedia(data) {
  const block = data?.BK9 || data?.result || data?.data || data || {}
  const title = String(block.title || block.desc || data?.title || '').slice(0, 150)
  const items = []
  const push = (url, hint = '') => {
    if (isHttp(url) && !PAGE_RE.test(url) && !items.some((i) => i.url === url)) {
      items.push({ url, kind: kindOf(url, hint) })
    }
  }

  const arrays = [
    block,
    block.results,
    block.media,
    block.medias,
    block.items,
    block.links,
    block.formats,
    block.result
  ]
  for (const arr of arrays) {
    if (!Array.isArray(arr)) continue
    for (const f of arr) {
      if (typeof f === 'string') push(f)
      else
        push(
          f?.download || f?.url || f?.download_url || f?.downloadUrl || f?.link,
          `${f?.type || ''} ${f?.quality || ''}`
        )
    }
  }
  for (const k of ['hd', 'high', 'hdplay', 'download_url', 'nowm', 'video', 'videoUrl', 'sd', 'low', 'play', 'url', 'downloadUrl']) {
    push(block[k], k)
  }
  push(data?.url)
  for (const k of ['image', 'imageUrl']) push(block[k], 'image')

  // Muundo haujulikani → tafuta kila link ya media ndani ya JSON
  if (!items.length) deepScan(data, push)

  if (!items.length) return null
  return {
    title,
    items,
    thumb:
      block.thumb ||
      block.thumbnail ||
      block.cover ||
      block.results?.[0]?.thumb ||
      block.medias?.[0]?.thumbnail ||
      null,
    author: block.author?.nickname || block.author || block.username || ''
  }
}

async function viaEndpoint(ep, url) {
  const res = await http.get(`${ep.base}${ep.path}`, { params: { url } })
  if (typeof res.data === 'string' && res.data.trim().startsWith('<!')) throw new Error('HTML')
  if (res.status >= 400 || res.data?.status === false || res.data?.success === false) {
    throw new Error(`HTTP ${res.status}`)
  }
  const media = pickMedia(res.data)
  if (!media) throw new Error('no media')
  return { ...media, source: ep.source }
}

async function viaOmnify(url) {
  const m = await resolveAnyUrl(url)
  return {
    title: m.title || '',
    items: [{ url: m.url, kind: /audio/i.test(m.mimetype || '') ? 'audio' : 'video' }],
    thumb: null,
    author: '',
    source: 'omnify'
  }
}

/**
 * Hutoa matokeo ya kila API moja baada ya nyingine (endpoints → Omnify).
 * Anayeitumia anaweza kuacha mara tu upakuaji ukifanikiwa.
 */
export async function* candidates(platform, input, errors = []) {
  const cfg = PLATFORMS[platform]
  const url = normalizeUrl(input)
  if (!url || !cfg.re.test(url)) throw new Error(`Hiyo si link ya ${cfg.label}.`)

  for (const ep of cfg.endpoints) {
    try {
      yield { ...(await viaEndpoint(ep, url)), url }
    } catch (e) {
      errors.push(`${ep.source} ${e.message}`)
    }
  }
  try {
    yield { ...(await viaOmnify(url)), url }
  } catch (e) {
    errors.push(`omnify ${e.message}`)
  }
}

// Inarudisha API ya kwanza iliyotoa media (bila kupakua)
export async function resolveSocial(platform, input) {
  const errors = []
  for await (const media of candidates(platform, input, errors)) return media
  throw new Error(errors.join(' | ') || 'API failed')
}

/** Pakua faili; ikikataliwa (403 n.k.) jaribu tena na Referer tofauti. */
async function grab(url, platform) {
  const origin = (() => {
    try {
      return new URL(url).origin + '/'
    } catch {
      return null
    }
  })()
  const refs = [...new Set([undefined, PLATFORMS[platform].home, origin].filter((r) => r !== null))]
  let lastErr
  for (const ref of refs) {
    try {
      const headers = { Accept: '*/*' }
      if (ref) headers.Referer = ref
      const res = await http.get(url, {
        responseType: 'arraybuffer',
        timeout: 120000,
        maxContentLength: MAX_BYTES,
        maxBodyLength: MAX_BYTES,
        headers
      })
      if (res.status >= 400) throw new Error(`Download HTTP ${res.status}`)
      const buf = Buffer.from(res.data)
      const head = buf.subarray(0, 32).toString('utf8').toLowerCase()
      if (head.includes('<html') || head.includes('<!doctype')) {
        throw new Error('Download returned HTML instead of media')
      }
      if (buf.length < 1000) throw new Error('Downloaded file too small / empty')
      return buf
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr
}

function sniff(buf, fallback) {
  if (buf.length < 12) return fallback
  if (buf.toString('ascii', 4, 8) === 'ftyp') return 'video'
  if (buf[0] === 0x1a && buf[1] === 0x45) return 'video'
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'image'
  if (buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG') return 'image'
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image'
  if (buf.toString('ascii', 0, 3) === 'ID3' || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)) return 'audio'
  return fallback
}

export async function runSocialCommand(expert, platform, usage) {
  const cfg = PLATFORMS[platform]
  const quotedText =
    expert.quoted?.text || expert.quoted?.body || expert.msg?.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation || ''
  const input = (expert.text || '').trim() || String(quotedText).match(/https?:\/\/\S+/)?.[0] || ''
  if (!input) return expert.reply(usage)

  await expert.react(cfg.icon).catch(() => {})
  try {
    await expert.reply(`⏳ *Inapakua kutoka ${cfg.label}…*`).catch(() => {})

    const errors = []
    let sent = 0
    for await (const media of candidates(platform, input, errors)) {
      const caption =
        `${cfg.icon} *${cfg.label}*` +
        (media.title ? `\n📝 ${media.title}` : '') +
        (media.author ? `\n👤 ${media.author}` : '') +
        `\n🏷️ ${media.source}`

      const videos = media.items.filter((i) => i.kind === 'video')
      const images = media.items.filter((i) => i.kind === 'image')
      const queue = videos.length ? videos : images.slice(0, 5)
      if (!queue.length) {
        errors.push(`${media.source} no video/image`)
        continue
      }

      for (const item of queue) {
        try {
          const buf = await grab(item.url, platform)
          const kind = sniff(buf, item.kind)
          const content =
            kind === 'image'
              ? { image: buf, caption: sent === 0 ? caption : undefined }
              : kind === 'audio'
                ? { audio: buf, mimetype: 'audio/mpeg', ptt: false }
                : { video: buf, mimetype: 'video/mp4', caption }
          await expert.sock.sendMessage(expert.jid, content, { quoted: expert.msg })
          sent++
          if (kind === 'video') break
        } catch (e) {
          errors.push(`${media.source} ${e.message}`)
        }
      }
      if (sent) break // imefanikiwa — usijaribu API zinazofuata
    }

    if (!sent) throw new Error(errors.join(' | ') || 'Imeshindwa kupakua faili.')
    await expert.react('✅').catch(() => {})
  } catch (e) {
    console.error(`[${platform}]`, e)
    await expert.reply(`❌ *${cfg.label} imeshindwa*\n${e.message}`)
    await expert.react('❌').catch(() => {})
  }
}
