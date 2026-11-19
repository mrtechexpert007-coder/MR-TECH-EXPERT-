// ⟦EXPERT⟧ .tourl — upload replied media to a link (catbox → uguu → tmpfiles → 0x0)
import { expertGetMedia } from '../lib/expert.admin.js'

const EXT = { imageMessage: 'jpg', videoMessage: 'mp4', audioMessage: 'mp3', stickerMessage: 'webp', documentMessage: 'bin' }

export default {
  name: 'tourl',
  aliases: ['upload', 'url'],
  desc: 'Turn replied media into a link',
  async run(z) {
    const media = await expertGetMedia(z)
    if (!media) return z.reply('Reply to an image, video, audio, sticker or file.')
    if (media.buffer.length > 50 * 1024 * 1024) return z.reply('❌ File too big (50 MB max).')
    await z.react('⏳')
    const mime = media.content.mimetype || 'application/octet-stream'
    const fname = `file.${EXT[media.type] || 'bin'}`
    const blob = () => new Blob([media.buffer], { type: mime })
    const tryFetch = (url, form) => fetch(url, { method: 'POST', body: form, signal: AbortSignal.timeout(60000), headers: { 'User-Agent': 'Mozilla/5.0' } })

    const uploaders = [
      ['catbox', async () => {
        const f = new FormData(); f.set('reqtype', 'fileupload'); f.set('fileToUpload', blob(), fname)
        const r = await tryFetch('https://catbox.moe/user/api.php', f)
        const t = (await r.text()).trim()
        if (!r.ok || !t.startsWith('http')) throw new Error(`HTTP ${r.status}`)
        return t
      }],
      ['uguu', async () => {
        const f = new FormData(); f.set('files[]', blob(), fname)
        const r = await tryFetch('https://uguu.se/upload', f)
        const d = await r.json()
        const u = d?.files?.[0]?.url
        if (!r.ok || !u) throw new Error(`HTTP ${r.status}`)
        return u
      }],
      ['tmpfiles', async () => {
        const f = new FormData(); f.set('file', blob(), fname)
        const r = await tryFetch('https://tmpfiles.org/api/v1/upload', f)
        const d = await r.json()
        const u = d?.data?.url
        if (!r.ok || !u) throw new Error(`HTTP ${r.status}`)
        return u.replace('tmpfiles.org/', 'tmpfiles.org/dl/')
      }],
      ['0x0', async () => {
        const f = new FormData(); f.set('file', blob(), fname)
        const r = await tryFetch('https://0x0.st', f)
        const t = (await r.text()).trim()
        if (!r.ok || !t.startsWith('http')) throw new Error(`HTTP ${r.status}`)
        return t
      }]
    ]

    const errs = []
    for (const [name, up] of uploaders) {
      try {
        const link = await up()
        await z.reply(`🔗 ${link}\n_via ${name}_`)
        return z.react('✅')
      } catch (e) {
        errs.push(`${name}: ${e.message}`)
      }
    }
    console.error('[tourl]', errs.join(' | '))
    await z.reply(`❌ Upload failed on all hosts.\n${errs.join('\n')}`)
    await z.react('❌').catch(() => {})
  }
       }
