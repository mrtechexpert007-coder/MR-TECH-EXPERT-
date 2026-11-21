// ⟦EXPERT⟧ .vowel <text>  or reply to a message with .vowel — counts vowels and shows the text without them
import { expertQuoted } from '../lib/expert.admin.js'

export default {
  name: 'vowel',
  aliases: ['vowels', 'irabu'],
  desc: 'Count vowels in text. Usage: .vowel hello world',
  async run(z) {
    const q = expertQuoted(z)
    const text = (z.args || []).join(' ') ||
      q?.conversation || q?.extendedTextMessage?.text || q?.imageMessage?.caption || q?.videoMessage?.caption || ''
    if (!text.trim()) return z.reply(`Usage: *${z.prefix || '.'}vowel <text>*\nOr reply to a message with *${z.prefix || '.'}vowel*`)

    const counts = { a: 0, e: 0, i: 0, o: 0, u: 0 }
    let letters = 0
    for (const ch of text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()) {
      if (/[a-z]/.test(ch)) letters++
      if (ch in counts) counts[ch]++
    }
    const vowels = Object.values(counts).reduce((a, b) => a + b, 0)
    const without = text.replace(/[aeiou]/gi, '')
    await z.reply(
      `🔤 *VOWELS*\n\n` +
      Object.entries(counts).map(([k, v]) => `*${k.toUpperCase()}* ➜ ${v}`).join('   ') + '\n\n' +
      `✅ Vowels: *${vowels}*\n🔡 Consonants: *${letters - vowels}*\n📝 Letters: *${letters}*\n\n` +
      `🚫 Without vowels:\n${without}`
    )
  }
}
