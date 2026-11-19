// ⟦EXPERT⟧ lib/video.js — YouTube mp4: resolve + download + WhatsApp-safe re-encode
// Chain: Silatech (api.silatech.site) → EliteProTech (eliteprotech-apis.zone.id)
// Haitegemei ytMedia.js. Ina ndani yake: ytSearch, fetchVideo, ensurePlayableMp4
// (inachukua nafasi ya lib/videoFix.js). Inahitaji tu axios na lib/ffmpegBin.js.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFile, execFileSync } from 'node:child_process'
import axios from 'axios'
import { getFfmpegPath } from './ffmpegBin.js'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const SILATECH = (process.env.SILATECH_API || 'https://api.silatech.site').replace(/\/$/, '')
const ELITE = (process.env.ELITE_API || 'https://eliteprotech-apis.zone.id').replace(/\/$/, '')
// Download cap (MB). Override with VIDEO_MAX_MB in env.
const MAX_BYTES = (Number(process.env.VIDEO_MAX_MB) || 90) * 1024 * 1024
// Preferred quality: highest at or below this height; bigger ones are tried only as a last resort.
const TARGET_HEIGHT = Number(process.env.VIDEO_TARGET_P) || 720

const http = axios.create({
  timeout: 60000,
  headers: { 'User-Agent': UA, Accept: 'application/json' },
  validateStatus: () => true,
  maxRedirects: 5
})

const isHttp = (v) => typeof v === 'string' && /^https?:\/\//i.test(v)
// Link ya ukurasa wa YouTube si faili la video
const YT_PAGE_RE = /^https?:\/\/(?:www\.|m\.|music\.)?(?:youtube\.com|youtu\.be)\//i
// Fields ambazo si video (picha ndogo, audio, n.k.)
const SKIP_KEY = /thumb|cover|poster|avatar|image|icon|logo|preview|audio|mp3/i

function normalizeUrl(u) {
  let s = String(u || '').trim().split(/\s+/)[0]
  if (!s) return null
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`
  return s
}

// ───────────────────────── Response parsing ─────────────────────────

function deepScan(node, found, key = '', depth = 0) {
  if (node == null || depth > 6) return
  if (typeof node === 'string') {
    if (isHttp(node) && !YT_PAGE_RE.test(node) && !SKIP_KEY.test(key)) found.push(node)
    return
  }
  if (Array.isArray(node)) {
    for (const v of node) deepScan(v, found, key, depth + 1)
    return
  }
  if (typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) deepScan(v, found, k, depth + 1)
  }
}

// Height (p) of a format object: 720, "720p", "1280x720", "720p60" …  0 = unknown
function qualityOf(f) {
  const raw = f?.height ?? f?.quality ?? f?.qualityLabel ?? f?.label ?? f?.resolution ?? f?.format_note ?? ''
  const str = String(raw)
  const wh = str.match(/(\d{2,4})\s*[x×]\s*(\d{2,4})/i)
  if (wh) return Number(wh[2])
  const p = str.match(/(\d{3,4})\s*p/i) || str.match(/^\s*(\d{3,4})\s*$/)
  return p ? Number(p[1]) : 0
}

function isAudioOnly(f) {
  const t = `${f?.type || ''} ${f?.mimeType || ''} ${f?.mime || ''} ${f?.ext || ''}`
  if (f?.hasVideo === false) return true
  if (/audio/i.test(t) && !/video/i.test(t)) return true
  const u = String(f?.url || f?.download || f?.link || '')
  return /\.(mp3|m4a|opus|aac)(\?|$)/i.test(u)
}

/**
 * Collect every possible video link from an API response, best first:
 *   1) the API's own default link(s)   2) listed formats: highest ≤ TARGET_HEIGHT, then lower, then higher
 * fetchVideo() tries them in order, so a too-big/blocked link falls back to the next one.
 */
function pickCandidates(data) {
  const block = data?.result || data?.data || data || {}
  const title = String(block.title || data?.title || '').slice(0, 150)

  const explicit = []
  const add = (list, v) => {
    if (isHttp(v) && !YT_PAGE_RE.test(v) && !list.includes(v)) list.push(v)
  }
  for (const k of ['download', 'downloadUrl', 'download_url', 'dl', 'dlink', 'mp4', 'video', 'videoUrl', 'url', 'link']) {
    add(explicit, block[k])
  }

  const listed = []
  let order = 0
  for (const arr of [block, block.medias, block.media, block.formats, block.links, block.results, block.items]) {
    if (!Array.isArray(arr)) continue
    for (const f of arr) {
      order++
      if (typeof f === 'string') { if (isHttp(f)) listed.push({ url: f, q: 0, order }); continue }
      if (!f || isAudioOnly(f)) continue
      if (f.type && !/video/i.test(f.type)) continue
      const url = f.download || f.url || f.downloadUrl || f.download_url || f.link
      if (isHttp(url) && !YT_PAGE_RE.test(url)) listed.push({ url, q: qualityOf(f), order })
    }
  }
  const rank = (x) => (x.q === 0 ? [2, 0] : x.q <= TARGET_HEIGHT ? [0, -x.q] : [1, x.q])
  listed.sort((x, y) => {
    const [gx, vx] = rank(x)
    const [gy, vy] = rank(y)
    return gx - gy || vx - vy || x.order - y.order
  })

  const urls = []
  for (const u of explicit) add(urls, u)
  for (const x of listed) add(urls, x.url)
  if (!urls.length) {
    const found = []
    deepScan(data, found)
    for (const u of found) add(urls, u)
  }
  if (!urls.length) return null
  return { urls: urls.slice(0, 5), title }
}

/** Msimbo wa pamoja: ita API, kagua makosa, toa link ya video. */
async function callApi(label, endpoint, params, source) {
  const res = await http.get(endpoint, { params })
  const d = res.data
  if (typeof d === 'string' && d.trim().startsWith('<!')) throw new Error(`${label}: HTML response`)
  if (res.status >= 400 || d?.status === false || d?.success === false || d?.error) {
    throw new Error(`${label}: ${d?.message || d?.error || `HTTP ${res.status}`}`)
  }
  const v = pickCandidates(d)
  if (!v) throw new Error(`${label}: no video url`)
  return { url: v.urls[0], urls: v.urls, title: v.title, mimetype: 'video/mp4', source }
}

// ───────────────────────── Silatech ─────────────────────────

/** Silatech — GET /downloader/video?query=  (inakubali URL au jina) */
export async function silatechResolve(videoUrl) {
  return callApi('Silatech', `${SILATECH}/downloader/video`, { query: normalizeUrl(videoUrl) }, 'silatech')
}

// ───────────────────────── EliteProTech ─────────────────────────

/** EliteProTech — GET /download/ytmp4?url= */
export async function eliteResolve(videoUrl) {
  return callApi('Elite', `${ELITE}/download/ytmp4`, { url: normalizeUrl(videoUrl) }, 'elite')
}

// ───────────────────────── Download ─────────────────────────

/**
 * Pakua faili. Referer nyingine inajaribiwa TU kwa 401/403/429 au HTML; "too big" na timeout
 * zinashindwa mara moja (ili fetchVideo ihamie link/API inayofuata bila kupoteza muda).
 */
async function grabVideo(url, maxBytes = MAX_BYTES) {
  const origin = (() => {
    try {
      return new URL(url).origin + '/'
    } catch {
      return null
    }
  })()
  const refs = [...new Set([undefined, 'https://www.youtube.com/', origin].filter((r) => r !== null))]
  let lastErr
  for (const ref of refs) {
    try {
      const headers = { Accept: '*/*' }
      if (ref) headers.Referer = ref
      let res
      try {
        res = await http.get(url, {
          responseType: 'arraybuffer',
          timeout: 120000,
          maxContentLength: maxBytes,
          maxBodyLength: maxBytes,
          headers
        })
      } catch (e) {
        if (/maxContentLength|maxBodyLength|exceeded/i.test(String(e?.message))) {
          const big = new Error(`video too big (> ${Math.round(maxBytes / 1048576)}MB)`)
          big.fatal = true
          throw big
        }
        e.fatal = true // timeout / network error: do not hammer the same link
        throw e
      }
      if (res.status >= 400) {
        const e = new Error(`Download HTTP ${res.status}`)
        e.fatal = ![401, 403, 429].includes(res.status)
        throw e
      }
      const buf = Buffer.from(res.data)
      const head = buf.subarray(0, 32).toString('utf8').toLowerCase()
      if (head.includes('<html') || head.includes('<!doctype')) {
        throw new Error('Download returned HTML instead of media')
      }
      if (buf.length < 1000) throw new Error('Downloaded file too small / empty')
      return buf
    } catch (e) {
      lastErr = e
      if (e.fatal) break
    }
  }
  throw lastErr
}

// ───────────────────────── Search ─────────────────────────

const isYoutubeUrl = (v) => /(?:youtube\.com|youtu\.be|music\.youtube\.com)/i.test(String(v || ''))

function extractId(url) {
  const s = String(url)
  const m =
    s.match(/[?&]v=([\w-]{11})/) || s.match(/youtu\.be\/([\w-]{11})/) || s.match(/shorts\/([\w-]{11})/)
  return m ? m[1] : null
}

/** Tafuta YouTube kwa jina au URL. Inarudisha [{ id, title, url, thumbnail }] */
export async function ytSearch(query, limit = 5) {
  const q = String(query || '').trim()
  if (!q) return []

  if (isYoutubeUrl(q)) {
    const id = extractId(q)
    return id
      ? [{ id, title: q, url: `https://www.youtube.com/watch?v=${id}`, thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` }]
      : [{ id: '', title: q, url: normalizeUrl(q), thumbnail: null }]
  }

  // Piped instances
  const pipes = [
    `https://piped.video/api/v1/search?q=${encodeURIComponent(q)}&filter=videos`,
    `https://api.piped.private.coffee/search?q=${encodeURIComponent(q)}&filter=videos`,
    `https://pipedapi.kavin.rocks/search?q=${encodeURIComponent(q)}&filter=videos`
  ]
  for (const ep of pipes) {
    try {
      const res = await http.get(ep, { timeout: 20000 })
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
          thumbnail: item.thumbnail || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
          duration: Number(item.duration) || 0 // seconds; -1 = live stream
        })
      }
      if (out.length) return out
    } catch {}
  }

  // YouTube HTML fallback
  const res = await http.get('https://www.youtube.com/results', {
    params: { search_query: q },
    headers: { Accept: 'text/html', 'Accept-Language': 'en-US,en;q=0.9' },
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

// Extra APIs without touching code: VIDEO_APIS='["https://host/api/ytmp4?url={url}"]'
const EXTRA_APIS = (() => {
  try {
    const a = JSON.parse(process.env.VIDEO_APIS || '[]')
    return Array.isArray(a) ? a.filter((t) => typeof t === 'string' && t.includes('{url}')) : []
  } catch {
    return []
  }
})()

const PROVIDERS = [
  ['silatech', (u) => silatechResolve(u)],
  ['elite', (u) => eliteResolve(u)],
  ...EXTRA_APIS.map((tpl, i) => [
    `custom${i + 1}`,
    (u) => callApi(`Custom${i + 1}`, tpl.replace('{url}', encodeURIComponent(normalizeUrl(u))), {}, `custom${i + 1}`)
  ])
]

/** Inarudisha API ya kwanza iliyotoa link (bila kupakua). */
export async function resolveVideo(videoUrl) {
  const errors = []
  for (const [, run] of PROVIDERS) {
    try {
      return await run(videoUrl)
    } catch (e) {
      errors.push(e.message)
    }
  }
  throw new Error(errors.join(' → '))
}

// ── yt-dlp (last resort, only if installed: YTDLP_PATH or `yt-dlp` on PATH) ──
const YTDLP = process.env.YTDLP_PATH || 'yt-dlp'
let ytdlpOk
function hasYtdlp() {
  if (ytdlpOk !== undefined) return ytdlpOk
  try {
    execFileSync(YTDLP, ['--version'], { stdio: 'ignore', timeout: 8000 })
    ytdlpOk = true
  } catch {
    ytdlpOk = false
  }
  return ytdlpOk
}

async function ytdlpFetch(videoUrl) {
  if (!hasYtdlp()) throw new Error('yt-dlp: not installed')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'expert-ytdlp-'))
  try {
    const mb = Math.floor(MAX_BYTES / 1048576)
    const r = await ff(
      YTDLP,
      [
        '--no-playlist', '--no-warnings', '--max-filesize', `${mb}M`,
        '-f', `best[ext=mp4][height<=${TARGET_HEIGHT}]/best[height<=${TARGET_HEIGHT}]/best`,
        '-o', path.join(dir, 'v.%(ext)s'), normalizeUrl(videoUrl)
      ],
      180000
    )
    const file = fs.readdirSync(dir).find((f) => f.startsWith('v.'))
    if (!file) throw new Error((r.stderr || r.err?.message || 'no output').trim().split('\n').pop().slice(0, 160))
    const buf = fs.readFileSync(path.join(dir, file))
    if (buf.length < 1000) throw new Error('empty file')
    return { buf, url: videoUrl, title: '', mimetype: 'video/mp4', source: 'yt-dlp' }
  } catch (e) {
    throw new Error(`yt-dlp: ${e.message}`)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

/**
 * Resolve + pakua. Kwa kila API inajaribu links zake kwa mpangilio (quality bora ≤ TARGET kwanza);
 * link ikiwa kubwa mno / imezuiwa → link inayofuata → API inayofuata → yt-dlp (kama ipo).
 * Inarudisha { buf, url, title, mimetype, source }.
 */
export async function fetchVideo(videoUrl) {
  const errors = []
  for (const [name, run] of PROVIDERS) {
    let media
    try {
      media = await run(videoUrl)
    } catch (e) {
      errors.push(e.message)
      continue
    }
    for (const url of (media.urls?.length ? media.urls : [media.url]).slice(0, 3)) {
      try {
        const buf = await grabVideo(url)
        return { ...media, url, buf }
      } catch (e) {
        errors.push(`${media.source || name}: ${e.message}`)
      }
    }
  }
  try {
    return await ytdlpFetch(videoUrl)
  } catch (e) {
    if (!/not installed/.test(e.message)) errors.push(e.message)
  }
  throw new Error(errors.join(' → '))
}

// ───────────────────────── WhatsApp-safe mp4 ─────────────────────────

function ff(bin, args, ms) {
  return new Promise((resolve) => {
    execFile(bin, args, { timeout: ms, maxBuffer: 20 * 1024 * 1024 }, (err, stdout, stderr) => {
      resolve({ err, stdout: String(stdout || ''), stderr: String(stderr || '') })
    })
  })
}

/**
 * WhatsApp inacheza H.264 + AAC (yuv420p) ndani ya mp4 tu.
 * Faili lingine (VP9/AV1/webm/HEVC) linabadilishwa; lililo sawa linarudishwa kama lilivyo.
 * Kama ffmpeg haipo, faili la awali linarudishwa (bila kuvunja command).
 */
export async function ensurePlayableMp4(buf) {
  const bin = getFfmpegPath()
  if (!bin) {
    console.warn('[video] ffmpeg not found — sending original file')
    return buf
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'expert-vid-'))
  const inFile = path.join(dir, 'in.bin')
  const outFile = path.join(dir, 'out.mp4')
  try {
    fs.writeFileSync(inFile, buf)

    // `ffmpeg -i file` bila output hutoa taarifa kwenye stderr (exit code 1 ni kawaida)
    const info = (await ff(bin, ['-hide_banner', '-i', inFile], 20000)).stderr
    const vLine = info.match(/Stream #\S+.*?Video:\s*([^\n]+)/)?.[1] || ''
    const aLine = info.match(/Stream #\S+.*?Audio:\s*([^\n]+)/)?.[1] || ''
    const isMp4 = buf.length > 12 && buf.toString('ascii', 4, 8) === 'ftyp'
    const okVideo = /^h264\b/i.test(vLine) && /yuv420p/i.test(vLine)
    const okAudio = !aLine || /^aac\b/i.test(aLine)
    if (isMp4 && okVideo && okAudio) return buf

    const big = buf.length > 40 * 1024 * 1024 // large input → smaller output, faster encode
    const args = [
      '-y', '-hide_banner', '-loglevel', 'error', '-i', inFile,
      '-map', '0:v:0', '-map', '0:a:0?',
      '-vf', `scale='min(${big ? 854 : 1280},iw)':-2,format=yuv420p`,
      '-c:v', 'libx264', '-preset', big ? 'ultrafast' : 'veryfast', '-crf', big ? '30' : '28',
      '-c:a', 'aac', '-b:a', '128k',
      '-max_muxing_queue_size', '1024',
      '-movflags', '+faststart',
      outFile
    ]
    const r = await ff(bin, args, 240000)
    if (r.err || !fs.existsSync(outFile)) {
      throw new Error(`ffmpeg: ${(r.stderr || r.err?.message || 'failed').trim().split('\n').pop().slice(0, 200)}`)
    }
    const out = fs.readFileSync(outFile)
    if (out.length < 1000) throw new Error('ffmpeg: output empty')
    return out
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}
