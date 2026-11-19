import { expertHttp } from '../lib/expert.admin.js'

export default {
  name: 'shorten',
  aliases: ['short', 'tinyurl'],
  desc: 'Shorten a link. Usage: .shorten https://...',
  async run(z) {
    const url = z.args[0]
    if (!/^https?:\/\//i.test(url || '')) return z.reply('Usage: .shorten https://example.com/long/link')
    try { await z.reply(`🔗 ${(await (await expertHttp(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`)).text()).trim()}`) }
    catch { await z.reply('❌ Could not shorten that link.') }
  }
}
