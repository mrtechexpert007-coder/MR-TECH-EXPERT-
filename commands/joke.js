import { expertHttp } from '../lib/expert.admin.js'

export default {
  name: 'joke',
  desc: 'Random clean joke',
  async run(z) {
    try {
      const d = await (await expertHttp('https://v2.jokeapi.dev/joke/Any?safe-mode')).json()
      await z.reply(`😂 ${d.type === 'single' ? d.joke : `${d.setup}\n\n${d.delivery}`}`)
    } catch { await z.reply('❌ No joke right now.') }
  }
}
