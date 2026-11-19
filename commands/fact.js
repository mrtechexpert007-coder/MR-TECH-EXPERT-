import { expertHttp } from '../lib/expert.admin.js'

export default {
  name: 'fact',
  desc: 'Random fun fact',
  async run(z) {
    try { await z.reply(`🧠 ${(await (await expertHttp('https://uselessfacts.jsph.pl/api/v2/facts/random?language=en')).json()).text}`) }
    catch { await z.reply('❌ No fact right now.') }
  }
}
