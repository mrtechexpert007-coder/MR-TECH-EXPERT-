import { expertHttp } from '../lib/expert.admin.js'

export default {
  name: 'define',
  aliases: ['dict', 'meaning'],
  desc: 'Dictionary lookup. Usage: .define serendipity',
  async run(z) {
    const w = z.args[0]
    if (!w) return z.reply('Usage: .define <word>')
    try {
      const [e] = await (await expertHttp(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(w)}`)).json()
      const body = e.meanings.slice(0, 3).map((m) => `_${m.partOfSpeech}_\n${m.definitions.slice(0, 2).map((d, i) => `${i + 1}. ${d.definition}`).join('\n')}`).join('\n\n')
      await z.reply(`📖 *${e.word}* ${e.phonetic || ''}\n\n${body}`)
    } catch { await z.reply('❌ Word not found.') }
  }
}
