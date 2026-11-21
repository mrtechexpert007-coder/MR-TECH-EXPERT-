import { expertPick } from '../lib/expert.utils.js'
const A = ['Yes, definitely.', 'It is certain.', 'Most likely.', 'Ask again later.', 'Cannot predict now.', "Don't count on it.", 'My sources say no.', 'Very doubtful.', 'Signs point to yes.', 'Absolutely not.']
export default {
  name: '8ball',
  aliases: ['ball'],
  desc: 'Ask the magic 8-ball',
  async run(z) {
    if (!z.text.trim()) return z.reply('Usage: .8ball Will I win today?')
    await z.reply(`🎱 ${expertPick(A)}`)
  }
}
