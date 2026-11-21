// ⟦EXPERT⟧ .tts [-lang] text — text to voice note (Swahili is the default language)
// Examples:  .tts Habari za asubuhi      .tts -en Hello there      (or reply to any message with .tts)
import { spawn } from 'node:child_process'
import { getFfmpegPath } from '../lib/ffmpegBin.js'

const MAX_CHARS = 1000
const CHUNK = 180 // Google TTS accepts roughly 200 characters per request

const LANGS = 'sw (Swahili), en, fr, ar, hi, es, pt, de, ru, tr, id, ja, ko, zh-cn'

function quotedText(msg) {
  const m = msg?.message
  const ctx = m?.extendedTextMessage?.contextInfo || m?.imageMessage?.contextInfo || m?.videoMessage?.contextInfo
  const q = ctx?.quotedMessage
  if (!q) return ''
  return (q.conversation || q.extendedTextMessage?.text || q.imageMessage?.caption || q.videoMessage?.caption || '').trim()
}

// Split long text into pieces ≤ CHUNK, at sentence or word boundaries
function splitText(text) {
  const out = []
  let rest = text.replace(/\s+/g, ' ').trim()
  while (rest.length > CHUNK) {
    let cut = Math.max(rest.lastIndexOf('. ', CHUNK), rest.lastIndexOf('! ', CHUNK), rest.lastIndexOf('? ', CHUNK), rest.lastIndexOf(', ', CHUNK))
    if (cut < 40) cut = rest.lastIndexOf(' ', CHUNK)
    if (cut < 1) cut = CHUNK
    out.push(rest.slice(0, cut + 1).trim())
    rest = rest.slice(cut + 1).trim()
  }
  if (rest) out.push(rest)
  return out
}

async function fetchChunk(text, lang) {
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(lang)}&q=${encodeURIComponent(text)}`
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(12000) })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  const buf = Buffer.from(await r.arrayBuffer())
  if (buf.length < 100) throw new Error('empty audio')
  return buf
}

// mp3 → ogg/opus (a real WhatsApp voice note, with waveform). No ffmpeg → null.
function toOpus(mp3) {
  const bin = getFfmpegPath()
  if (!bin) return Promise.resolve(null)
  return new Promise((resolve) => {
    const p = spawn(bin, ['-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', '-vn', '-c:a', 'libopus', '-b:a', '32k', '-ar', '48000', '-ac', '1', '-f', 'ogg', 'pipe:1'], { stdio: ['pipe', 'pipe', 'ignore'] })
    const out = []
    const timer = setTimeout(() => { p.kill('SIGKILL'); resolve(null) }, 30000)
    p.stdout.on('data', (d) => out.push(d))
    p.on('error', () => { clearTimeout(timer); resolve(null) })
    p.on('close', (code) => { clearTimeout(timer); const b = Buffer.concat(out); resolve(code === 0 && b.length > 100 ? b : null) })
    p.stdin.on('error', () => {})
    p.stdin.end(mp3)
  })
}

export default {
  name: 'tts',
  aliases: ['say', 'voice'],
  desc: 'Text to voice note. Example: .tts Habari yako',
  async run(z) {
    const args = [...z.args]
    let lang = 'sw'
    if (/^-[a-z]{2}(-[a-z]{2})?$/i.test(args[0] || '')) lang = args.shift().slice(1).toLowerCase()

    const text = (args.join(' ').trim() || quotedText(z.msg)).trim()
    if (!text) {
      return z.reply(`🗣️ *Text to speech*\n\n• \`.tts Good morning\`\n• \`.tts -sw Habari za asubuhi\`\n• Reply to any message with \`.tts\`\n\nLanguages: ${LANGS}`)
    }
    if (text.length > MAX_CHARS) return z.reply(`❌ Text is too long (${text.length} characters). Max is ${MAX_CHARS}.`)

    await z.react('🎙️').catch(() => {})
    try {
      const parts = []
      for (const piece of splitText(text)) parts.push(await fetchChunk(piece, lang))
      const mp3 = Buffer.concat(parts)

      const opus = await toOpus(mp3)
      const payload = opus
        ? { audio: opus, mimetype: 'audio/ogg; codecs=opus', ptt: true }
        : { audio: mp3, mimetype: 'audio/mpeg', ptt: true }

      await z.sock.sendMessage(z.jid, payload, { quoted: z.msg })
      await z.react('✅').catch(() => {})
    } catch (e) {
      console.error('[tts]', e)
      await z.reply(/HTTP 4|invalid|language/i.test(String(e.message)) ? `❌ Language \`${lang}\` is not supported. Try: ${LANGS}` : '❌ Could not generate audio. Please try again later.')
      await z.react('❌').catch(() => {})
    }
  }
}
