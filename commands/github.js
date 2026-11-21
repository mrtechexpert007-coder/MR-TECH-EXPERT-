import { expertHttp } from '../lib/expert.admin.js'

export default {
  name: 'github',
  aliases: ['gh'],
  desc: 'GitHub profile. Usage: .github username',
  async run(z) {
    const u = z.args[0]
    if (!/^[a-z\d-]{1,39}$/i.test(u || '')) return z.reply('Usage: .github torvalds')
    try {
      const d = await (await expertHttp(`https://api.github.com/users/${u}`, { headers: { 'User-Agent': 'nexus-md' } })).json()
      const text = `🐙 *${d.name || d.login}* (@${d.login})\n\n${d.bio ? `${d.bio}\n\n` : ''}📦 Repos: ${d.public_repos}\n👥 Followers: ${d.followers} · Following: ${d.following}\n📍 ${d.location || '—'}\n🔗 ${d.html_url}`
      await z.sock.sendMessage(z.jid, { image: { url: d.avatar_url }, caption: text }, { quoted: z.msg })
    } catch { await z.reply('❌ User not found.') }
  }
}
