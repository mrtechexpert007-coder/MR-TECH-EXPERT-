import { expertHttp } from '../lib/expert.admin.js'

export default {
  name: 'quote',
  desc: 'Random inspirational quote',
  async run(z) {
    try {
      const [d] = await (await expertHttp('https://zenquotes.io/api/random')).json()
      await z.reply(`💬 _${d.q}_\n\n— *${d.a}*`)
    } catch { await z.reply('❌ No quote right now.') }
  }
}
