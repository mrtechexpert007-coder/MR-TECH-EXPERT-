// ⟦EXPERT⟧ YouTube / media — Play APIs: FAA (ytmp3 → ytplay) → NexaDev (ytplay → aio)
// FAA:     GET https://api-faa.my.id/faa/ytmp3?url=
//          GET https://api-faa.my.id/faa/ytplay?query=
// NexaDev: GET https://api.nexadev.my.id/api/ytplay?q=
//          GET https://api.nexadev.my.id/api/aio/?url=
// Prexzy:  GET https://prexzyapis.com/download/aio?url=   (video + non-YouTube links only; si ya play)
import axios from 'axios'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const FAA_BASE = (process.env.FAA_API || 'https://api-faa.my.id').replace(/\/$/, '')
const NEXADEV_BASE = (process.env.NEXADEV_API || 'https://api.nexadev.my.id').replace(/\/$/, '')
const PREXZY_BASE = (process.env.PREXZY_API || 'https://prexzyapis.com').replace(/\/$/, '')

const http = axios.create({
  timeout: 60000,
  validateStatus: () => true,
  maxRedirects: 5
})

export function isYoutubeUrl(v) {
  return /(?:youtube\.com|youtu\.be|music\.youtube\.com)/i.test(String(v || ''))
}

export function cleanName(name) {
  return (
    String(name || 'media')
      .replace(/[\\/:*?"<>|]/g, '')
      .replace(/[^\w\s.-]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 100) || 'media'
  )
}

function extractId(url) {
  const s = String(url)
  const m =
    s.match(/[?&]v=([\w-]{11})/) ||
    s.match(/youtu\.be\/([\w-]{11})/) ||
    s.match(/shorts\/([\w-]{11})/)
  return m ? m[1] : null
}

function normalizeUrl(u) {
  let s = String(u || '').trim()
  if (!s) return null
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`
  return s
}

export async function ytSearch(query, limit = 5) {
  const q = String(query || '').trim()
  if (!q) return []
  if (isYoutubeUrl(q)) {
    const id = extractId(q)
    const url = normalizeUrl(q)
    return id
      ? [{
          id,
          title: q,
          url: `https://www.youtube.com/watch?v=${id}`,
          thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
        }]
      : [{ id: '', title: q, url, thumbnail: null }]
  }

  // Piped instances
  const pipes = [
    `https://piped.video/api/v1/search?q=${encodeURIComponent(q)}&filter=videos`,
    `https://api.piped.private.coffee/search?q=${encodeURIComponent(q)}&filter=videos`,
    `https://pipedapi.kavin.rocks/search?q=${encodeURIComponent(q)}&filter=videos`
  ]
  for (const ep of pipes) {
    try {
      const res = await http.get(ep, {
        timeout: 20000,
        headers: { 'User-Agent': UA, Accept: 'application/json' }
      })
      const items = Array.isArray(res.data) ? res.data : res.data?.items || res.data?.results || []
      const out = []
      for (const item of items) {
        if (out.length >= limit) break
        if (item?.type && item.type !== 'video' && item.type !== 'stream') continue
        const id = item.url?.match(/([\w-]{11})$/)?.[1] || item.id || item.videoId
        if (!id || id.length !== 11) continue
        out.push({
          id,
          title: item.title || id,
          url: item.url?.startsWith('http') ? item.url : `https://www.youtube.com/watch?v=${id}`,
          thumbnail: item.thumbnail || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
        })
      }
      if (out.length) return out
    } catch {}
  }

  // YouTube HTML fallback
  const res = await http.get('https://www.youtube.com/results', {
    params: { search_query: q },
    headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' },
    timeout: 25000
  })
  const html = String(res.data || '')
  const results = []
  const seen = new Set()
  const re = /"videoId":"([\w-]{11})".*?"title":\{"runs":\[\{"text":"(.*?)"\}/g
  let m
  while ((m = re.exec(html)) && results.length < limit) {
    if (seen.has(m[1])) continue
    seen.add(m[1])
    results.push({
      id: m[1],
      title: m[2].replace(/\\u0026/g, '&').replace(/\\"/g, '"'),
      url: `https://www.youtube.com/watch?v=${m[1]}`,
      thumbnail: `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg`
    })
  }
  return results
}

/* ───────────── Generic response helpers (kwa API mpya) ───────────── */

// Majina ya field yanayowezekana kuwa na link ya faili (kipaumbele kutoka juu)
const URL_KEYS = [
  'audioUrl', 'audio_url', 'downloadUrl', 'download_url', 'dlink', 'download',
  'mp3', 'audio', 'link', 'url', 'src', 'source'
]
const TITLE_KEYS = ['title', 'name', 'fileName', 'filename']
const SKIP_KEY = /thumb|image|cover|poster|icon|avatar|banner/i

function isHttp(v) {
  return typeof v === 'string' && /^https?:\/\//i.test(v)
}

/** Tafuta link ya audio ndani ya JSON yoyote (recursive, depth-limited). */
function findMediaUrl(node, depth = 0) {
  if (!node || depth > 5) return null
  if (isHttp(node)) return node
  if (Array.isArray(node)) {
    for (const it of node) {
      const f = findMediaUrl(it, depth + 1)
      if (f) return f
    }
    return null
  }
  if (typeof node !== 'object') return null

  for (const k of URL_KEYS) {
    const v = node[k]
    if (isHttp(v) && !SKIP_KEY.test(k)) return v
  }
  for (const k of URL_KEYS) {
    if (node[k] && typeof node[k] === 'object') {
      const f = findMediaUrl(node[k], depth + 1)
      if (f) return f
    }
  }
  for (const k of ['result', 'data', 'results', 'response', 'media', 'medias', 'player']) {
    if (node[k] && typeof node[k] === 'object') {
      const f = findMediaUrl(node[k], depth + 1)
      if (f) return f
    }
  }
  for (const [k, v] of Object.entries(node)) {
    if (SKIP_KEY.test(k)) continue
    if (isHttp(v)) return v
  }
  return null
}

function findTitle(node, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 4) return ''
  for (const k of TITLE_KEYS) {
    if (typeof node[k] === 'string' && node[k].trim()) return node[k].trim()
  }
  for (const k of ['result', 'data', 'results', 'metadata', 'info']) {
    if (node[k] && typeof node[k] === 'object') {
      const t = findTitle(Array.isArray(node[k]) ? node[k][0] : node[k], depth + 1)
      if (t) return t
    }
  }
  return ''
}

function apiFailed(res) {
  const d = res.data
  if (res.status >= 400) return d?.message || d?.error || `HTTP ${res.status}`
  if (d && typeof d === 'object') {
    if (d.success === false || d.status === false) return d.message || d.error || 'API error'
    if (typeof d.status === 'number' && d.status >= 400) return d.message || `status ${d.status}`
  }
  return null
}

/** Mtoaji mmoja wa GET → { url, title, mimetype, source } (audio) */
async function genericAudioResolve({ name, endpoint, param, value }) {
  if (!value) throw new Error(`${name}: empty ${param}`)
  const res = await http.get(endpoint, {
    params: { [param]: value },
    timeout: 60000,
    headers: { 'User-Agent': UA, Accept: 'application/json' }
  })
  const err = apiFailed(res)
  if (err) throw new Error(`${name}: ${err}`)
  const fileUrl = findMediaUrl(res.data)
  if (!fileUrl) throw new Error(`${name}: no audio url in response`)
  return {
    url: fileUrl,
    title: findTitle(res.data),
    mimetype: 'audio/mpeg',
    source: name
  }
}

/** FAA ytmp3 (audio, kwa link ya YouTube) */
const faaYtmp3 = (pageUrl, kind) => {
  if (kind !== 'audio') throw new Error('faa-ytmp3: audio only')
  return genericAudioResolve({
    name: 'faa-ytmp3',
    endpoint: `${FAA_BASE}/faa/ytmp3`,
    param: 'url',
    value: normalizeUrl(pageUrl)
  })
}

/** FAA ytplay (audio, search kwa jina au link) */
const faaYtplay = (queryOrUrl, kind) => {
  if (kind !== 'audio') throw new Error('faa-ytplay: audio only')
  return genericAudioResolve({
    name: 'faa-ytplay',
    endpoint: `${FAA_BASE}/faa/ytplay`,
    param: 'query',
    value: queryOrUrl
  })
}

/** NexaDev ytplay (audio, search kwa jina au link) */
const nexadevYtplay = (queryOrUrl, kind) => {
  if (kind !== 'audio') throw new Error('nexadev-ytplay: audio only')
  return genericAudioResolve({
    name: 'nexadev-ytplay',
    endpoint: `${NEXADEV_BASE}/api/ytplay`,
    param: 'q',
    value: queryOrUrl
  })
}

/** NexaDev aio (audio, kwa link) */
const nexadevAio = (pageUrl, kind) => {
  if (kind !== 'audio') throw new Error('nexadev-aio: audio only')
  return genericAudioResolve({
    name: 'nexadev-aio',
    endpoint: `${NEXADEV_BASE}/api/aio/`,
    param: 'url',
    value: normalizeUrl(pageUrl)
  })
}

/** Prexzy — GET /download/aio?url=  (audio + video) — imebaki kwa video & fallback */
async function prexzyResolve(pageUrl, kind) {
  const res = await http.get(`${PREXZY_BASE}/download/aio`, {
    params: { url: normalizeUrl(pageUrl) },
    timeout: 60000,
    headers: { 'User-Agent': UA, Accept: 'application/json' }
  })
  const json = res.data
  if (res.status >= 400 || !json?.status || !json?.data?.status) {
    throw new Error(json?.message || `Prexzy HTTP ${res.status}`)
  }
  const d = json.data
  const medias = Array.isArray(d.medias) ? d.medias : []
  const num = (m) => parseInt(String(m.quality || '0').replace(/\D/g, ''), 10) || 0

  if (kind === 'audio') {
    const audio = medias.filter((m) => m.type === 'audio' && m.url)
    if (!audio.length) throw new Error('Prexzy: no audio track')
    // prefer mp3 128kbps (small, WhatsApp-friendly)
    const pick =
      audio.find((m) => m.extension === 'mp3' && num(m) === 128) ||
      audio.find((m) => m.extension === 'mp3') ||
      audio[0]
    return {
      url: pick.url,
      title: d.title || '',
      mimetype: pick.extension === 'mp3' ? 'audio/mpeg' : 'audio/mp4',
      source: 'prexzy'
    }
  }

  const video = medias
    .filter((m) => m.type === 'video' && m.url)
    .sort((a, b) => num(b) - num(a))
  if (!video.length) throw new Error('Prexzy: no video track')
  // prefer <= 720p for WhatsApp size
  const pick = video.find((m) => num(m) <= 720) || video[video.length - 1]
  return {
    url: pick.url,
    title: d.title || '',
    mimetype: 'video/mp4',
    source: 'prexzy'
  }
}

/**
 * Providers hujaribiwa kwa mpangilio:
 *   Audio: FAA ytmp3 → FAA ytplay → NexaDev ytplay → NexaDev aio
 *   Video: Prexzy aio (API za audio zinaruka)
 * `hint` (optional) = jina la wimbo; ytplay hutafuta kwa jina kwa hiyo inafanya kazi vizuri nalo.
 */
export async function resolveYoutube(kind, videoUrl, hint = '') {
  const url = normalizeUrl(videoUrl)
  const providers =
    kind === 'audio'
      ? [
          ['faa-ytmp3', () => faaYtmp3(url, kind)],
          ['faa-ytplay', () => faaYtplay(hint || url, kind)],
          ['nexadev-ytplay', () => nexadevYtplay(hint || url, kind)],
          ['nexadev-aio', () => nexadevAio(url, kind)]
        ]
      : [['prexzy', () => prexzyResolve(url, kind)]]
  const errors = []
  for (const [name, run] of providers) {
    try {
      const r = await run()
      if (r?.url) return r
    } catch (e) {
      errors.push(`${name}: ${e?.message || e}`)
    }
  }
  throw new Error(errors.join(' → '))
}

/** Any supported URL (non-YT too) via Prexzy aio */
export async function resolveAnyUrl(pageUrl) {
  return { ...(await prexzyResolve(pageUrl, 'video')), platform: 'aio' }
}

export async function downloadBuffer(url, maxBytes = 90 * 1024 * 1024, referer) {
  const res = await http.get(url, {
    responseType: 'arraybuffer',
    timeout: 120000,
    maxContentLength: maxBytes,
    maxBodyLength: maxBytes,
    headers: {
      'User-Agent': UA,
      Accept: '*/*',
      ...(referer ? { Referer: referer } : {})
    }
  })
  if (res.status >= 400) throw new Error(`Download HTTP ${res.status}`)
  const buf = Buffer.from(res.data)
  const head = buf.subarray(0, 32).toString('utf8').toLowerCase()
  if (head.includes('<html') || head.includes('<!doctype')) {
    throw new Error('Download returned HTML instead of media')
  }
  if (buf.length < 1000) throw new Error('Downloaded file too small / empty')
  return buf
}


/**
 * Resolve + download kwa pamoja: provider ikitoa link lakini download ikashindwa (403 n.k.),
 * inajaribu provider inayofuata badala ya kuacha. Inarudisha { buf, url, title, mimetype, source }.
 */
export async function fetchYoutubeAudio(videoUrl, hint = '', maxBytes = 64 * 1024 * 1024) {
  const url = normalizeUrl(videoUrl)
  const providers = [
    ['faa-ytmp3', () => faaYtmp3(url, 'audio')],
    ['faa-ytplay', () => faaYtplay(hint || url, 'audio')],
    ['nexadev-ytplay', () => nexadevYtplay(hint || url, 'audio')],
    ['nexadev-aio', () => nexadevAio(url, 'audio')]
  ]
  const errors = []
  for (const [name, run] of providers) {
    try {
      const r = await run()
      if (!r?.url) continue
      const refs = [undefined, 'https://www.youtube.com/', (() => { try { return new URL(r.url).origin + '/' } catch { return undefined } })()]
      let lastErr
      for (const ref of [...new Set(refs)]) {
        try {
          const buf = await downloadBuffer(r.url, maxBytes, ref)
          return { ...r, buf }
        } catch (e) {
          lastErr = e
          if (!/403|401|429|HTML/.test(e.message)) break
        }
      }
      throw lastErr
    } catch (e) {
      errors.push(`${name}: ${e?.message || e}`)
    }
  }
  throw new Error(errors.join(' → '))
}

export const sources = { FAA_BASE, NEXADEV_BASE, PREXZY_BASE }
