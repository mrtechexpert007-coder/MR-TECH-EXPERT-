// ⟦EXPERT⟧ .sticker — image / video / gif → WhatsApp sticker
import sharp from 'sharp'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { downloadQuotedMedia } from '../lib/quotedMedia.js'

function runFfmpeg(args, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args], {
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

async function toStaticWebp(buf) {
  return sharp(buf)
    .resize(512, 512, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .webp({ quality: 90, alphaQuality: 90 })
    .toBuffer()
}

async function videoToAnimatedWebp(buf) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'expert-sticker-'))
  const inFile = path.join(dir, 'in')
  const outFile = path.join(dir, 'out.webp')
  fs.writeFileSync(inFile, buf)
  try {
    await runFfmpeg([
      '-i',
      inFile,
      '-vf',
      'scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000,fps=15',
      '-t',
      '6',
      '-loop',
      '0',
      '-an',
      '-c:v',
      'libwebp',
      '-quality',
      '60',
      '-compression_level',
      '6',
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
  name: 'sticker',
  aliases: ['s', 'stiker', 'stick'],
  desc: 'Convert image/video to sticker (reply to media)',
  async run(expert) {
    await expert.react('🧩').catch(() => {})
    try {
      const media = await downloadQuotedMedia(expert)
      let webp

      if (media.type === 'videoMessage' || /video|gif/i.test(media.mimetype)) {
        await expert.reply('⏳ Making animated sticker…').catch(() => {})
        webp = await videoToAnimatedWebp(media.buffer)
      } else if (
        media.type === 'imageMessage' ||
        media.type === 'stickerMessage' ||
        media.type === 'documentMessage' ||
        /image/i.test(media.mimetype)
      ) {
        webp = await toStaticWebp(media.buffer)
      } else {
        return expert.reply('Reply to an *image* or *video/gif* with `.sticker`')
      }

      if (!webp?.length) throw new Error('Sticker conversion failed')

      await expert.sock.sendMessage(
        expert.jid,
        {
          sticker: webp
        },
        { quoted: expert.msg }
      )
      await expert.react('✅').catch(() => {})
    } catch (e) {
      console.error('[sticker]', e)
      await expert.reply(`❌ *Sticker failed*\n${e.message}`)
      await expert.react('❌').catch(() => {})
    }
  }
}
