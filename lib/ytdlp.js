// ⟦EXPERT⟧ yt-dlp runner — downloads media locally, no third-party download APIs.
// The yt-dlp binary is fetched once from GitHub into storage/bin (no Python needed).
// Optional env: YTDLP_PATH, YT_COOKIES (Netscape cookies text), YT_PROXY (http://user:pass@host:port)
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import axios from 'axios'
import { expertCfg } from '../config/expert.config.js'
import { getFfmpegPath } from './ffmpegBin.js'

const BIN_DIR = path.join(expertCfg.root, 'storage', 'bin')
const BIN = path.join(BIN_DIR, 'yt-dlp')
let binPromise = null

function run(bin, args, ms = 120000) {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { timeout: ms, maxBuffer: 20 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        const text = String(stderr || err.message || '').trim().split('\n').filter(Boolean)
        const line = text.reverse().find((l) => /error/i.test(l)) || text[0] || err.message
        return reject(new Error(line.replace(/^ERROR:\s*/i, '').slice(0, 300)))
      }
      resolve(String(stdout || ''))
    })
  })
}

async function works(bin) {
  try { await run(bin, ['--version'], 15000); return true } catch { return false }
}

export async function ensureYtdlp() {
  if (binPromise) return binPromise
  binPromise = (async () => {
    if (process.env.YTDLP_PATH && (await works(process.env.YTDLP_PATH))) return process.env.YTDLP_PATH
    if (fs.existsSync(BIN) && (await works(BIN))) return BIN
    if (await works('yt-dlp')) return 'yt-dlp'
    fs.mkdirSync(BIN_DIR, { recursive: true })
    const asset = process.arch === 'arm64' ? 'yt-dlp_linux_aarch64' : 'yt-dlp_linux'
    const url = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${asset}`
    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 180000, maxRedirects: 8 })
    fs.writeFileSync(BIN, Buffer.from(res.data), { mode: 0o755 })
    if (!(await works(BIN))) throw new Error('yt-dlp downloaded but cannot run on this host')
    return BIN
  })().catch((e) => { binPromise = null; throw new Error(`yt-dlp setup: ${e.message}`) })
  return binPromise
}

export async function ytdlpVersion() {
  const bin = await ensureYtdlp()
  return (await run(bin, ['--version'], 15000)).trim()
}

/**
 * Tafuta YouTube moja kwa moja kwa yt-dlp (haitegemei Piped instances au kusoma HTML ya YouTube,
 * ambazo huwa hazitegemeki). Inarudisha orodha kama ile ya ytSearch: [{ id, title, url, thumbnail }]
 */
export async function ytdlpSearch(query, limit = 5) {
  const q = String(query || '').trim()
  if (!q) return []
  const bin = await ensureYtdlp()
  const out = await run(
    bin,
    [`ytsearch${Math.max(1, limit)}:${q}`, '--flat-playlist', '--dump-json', '--no-warnings', '--socket-timeout', '15'],
    30000
  )
  const items = []
  for (const line of out.split('\n')) {
    const t = line.trim()
    if (!t) continue
    try {
      const j = JSON.parse(t)
      const id = j.id
      if (!id) continue
      items.push({
        id,
        title: j.title || id,
        url: j.webpage_url || j.url || `https://www.youtube.com/watch?v=${id}`,
        thumbnail: j.thumbnail || (Array.isArray(j.thumbnails) ? j.thumbnails.at(-1)?.url : null) || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
      })
    } catch {}
    if (items.length >= limit) break
  }
  if (!items.length) throw new Error('yt-dlp: no results')
  return items
}

const isYt = (u) => /(?:youtube\.com|youtu\.be|music\.youtube\.com)/i.test(u)

function mimeFor(ext, kind) {
  const e = String(ext).toLowerCase()
  if (kind === 'audio') return { m4a: 'audio/mp4', mp4: 'audio/mp4', mp3: 'audio/mpeg', ogg: 'audio/ogg', opus: 'audio/ogg' }[e] || null
  return e === 'mp4' ? 'video/mp4' : null
}

/** Download with yt-dlp. kind: 'audio' | 'video'. Returns { buf, title, mimetype, source } */
export async function ytdlpMedia(kind, pageUrl, maxBytes = 90 * 1024 * 1024) {
  const bin = await ensureYtdlp()
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ytdlp-'))
  try {
    const ff = getFfmpegPath?.()
    const fmt = kind === 'audio'
      ? 'bestaudio[ext=m4a]/bestaudio/best'
      : isYt(pageUrl)
        ? 'best[ext=mp4][height<=720]/best[ext=mp4]/bv*[ext=mp4][height<=480]+ba[ext=m4a]/best'
        : 'best[ext=mp4]/best'
    const base = [
      '--no-playlist', '--no-warnings', '--no-progress', '--no-update',
      '--max-filesize', `${Math.max(1, Math.floor(maxBytes / 1048576))}M`,
      '-f', fmt, '--merge-output-format', 'mp4',
      '-o', path.join(dir, 'out.%(ext)s'),
      '--print', 'title', '--no-simulate',
      '--socket-timeout', '20', '--retries', '2',
      ...(ff ? ['--ffmpeg-location', ff] : []),
      ...(process.env.YT_PROXY ? ['--proxy', process.env.YT_PROXY] : [])
    ]
    if (process.env.YT_COOKIES) {
      const cf = path.join(dir, 'cookies.txt')
      fs.writeFileSync(cf, process.env.YT_COOKIES.replace(/\\n/g, '\n'))
      base.push('--cookies', cf)
    }

    // try the default client first, then alternative YouTube clients (helps against bot checks)
    const attempts = isYt(pageUrl)
      ? [[], ['--extractor-args', 'youtube:player_client=android_vr'], ['--extractor-args', 'youtube:player_client=tv'], ['--extractor-args', 'youtube:player_client=web_safari']]
      : [[]]

    let title = ''
    let lastErr
    for (const extra of attempts) {
      for (const f of fs.readdirSync(dir)) if (f.startsWith('out.')) fs.rmSync(path.join(dir, f), { force: true })
      const args = [...base, ...extra, '--js-runtimes', 'node', pageUrl]
      try {
        let out
        try { out = await run(bin, args) }
        catch (e) {
          if (!/no such option|js-runtimes/i.test(e.message)) throw e
          out = await run(bin, args.filter((a, i, arr) => a !== '--js-runtimes' && arr[i - 1] !== '--js-runtimes'))
        }
        title = out.trim().split('\n')[0] || ''
        lastErr = null
        break
      } catch (e) { lastErr = e }
    }
    if (lastErr) throw lastErr

    const file = fs.readdirSync(dir).find((f) => f.startsWith('out.') && !f.endsWith('.part'))
    if (!file) throw new Error('yt-dlp finished but produced no file')
    let full = path.join(dir, file)
    let ext = path.extname(file).slice(1)
    let mimetype = mimeFor(ext, kind)

    // WhatsApp-friendly audio: convert webm/other to mp3
    if (kind === 'audio' && !mimetype) {
      if (!ff) throw new Error(`audio is .${ext} and ffmpeg is not available to convert it`)
      const mp3 = path.join(dir, 'conv.mp3')
      await run(ff, ['-y', '-i', full, '-vn', '-b:a', '128k', mp3], 120000)
      full = mp3; ext = 'mp3'; mimetype = 'audio/mpeg'
    }
    if (kind === 'video' && !mimetype) mimetype = 'video/mp4'

    const buf = fs.readFileSync(full)
    if (buf.length < 1000) throw new Error('yt-dlp file too small / empty')
    if (buf.length > maxBytes) throw new Error('File too large for WhatsApp')
    return { buf, title, mimetype, source: 'yt-dlp' }
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }) } catch {}
  }
          }
