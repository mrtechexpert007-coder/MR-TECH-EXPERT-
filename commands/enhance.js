// ⟦EXPERT⟧ .enhance — image/video quality boost (local-first, no 404 upload deps)
import axios from 'axios'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { downloadQuotedMedia } from '../lib/quotedMedia.js'

const require = createRequire(import.meta.url)

function ffmpegBin() {
  try {
    const p = require('ffmpeg-static')
    if (p && fs.existsSync(p)) return p
  } catch {}
  for (const b of [process.env.FFMPEG_PATH, 'ffmpeg', '/usr/bin/ffmpeg']) {
    if (!b) continue
    try {
      if (b !== 'ffmpeg' && !fs.existsSync(b)) continue
      return b
    } catch {}
  }
  return null
}

function runFfmpeg(args, timeoutMs = 120000) {
  const bin = ffmpegBin()
  if (!bin) throw new Error('ffmpeg not found — npm i ffmpeg-static@5.3.0')
  return new Promise((resolve, reject) => {
    const p = spawn(bin, ['-y', '-hide_banner', '-loglevel', 'error', ...args], {
      stdio: ['ignore', 'ignore', 'pipe']
    })
    let err = ''
    const t = setTimeout(() => {
      try {
        p.kill('SIGKILL')
      } catch {}
      reject(new Error('ffmpeg timeout'))
    }, timeoutMs)
    p.stderr.on('data', (d) => {
      err += d.toString()
    })
    p.on('error', (e) => {
      clearTimeout(t)
      reject(e)
    })
    p.on('close', (code) => {
      clearTimeout(t)
      if (code === 0) resolve()
      else reject(new Error(err.trim() || `ffmpeg exit ${code}`))
    })
  })
}

/** Local enhance with sharp — no network, no 404 */
async function enhanceLocal(buf) {
  const sharp = (await import('sharp')).default
  const meta = await sharp(buf).metadata()
  const w = meta.width || 512
  const target = Math.min(Math.max(w * 2, 720), 1920)
  return sharp(buf)
    .resize({
      width: target,
      withoutEnlargement: false,
      kernel: sharp.kernel.lanczos3
    })
    .sharpen({ sigma: 1.2, m1: 1.0, m2: 0.7 })
    .modulate({ brightness: 1.02, saturation: 1.05 })
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer()
}

async function uploadPublic(buf, mime = 'image/jpeg') {
  const FormData = (await import('form-data')).default
  const hosts = [
    async () => {
      // litterbox (temporary catbox sister) — often more reliable
      const form = new FormData()
      form.append('reqtype', 'fileupload')
      form.append('time', '1h')
      form.append('fileToUpload', buf, {
        filename: 'img.jpg',
        contentType: mime
      })
      const res = await axios.post('https://litterbox.catbox.moe/resources/internals/api.php', form, {
        headers: form.getHeaders(),
        timeout: 60000,
        maxBodyLength: Infinity,
        validateStatus: () => true
      })
      const url = String(res.data || '').trim()
      if (res.status < 400 && /^https?:\/\//i.test(url)) return url
      throw new Error(`litterbox ${res.status}`)
    },
    async () => {
      const form = new FormData()
      form.append('reqtype', 'fileupload')
      form.append('fileToUpload', buf, {
        filename: 'img.jpg',
        contentType: mime
      })
      const res = await axios.post('https://catbox.moe/user/api.php', form, {
        headers: form.getHeaders(),
        timeout: 60000,
        maxBodyLength: Infinity,
        validateStatus: () => true
      })
      const url = String(res.data || '').trim()
      if (res.status < 400 && /^https?:\/\//i.test(url)) return url
      throw new Error(`catbox ${res.status}`)
    },
    async () => {
      // uguu.se
      const form = new FormData()
      form.append('files[]', buf, { filename: 'img.jpg', contentType: mime })
      const res = await axios.post('https://uguu.se/upload.php', form, {
        headers: form.getHeaders(),
        timeout: 60000,
        maxBodyLength: Infinity,
        validateStatus: () => true
      })
      const url = res.data?.files?.[0]?.url || res.data?.url
      if (url && /^https?:\/\//i.test(url)) return url
      throw new Error(`uguu ${res.status}`)
    }
  ]

  const errors = []
  for (const fn of hosts) {
    try {
      return await fn()
    } catch (e) {
      errors.push(e.message)
    }
  }
  throw new Error('Upload failed: ' + errors.join(' | '))
}

async function enhanceWsrv(imageUrl) {
  const u =
    `https://wsrv.nl/?url=${encodeURIComponent(imageUrl)}` +
    `&w=1280&fit=inside&filt=sharpen&output=jpg&q=95&n=-1`
  const res = await axios.get(u, {
    responseType: 'arraybuffer',
    timeout: 60000,
    headers: { 'User-Agent': 'Mozilla/5.0' },
    validateStatus: () => true
  })
  if (res.status === 404) throw new Error('wsrv 404 — source image unreachable')
  if (res.status >= 400) throw new Error(`wsrv HTTP ${res.status}`)
  const buf = Buffer.from(res.data)
  if (buf.length < 500) throw new Error('wsrv empty response')
  return buf
}

async function enhanceCustom(imageUrl) {
  const base = process.env.ENHANCE_API_URL
  if (!base) return null
  const sep = base.includes('?') ? (base.endsWith('=') || base.endsWith('&') ? '' : '&') : '?'
  const url = `${base}${sep}url=${encodeURIComponent(imageUrl)}`
  const res = await axios.get(url, {
    timeout: 120000,
    responseType: 'arraybuffer',
    headers: {
      'User-Agent': 'Mozilla/5.0',
      Accept: '*/*',
      ...(process.env.ENHANCE_API_KEY
        ? { Authorization: process.env.ENHANCE_API_KEY, apikey: process.env.ENHANCE_API_KEY }
        : {})
    },
    validateStatus: () => true
  })
  const ct = String(res.headers['content-type'] || '')
  if (ct.includes('json') || (res.data[0] === 0x7b /* { */)) {
    const j = JSON.parse(Buffer.from(res.data).toString('utf8'))
    const out =
      j.result || j.url || j.data?.url || j.data?.image || j.image || j.result?.url
    if (!out) throw new Error(j.message || j.msg || j.error || 'Custom API no image')
    const img = await axios.get(out, {
      responseType: 'arraybuffer',
      timeout: 60000,
      validateStatus: () => true
    })
    if (img.status >= 400) throw new Error(`Custom result HTTP ${img.status}`)
    return Buffer.from(img.data)
  }
  if (res.status >= 400) throw new Error(`Custom API HTTP ${res.status}`)
  return Buffer.from(res.data)
}

async function enhanceVideo(buf) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'expert-enh-'))
  const inFile = path.join(dir, 'in.mp4')
  const outFile = path.join(dir, 'out.mp4')
  fs.writeFileSync(inFile, buf)
  try {
    await runFfmpeg([
      '-i',
      inFile,
      '-vf',
      'scale=iw*1.5:ih*1.5:flags=lanczos,unsharp=5:5:1.0:5:5:0.0',
      '-c:v',
      'libx264',
      '-preset',
      'fast',
      '-crf',
      '23',
      '-c:a',
      'copy',
      '-movflags',
      '+faststart',
      '-t',
      '60',
      outFile
    ])
    return fs.readFileSync(outFile)
  } finally {
    try {
      fs.rmSync(dir, { recursive: true, force: true })
    } catch {}
  }
}

export default {
  name: 'enhance',
  aliases: ['hd', 'upscale', 'remini', 'hdr'],
  desc: 'Enhance / upscale image or short video (reply)',
  async run(expert) {
    await expert.react('✨').catch(() => {})
    try {
      const media = await downloadQuotedMedia(expert)
      const isVid =
        media.type === 'videoMessage' || /video|mp4|mkv/i.test(media.mimetype)
      const isImg =
        media.type === 'imageMessage' ||
        media.type === 'stickerMessage' ||
        /image|webp|jpeg|png|jpg/i.test(media.mimetype)

      if (!isImg && !isVid) {
        return expert.reply('Reply to an *image* (or short *video*) with `.enhance`')
      }

      if (isVid) {
        await expert.reply('⏳ Enhancing video…').catch(() => {})
        const out = await enhanceVideo(media.buffer)
        await expert.sock.sendMessage(
          expert.jid,
          { video: out, caption: '✨ Enhanced video\n_NEXUS-MD_' },
          { quoted: expert.msg }
        )
        return expert.react('✅').catch(() => {})
      }

      await expert.reply('⏳ Enhancing image…').catch(() => {})

      let outBuf = null
      let method = ''
      const errors = []

      // 1) LOCAL sharp first — no upload, no 404
      try {
        outBuf = await enhanceLocal(media.buffer)
        method = 'sharp-local'
      } catch (e) {
        errors.push('sharp: ' + e.message)
      }

      // 2) Optional custom AI API
      if (!outBuf && process.env.ENHANCE_API_URL) {
        try {
          const pub = await uploadPublic(media.buffer, media.mimetype || 'image/jpeg')
          outBuf = await enhanceCustom(pub)
          method = 'custom-api'
        } catch (e) {
          errors.push('custom: ' + e.message)
        }
      }

      // 3) wsrv remote sharpen
      if (!outBuf) {
        try {
          const pub = await uploadPublic(media.buffer, media.mimetype || 'image/jpeg')
          outBuf = await enhanceWsrv(pub)
          method = 'wsrv-sharpen'
        } catch (e) {
          errors.push('wsrv: ' + e.message)
        }
      }

      if (!outBuf) {
        throw new Error(
          errors.length
            ? errors.join('\n')
            : 'Enhance failed. Install: npm i sharp'
        )
      }

      await expert.sock.sendMessage(
        expert.jid,
        {
          image: outBuf,
          caption: `✨ *Enhanced* (${method})\n_NEXUS-MD_`
        },
        { quoted: expert.msg }
      )
      await expert.react('✅').catch(() => {})
    } catch (e) {
      console.error('[enhance]', e)
      await expert.reply(`❌ *Enhance failed*\n${e.message}`)
      await expert.react('❌').catch(() => {})
    }
  }
}
