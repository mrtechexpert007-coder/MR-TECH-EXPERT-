// ⟦EXPERT⟧ .retouch <prompt> — reply to a photo, describe how you want it to look, get it back edited
// Usage: reply to an image with  .retouch make the lighting warmer and remove the background clutter
// No prompt given → a sensible default "clean up this photo" prompt is used.
import { expertGetMedia } from '../lib/expert.admin.js'

const DEFAULT_PROMPT = 'enhance this photo: improve lighting and contrast, sharpen details, reduce noise, natural and vivid colors, keep it photorealistic'
const UA = { 'User-Agent': 'Mozilla/5.0' }

const isImage = (b) =>
  b.length > 1000 &&
  ((b[0] === 0xff && b[1] === 0xd8) ||
    (b[0] === 0x89 && b.toString('ascii', 1, 4) === 'PNG') ||
    (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP'))

// Shrink big photos first: faster upload and faster AI processing. Falls back to the original if sharp fails.
async function prepare(buf) {
  try {
    const sharp = (await import('sharp')).default
    return await sharp(buf).rotate().resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer()
  } catch {
    return buf
  }
}

// Upload the image somewhere public so the AI image-edit API can fetch it. Tries several hosts.
async function uploadPublic(buf, fname = 'img.jpg', mime = 'image/jpeg', errors = []) {
  const blob = () => new Blob([buf], { type: mime })
  const post = (url, form) => fetch(url, { method: 'POST', body: form, headers: UA, signal: AbortSignal.timeout(25000) })

  const uploaders = [
    ['catbox', async () => {
      const f = new FormData(); f.set('reqtype', 'fileupload'); f.set('fileToUpload', blob(), fname)
      const r = await post('https://catbox.moe/user/api.php', f)
      const t = (await r.text()).trim()
      if (!r.ok || !t.startsWith('http')) throw new Error(`HTTP ${r.status}`)
      return t
    }],
    ['litterbox', async () => {
      const f = new FormData(); f.set('reqtype', 'fileupload'); f.set('time', '1h'); f.set('fileToUpload', blob(), fname)
      const r = await post('https://litterbox.catbox.moe/resources/internals/api.php', f)
      const t = (await r.text()).trim()
      if (!r.ok || !t.startsWith('http')) throw new Error(`HTTP ${r.status}`)
      return t
    }],
    ['uguu', async () => {
      const f = new FormData(); f.set('files[]', blob(), fname)
      const r = await post('https://uguu.se/upload', f)
      const u = (await r.json())?.files?.[0]?.url
      if (!r.ok || !u) throw new Error(`HTTP ${r.status}`)
      return u
    }],
    ['tmpfiles', async () => {
      const f = new FormData(); f.set('file', blob(), fname)
      const r = await post('https://tmpfiles.org/api/v1/upload', f)
      const u = (await r.json())?.data?.url
      if (!r.ok || !u) throw new Error(`HTTP ${r.status}`)
      return u.replace('tmpfiles.org/', 'tmpfiles.org/dl/') // direct-download link
    }],
    ['0x0', async () => {
      const f = new FormData(); f.set('file', blob(), fname)
      const r = await post('https://0x0.st', f)
      const t = (await r.text()).trim()
      if (!r.ok || !t.startsWith('http')) throw new Error(`HTTP ${r.status}`)
      return t
    }]
  ]

  for (const [name, up] of uploaders) {
    try { return await up() } catch (e) { errors.push(`upload ${name}: ${e?.message || e}`) }
  }
  throw new Error('all upload hosts failed')
}

// AI image-edit (img2img): Pollinations' Kontext model, no API key needed. One retry on failure.
async function aiRetouch(imageUrl, prompt, errors = []) {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
    `?model=kontext&image=${encodeURIComponent(imageUrl)}&nologo=true&safe=true&seed=${Math.floor(Math.random() * 1e9)}`
  let last
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(75000) })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const buf = Buffer.from(await r.arrayBuffer())
      if (!isImage(buf)) throw new Error('AI did not return an image')
      return buf
    } catch (e) {
      last = e
      errors.push(`ai attempt ${attempt}: ${e?.message || e}`)
    }
  }
  throw last
}

// Local fallback if the AI edit is unreachable: basic sharpen/contrast/color pass, no prompt awareness
async function localFallback(buf) {
  const sharp = (await import('sharp')).default
  const meta = await sharp(buf).metadata()
  const target = Math.min(Math.max((meta.width || 512) * 1.2, 720), 1920)
  return sharp(buf)
    .resize({ width: Math.round(target), withoutEnlargement: false, kernel: sharp.kernel.lanczos3 })
    .sharpen({ sigma: 1.1 })
    .modulate({ brightness: 1.03, saturation: 1.08 })
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer()
}

export default {
  name: 'retouch',
  aliases: ['fixphoto', 'glowup'],
  desc: 'Reply to a photo with .retouch <how you want it to look> to clean it up with AI',
  async run(z) {
    const media = await expertGetMedia(z).catch(() => null)
    if (!media || media.type !== 'imageMessage') {
      return z.reply(`🖼️ Reply to a photo with:\n${z.prefix}retouch <how you want it to look, e.g. "make it brighter and remove the noise">`)
    }

    const prompt = (z.text || '').trim() || DEFAULT_PROMPT
    await z.react('🪄').catch(() => {})
    try { await z.sock.sendPresenceUpdate('composing', z.jid) } catch {}

    const errors = []
    try {
      const small = await prepare(media.buffer)
      const link = await uploadPublic(small, 'img.jpg', 'image/jpeg', errors)
      const out = await aiRetouch(link, prompt, errors)
      await z.sock.sendMessage(z.jid, { image: out, caption: `✨ ${prompt}` }, { quoted: z.msg })
      await z.react('✅').catch(() => {})
    } catch (e) {
      console.warn('[retouch] AI path failed:', errors.join(' | '))
      const why = String(e?.message || e).slice(0, 120)
      try {
        const out = await localFallback(media.buffer)
        await z.sock.sendMessage(z.jid, {
          image: out,
          caption: `✨ Quick enhance only — the AI service was unavailable (${why}), so your prompt was NOT applied. Try again in a minute.`
        }, { quoted: z.msg })
        await z.react('⚠️').catch(() => {})
      } catch (e2) {
        await z.reply(`❌ Retouch failed.\n• AI: ${why}\n• Local: ${String(e2?.message || e2).slice(0, 120)}\n\nDetails:\n${errors.slice(-6).join('\n')}`)
        await z.react('❌').catch(() => {})
      }
    }
  }
}
