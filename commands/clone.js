// ⟦EXPERT⟧ .clone — hifadhi ukurasa wa wavuti (HTML + CSS/JS/picha) kama ZIP
// Matumizi: .clone https://example.com
// Tumia kwa tovuti zako au ulizoruhusiwa; heshimu hakimiliki za wengine.
import { cloneSite } from '../lib/siteclone.js'

const COOLDOWN_MS = 20000
const MAX_PARALLEL = 2
let running = 0
const last = new Map()

export default {
  name: 'clone',
  aliases: ['webzip', 'sitezip', 'savesite', 'getsite'],
  desc: 'Save a webpage (HTML + CSS/JS/images) as a ZIP',
  async run(z) {
    const q = z.text.trim()
    if (!q) {
      return z.reply('Usage: `.clone <website url>`\nMfano: `.clone https://example.com`\n\n_Inahifadhi ukurasa mmoja kama ZIP. Tumia kwa tovuti zako au ulizoruhusiwa._')
    }
    const key = z.sender || z.jid
    const wait = (last.get(key) || 0) + COOLDOWN_MS - Date.now()
    if (!z.isOwner && wait > 0) return z.reply(`⏳ Subiri sekunde ${Math.ceil(wait / 1000)} kisha ujaribu tena.`)
    if (running >= MAX_PARALLEL) return z.reply('⏳ Kuna maombi mengine yanaendelea. Jaribu tena baada ya muda mfupi.')

    running++
    last.set(key, Date.now())
    await z.react('🌐').catch(() => {})
    try {
      await z.reply('⏳ *Inahifadhi tovuti…*')
      const r = await cloneSite(q)
      let host = 'site'
      try { host = new URL(r.finalUrl).hostname.replace(/^www\./, '') } catch {}
      const kb = Math.round(r.zip.length / 1024)
      const lines = [
        `🌐 *${r.title || host}*`,
        `🔗 ${r.finalUrl}`,
        `📦 ${r.files} faili • ${kb} KB` + (r.failed ? ` • ${r.failed} zimeshindwa` : '') + (r.skipped ? ` • ${r.skipped} zimerukwa (kikomo)` : '')
      ]
      if (r.spa) lines.push('⚠️ Ukurasa huu unajengwa na JavaScript, nakala inaweza kuonekana tupu.')
      await z.sock.sendMessage(
        z.jid,
        { document: r.zip, mimetype: 'application/zip', fileName: `${host}.zip`, caption: lines.join('\n') },
        { quoted: z.msg }
      )
      await z.react('✅').catch(() => {})
    } catch (e) {
      console.error('[clone]', e)
      await z.reply(`❌ *Clone failed*\n${String(e.message).slice(0, 300)}`)
      await z.react('❌').catch(() => {})
    } finally {
      running--
    }
  }
}
