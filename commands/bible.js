// ⟦EXPERT⟧ .bible <book chapter:verse> [translation]  — verse lookup (bible-api.com, public-domain texts)
// Examples: .bible john 3:16   ·   .bible psalms 23:1-4 web   ·   .bible   (random verse)
import { expertHttp } from '../lib/expert.admin.js'

const RANDOM = [
  'John 3:16', 'Psalms 23:1-4', 'Philippians 4:13', 'Proverbs 3:5-6', 'Isaiah 41:10', 'Romans 8:28',
  'Jeremiah 29:11', 'Joshua 1:9', 'Matthew 11:28', 'Psalms 46:1', 'Romans 12:2', '2 Timothy 1:7',
  'Matthew 6:33', '1 Corinthians 13:4-7', 'Psalms 121:1-2', 'Isaiah 40:31', 'Galatians 5:22-23'
]
const LIMIT = 3500

export default {
  name: 'bible',
  aliases: ['verse', 'biblia'],
  desc: 'Bible verse. Usage: .bible john 3:16 [kjv|web|bbe]',
  async run(z) {
    const args = [...(z.args || [])]
    let translation = 'kjv'
    // last word made of letters only (e.g. "kjv") = translation; references end with a number
    if (args.length > 1 && /^[a-z][a-z-]{1,15}$/i.test(args[args.length - 1])) translation = args.pop().toLowerCase()
    const ref = args.join(' ').trim() || RANDOM[Math.floor(Math.random() * RANDOM.length)]

    try {
      const url = `https://bible-api.com/${encodeURI(ref.replace(/\s+/g, '+'))}?translation=${encodeURIComponent(translation)}`
      const d = await (await expertHttp(url)).json()
      let text = String(d?.text || '').trim()
      if (!text) throw new Error('empty')
      if (text.length > LIMIT) text = text.slice(0, LIMIT).trimEnd() + '…'
      await z.reply(`📖 *${d.reference || ref}*\n_${d.translation_name || translation.toUpperCase()}_\n\n${text}`)
    } catch (e) {
      if (/429/.test(e.message)) return z.reply('⏳ Too many requests right now. Try again in a few seconds.')
      await z.reply(
        '❌ Verse not found.\n\n' +
        `Usage: *${z.prefix || '.'}bible john 3:16*\n` +
        `With translation: *${z.prefix || '.'}bible psalms 23 web*\n` +
        '_One chapter at most per request._'
      )
    }
  }
}
