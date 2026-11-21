// ⟦EXPERT⟧ .quran <surah:ayah> [sw|en]  — Arabic text + translation (api.alquran.cloud)
// Examples: .quran 2:255   ·   .quran 36:1 en   ·   .quran   (random ayah)
import { expertHttp } from '../lib/expert.admin.js'

const ARABIC = 'quran-uthmani'
const EDITIONS = { sw: 'sw.barwani', en: 'en.asad' }

async function fetchAyah(ref, edition) {
  const r = await (await expertHttp(`https://api.alquran.cloud/v1/ayah/${ref}/editions/${ARABIC},${edition}`)).json()
  if (!Array.isArray(r?.data) || r.data.length < 2) throw new Error('bad response')
  return r.data
}

export default {
  name: 'quran',
  aliases: ['ayah', 'quraan', 'kuran'],
  desc: 'Quran ayah. Usage: .quran 2:255 [sw|en]',
  async run(z) {
    const p = z.prefix || '.'
    const first = z.args?.[0] || ''
    let ref
    if (!first) ref = String(1 + Math.floor(Math.random() * 6236)) // random ayah (global number)
    else if (/^\d{1,3}:\d{1,3}$/.test(first)) ref = first
    else return z.reply(`Usage: *${p}quran 2:255*\nEnglish: *${p}quran 2:255 en*\nRandom ayah: *${p}quran*`)

    const lang = (z.args?.[1] || 'sw').toLowerCase()
    const edition = EDITIONS[lang] || EDITIONS.sw

    try {
      let data
      try { data = await fetchAyah(ref, edition) }
      catch (e) {
        if (edition === EDITIONS.en) throw e
        data = await fetchAyah(ref, EDITIONS.en) // Swahili edition unavailable → English
      }
      const [ar, tr] = data
      const s = ar.surah || {}
      await z.reply(
        `🕌 *${s.englishName || 'Surah'}* (${s.number}:${ar.numberInSurah})\n\n` +
        `${ar.text}\n\n${tr.text}\n\n_Translation: ${tr.edition?.englishName || tr.edition?.name || ''}_`
      )
    } catch {
      await z.reply(`❌ Ayah not found.\n\nUsage: *${p}quran 2:255*  (surah:ayah)`)
    }
  }
}
