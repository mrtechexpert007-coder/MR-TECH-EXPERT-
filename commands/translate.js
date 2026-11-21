// ⟦EXPERT⟧ .tr <lang> <text>  or reply to a message with .tr <lang>
import { expertHttp, expertQuoted } from '../lib/expert.admin.js'

export default {
  name: 'translate',
  aliases: ['tr', 'trt'],
  desc: 'Translate text. Usage: .tr fr Good morning',
  async run(z) {
    const lang = (z.args[0] || '').toLowerCase()
    if (!/^[a-z]{2,3}(-[a-z]{2,4})?$/i.test(lang)) return z.reply('Usage: .tr <lang code> <text>\nExample: .tr fr Good morning\nOr reply to a message: .tr yo')
    const q = expertQuoted(z)
    const text = z.args.slice(1).join(' ') || q?.conversation || q?.extendedTextMessage?.text || q?.imageMessage?.caption || ''
    if (!text) return z.reply('Give me some text, or reply to a message.')
    try {
      const d = await (await expertHttp(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${lang}&dt=t&q=${encodeURIComponent(text)}`)).json()
      await z.reply(`🌐 *${(d[2] || 'auto').toUpperCase()} → ${lang.toUpperCase()}*\n\n${d[0].map((s) => s[0]).join('')}`)
    } catch { await z.reply('❌ Translation failed.') }
  }
}
