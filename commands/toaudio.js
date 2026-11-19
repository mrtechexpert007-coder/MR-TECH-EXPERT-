// ⟦EXPERT⟧ .toaudio — video / voice → audio (uses ffmpeg-static if present)
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { downloadQuotedMedia } from '../lib/quotedMedia.js'
import { requireFfmpeg, getFfmpegPath } from '../lib/ffmpegBin.js'

function runFfmpeg(args, timeoutMs = 90000) {
  const bin = requireFfmpeg()
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
      reject(
        e.code === 'ENOENT'
          ? new Error('ffmpeg binary missing — run: npm i ffmpeg-static@5.3.0')
          : e
      )
    })
    p.on('close', (code) => {
      clearTimeout(t)
      if (code === 0) resolve()
      else reject(new Error(err.trim() || `ffmpeg exit ${code}`))
    })
  })
}

async function toMp3(buf) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'expert-audio-'))
  const inFile = path.join(dir, 'in')
  const outFile = path.join(dir, 'out.mp3')
  fs.writeFileSync(inFile, buf)
  try {
    await runFfmpeg(['-i', inFile, '-vn', '-acodec', 'libmp3lame', '-q:a', '2', outFile])
    return fs.readFileSync(outFile)
  } finally {
    try {
      fs.rmSync(dir, { recursive: true, force: true })
    } catch {}
  }
}

export default {
  name: 'toaudio',
  aliases: ['tomp3', 'mp3', 'tovn'],
  desc: 'Convert video/voice to audio (reply to media)',
  async run(expert) {
    await expert.react('🎵').catch(() => {})
    try {
      const media = await downloadQuotedMedia(expert)
      const ok =
        media.type === 'videoMessage' ||
        media.type === 'audioMessage' ||
        media.type === 'documentMessage' ||
        /video|audio|mp4|mpeg|ogg|opus|m4a/i.test(media.mimetype)

      if (!ok) {
        return expert.reply('Reply to a *video* or *audio/voice note* with `.toaudio`')
      }

      let audioBuf
      let mime = 'audio/mpeg'

      // Already audio + no ffmpeg → resend as-is
      if (media.type === 'audioMessage' && !getFfmpegPath()) {
        audioBuf = media.buffer
        mime = media.mimetype || 'audio/ogg; codecs=opus'
      } else {
        await expert.reply('⏳ Extracting audio…').catch(() => {})
        audioBuf = await toMp3(media.buffer)
        mime = 'audio/mpeg'
      }

      if (!audioBuf?.length) throw new Error('Audio conversion failed')

      await expert.sock.sendMessage(
        expert.jid,
        {
          audio: audioBuf,
          mimetype: mime.startsWith('audio/') ? mime : 'audio/mpeg',
          ptt: false,
          fileName: mime.includes('mpeg') ? 'audio.mp3' : 'audio.ogg'
        },
        { quoted: expert.msg }
      )
      await expert.react('✅').catch(() => {})
    } catch (e) {
      console.error('[toaudio]', e)
      await expert.reply(`❌ *Toaudio failed*\n${e.message}`)
      await expert.react('❌').catch(() => {})
    }
  }
}
