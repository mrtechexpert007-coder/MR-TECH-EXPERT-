// ⟦EXPERT⟧ .movie — download free/public-domain movies (Internet Archive, Wikimedia Commons) + trailers of any movie (YouTube)
//   .movie <name>           → find a free movie and send it
//   .movie trailer <name>   → send the trailer of any movie
import axios from 'axios'
import { downloadToDisk, BIG_MAX } from '../lib/bigfile.js'
import { ytSearch, fetchVideo, ensurePlayableMp4 } from '../lib/video.js'

const IA = 'https://archive.org'
const MAX_BYTES = Number(process.env.MOVIE_MAX_MB || 0) * 1024 * 1024 || BIG_MAX // downloaded to disk, not RAM
const UA = { 'User-Agent': 'Mozilla/5.0 (EXPERT-MINI-BOT movie command)' }

const safeName = (s) => String(s).replace(/[\\/:*?"<>|]+/g, ' ').slice(0, 60).trim() || 'movie'
const mb = (n) => (n / 1048576).toFixed(1) + ' MB'

async function searchArchive(q) {
  const query = `title:(${q.replace(/["()]/g, ' ')}) AND mediatype:movies AND collection:(feature_films OR moviesandfilms OR classic_cinema)`
  const { data } = await axios.get(`${IA}/advancedsearch.php`, {
    params: { q: query, 'fl[]': ['identifier', 'title', 'year', 'downloads'], sort: 'downloads desc', rows: 5, output: 'json' },
    headers: UA,
    timeout: 20000
  })
  return data?.response?.docs || []
}

async function pickFile(id) {
  const { data } = await axios.get(`${IA}/metadata/${id}`, { headers: UA, timeout: 20000 })
  const files = (data?.files || [])
    .filter((f) => /\.mp4$/i.test(f.name) && Number(f.size) > 0)
    .sort((a, b) => Number(b.size) - Number(a.size))
  // largest mp4 that still fits the size limit
  const fit = files.find((f) => Number(f.size) <= MAX_BYTES)
  return { fit, smallest: files[files.length - 1], page: `${IA}/details/${id}` }
}


// Second source: Wikimedia Commons (public-domain / freely licensed films, the base of WikiFlix)
async function sendFromCommons(expert, q) {
  const { data } = await axios.get('https://commons.wikimedia.org/w/api.php', {
    params: {
      action: 'query', format: 'json', generator: 'search', gsrsearch: `${q} filetype:video`,
      gsrnamespace: 6, gsrlimit: 5, prop: 'imageinfo', iiprop: 'url|size|mime'
    },
    headers: UA,
    timeout: 20000
  })
  const hits = Object.values(data?.query?.pages || {})
    .map((p) => ({ title: p.title.replace(/^File:/, '').replace(/\.\w+$/, ''), ...(p.imageinfo?.[0] || {}) }))
    .filter((x) => x.url && x.size)
  if (!hits.length) return false

  const top = hits[0]
  if (top.size > MAX_BYTES) {
    await expert.reply(`📦 *${top.title}* is too large to send on WhatsApp (${mb(top.size)}).\n🔗 ${top.descriptionurl || top.url}`)
    return true
  }
  await expert.reply(`⏳ *Downloading (Wikimedia):* ${top.title}\n📦 ${mb(top.size)}`)
  const ext = String(top.mime || '').includes('webm') ? 'webm' : String(top.mime || '').includes('ogg') ? 'ogv' : 'mp4'
  const dl = await downloadToDisk(top.url, { headers: UA, maxBytes: MAX_BYTES })
  try {
    await expert.sock.sendMessage(
      expert.jid,
      { document: { url: dl.file }, mimetype: top.mime || 'video/webm', fileName: `${safeName(top.title)}.${ext}`, caption: `🎬 *${top.title}*\n🔗 ${top.descriptionurl || ''}\n_EXPERT MINI BOT_` },
      { quoted: expert.msg }
    )
  } finally {
    await dl.cleanup()
  }
  return true
}

async function sendTrailer(expert, name) {
  const hits = await ytSearch(`${name} official trailer`, 3)
  if (!hits.length) return expert.reply('No trailer found.')
  const item = hits[0]
  await expert.reply(`⏳ *Downloading trailer…*\n📌 ${item.title}`)
  const media = await fetchVideo(item.url)
  let buf = media.buf
  try { buf = await ensurePlayableMp4(media.buf) } catch {}
  await expert.sock.sendMessage(
    expert.jid,
    { video: buf, mimetype: 'video/mp4', caption: `🎬 *${media.title || item.title}*\n🔗 ${item.url}` },
    { quoted: expert.msg }
  )
}

export default {
  name: 'movie',
  aliases: ['film', 'films', 'trailer'],
  desc: 'Download free movies / trailers',
  async run(expert) {
    let q = expert.text.trim()
    if (!q) {
      return expert.reply(
        '🎬 *Usage*\n`.movie <movie name>` — free movie (public domain)\n`.movie trailer <name>` — trailer of any movie\n\nExample: `.movie nosferatu`'
      )
    }

    const wantTrailer = /^trailer\s+/i.test(q)
    if (wantTrailer) q = q.replace(/^trailer\s+/i, '')

    await expert.react('🎬').catch(() => {})
    try {
      if (wantTrailer) {
        await sendTrailer(expert, q)
        return expert.react('✅').catch(() => {})
      }

      const docs = await searchArchive(q)
      if (!docs.length) {
        // nothing on archive.org → try Wikimedia Commons
        const found = await sendFromCommons(expert, q).catch((e) => { console.warn('[movie] commons:', e.message); return false })
        if (found) return expert.react('✅').catch(() => {})
        await expert.reply(`😕 I couldn't find a free movie called *${q}*.\nTry the trailer: \`.movie trailer ${q}\``)
        return expert.react('❌').catch(() => {})
      }

      const top = docs[0]
      const { fit, smallest, page } = await pickFile(top.identifier)
      const title = `${top.title}${top.year ? ` (${top.year})` : ''}`

      if (!fit) {
        const size = smallest ? ` (${mb(Number(smallest.size))})` : ''
        await expert.reply(`📦 *${title}* is too large to send on WhatsApp${size}.\n🔗 Download it here: ${page}`)
        return expert.react('✅').catch(() => {})
      }

      await expert.reply(`⏳ *Downloading:* ${title}\n📦 ${mb(Number(fit.size))}\nPlease wait…`)
      const dl = await downloadToDisk(`${IA}/download/${top.identifier}/${encodeURIComponent(fit.name)}`, { headers: UA, maxBytes: MAX_BYTES })
      try {
        await expert.sock.sendMessage(
          expert.jid,
          {
            document: { url: dl.file },
            mimetype: 'video/mp4',
            fileName: `${safeName(title)}.mp4`,
            caption: `🎬 *${title}*\n🔗 ${page}\n_EXPERT MINI BOT_`
          },
          { quoted: expert.msg }
        )
      } finally {
        await dl.cleanup()
      }

      if (docs.length > 1) {
        await expert.reply('🔎 *Other results:*\n' + docs.slice(1).map((d) => `• ${d.title}${d.year ? ` (${d.year})` : ''}`).join('\n'))
      }
      await expert.react('✅').catch(() => {})
    } catch (e) {
      console.error('[movie]', e)
      await expert.reply(`❌ *Movie failed*\n${String(e.message).slice(0, 400)}`)
      await expert.react('❌').catch(() => {})
    }
  }
}
