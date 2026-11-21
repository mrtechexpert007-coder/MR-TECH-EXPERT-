// ⟦EXPERT⟧ .mediafire — pakua faili kutoka link ya MediaFire na uitume WhatsApp
//   .mediafire https://www.mediafire.com/file/xxxx/jina.zip/file
import axios from 'axios'
import * as cheerio from 'cheerio'

const MAX_BYTES = Number(process.env.MEDIAFIRE_MAX_MB || 100) * 1024 * 1024
const UA = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9'
}
const LINK = /https?:\/\/(?:www\.)?mediafire\.com\/(?:file|view|download)\/[^\s]+/i

const MIME = {
  zip: 'application/zip', rar: 'application/vnd.rar', '7z': 'application/x-7z-compressed',
  apk: 'application/vnd.android.package-archive', pdf: 'application/pdf',
  mp4: 'video/mp4', mkv: 'video/x-matroska', mp3: 'audio/mpeg', m4a: 'audio/mp4',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', txt: 'text/plain',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
}
const mb = (n) => (n / 1048576).toFixed(1) + ' MB'

function parseSize(text = '') {
  const m = String(text).match(/([\d.,]+)\s*(KB|MB|GB|B)/i)
  if (!m) return 0
  const n = parseFloat(m[1].replace(',', '.'))
  return Math.round(n * { B: 1, KB: 1024, MB: 1048576, GB: 1073741824 }[m[2].toUpperCase()])
}

async function resolve(url) {
  const { data: html } = await axios.get(url, { headers: UA, timeout: 25000, maxRedirects: 5 })
  const $ = cheerio.load(html)
  const btn = $('#downloadButton, a.input.popsok').first()

  let direct = btn.attr('href')
  const scrambled = btn.attr('data-scrambled-url')
  if (scrambled) {
    try { direct = Buffer.from(scrambled, 'base64').toString('utf8') } catch {}
  }
  if (!direct || !/^https?:\/\//.test(direct)) {
    direct = (html.match(/https?:\/\/download[0-9]*\.mediafire\.com\/[^"'\s<>]+/) || [])[0]
  }
  if (!direct) throw new Error('Sikupata direct link (faili imefutwa, au link si sahihi)')

  const name =
    $('.dl-btn-label').attr('title') ||
    $('.filename').first().text().trim() ||
    decodeURIComponent(direct.split('/').pop().split('?')[0]) ||
    'mediafire-file'
  const sizeText = btn.text() || $('.details li:contains("Size") span').text()
  return { direct, name: name.replace(/[\\/:*?"<>|]+/g, ' ').trim(), size: parseSize(sizeText) }
}

export default {
  name: 'mediafire',
  aliases: ['mf', 'mfire'],
  desc: 'Download a file from MediaFire',
  async run(expert) {
    const link = (expert.text.match(LINK) || [])[0]
    if (!link) return expert.reply('📁 *Matumizi*\n`.mediafire <link ya MediaFire>`\nMfano: `.mediafire https://www.mediafire.com/file/xxxx/jina.zip/file`')

    await expert.react('📁').catch(() => {})
    await expert.reply('🔎 Natafuta faili kwenye MediaFire…').catch(() => {})
    try {
      console.log('[mediafire] resolving', link)
      const f = await Promise.race([
        resolve(link),
        new Promise((_, rej) => setTimeout(() => rej(new Error('MediaFire haijajibu kwa wakati (sekunde 40)')), 40000))
      ])
      console.log('[mediafire] direct link ok:', f.name, f.size)

      if (f.size && f.size > MAX_BYTES) {
        await expert.reply(`📦 *${f.name}* (${mb(f.size)}) ni kubwa mno kutumwa WhatsApp.\n🔗 Ipakue hapa: ${link}`)
        return expert.react('✅').catch(() => {})
      }

      await expert.reply(`⏳ *Napakua:* ${f.name}${f.size ? `\n📦 ${mb(f.size)}` : ''}`)
      const res = await axios.get(f.direct, {
        responseType: 'arraybuffer',
        headers: UA,
        timeout: 10 * 60 * 1000,
        maxContentLength: MAX_BYTES + 1024 * 1024
      })
      const buf = Buffer.from(res.data)
      if (buf.length > MAX_BYTES) throw new Error(`Faili ni kubwa mno (${mb(buf.length)})`)

      const ext = (f.name.split('.').pop() || '').toLowerCase()
      await expert.sock.sendMessage(
        expert.jid,
        {
          document: buf,
          mimetype: MIME[ext] || res.headers['content-type'] || 'application/octet-stream',
          fileName: f.name,
          caption: `📁 *${f.name}*\n📦 ${mb(buf.length)}\n_EXPERT MINI BOT_`
        },
        { quoted: expert.msg }
      )
      await expert.react('✅').catch(() => {})
    } catch (e) {
      console.error('[mediafire]', e)
      await expert.reply(`❌ *Mediafire failed*\n${String(e.message).slice(0, 300)}`)
      await expert.react('❌').catch(() => {})
    }
  }
}
