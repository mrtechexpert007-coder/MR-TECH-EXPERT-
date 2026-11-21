// ⟦EXPERT⟧ .vote <channel post link> <option a/b/c or 1/2/3> [#server]
// Example: .vote https://whatsapp.com/channel/xxxx/101 a #5   → option 1, server 5 only
//          .vote https://whatsapp.com/channel/xxxx/101 b      → option 2, all servers
import { expertVote, expertParseOption } from '../lib/expert.vote.js'
import { EXPERT_SERVERS } from '../lib/expert.servers.js'

export default {
  name: 'vote',
  aliases: ['chvote', 'votech'],
  owner: true,
  desc: 'Vote on a channel poll with linked accounts (all servers or a specific one)',
  async run(expert) {
    const raw = expert.args.join(' ')
    const m = raw.match(/channel\/([\w-]+)\/(\d+)/i)
    const rest = raw.replace(/\S*channel\/[\w-]+\/\d+\S*/i, '').trim()
    const srv = rest.match(/#(\d{1,2})/)
    const option = expertParseOption(rest.replace(/#\d+/, '').trim().split(/\s+/)[0])

    if (!m || !option) {
      return expert.reply(`Usage: ${expert.prefix}vote <channel post link> <a|b|c or 1|2|3> [#server]\n\nEx: ${expert.prefix}vote https://whatsapp.com/channel/XXXX/101 a #5`)
    }
    const server = srv ? Number(srv[1]) : 0
    if (server && (server < 1 || server > EXPERT_SERVERS.length)) {
      return expert.reply(`❌ Server #${server} doesn't exist (1-${EXPERT_SERVERS.length}).`)
    }
    const [, code, postId] = m

    await expert.reply('⚡ Sending votes…')
    let rows
    try { rows = await expertVote(code, postId, option, server) }
    catch (e) { return expert.reply(`❌ ${String(e?.message || e).slice(0, 120)}`) }

    const queued = rows.reduce((a, r) => a + r.queued, 0)
    const reached = rows.filter((r) => !r.error).length
    const errs = rows.filter((r) => r.error)
    if (!queued) {
      return expert.reply(`❌ No accounts available to vote.${errs.length ? `\n${errs.map((r) => `• #${r.server}: ${r.error}`).join('\n')}` : ''}`)
    }
    const lines = [
      '❖ ── ✦ *VOTE SENT SUCCESSFULLY* ✦ ── ❖',
      '',
      '╔═════「 ⚡ *DETAILS* 」═════✧',
      `║ 🎯 *CHANNEL:* ${code}`,
      `║ 📝 *POST:* ${postId}`,
      `║ 🗳️ *OPTION:* ${option}`,
      `║ 🖥️ 🎯 *SPECIFIC SERVERS:* ${server ? '#' + server : `ALL (${reached}/${rows.length} reached)`}`,
      `║ 👥 *ACCOUNTS VOTING:* ${queued}`,
      '╚════════════════════✧',
      '',
      ...rows.map((r) => `${r.error ? '❌' : '✅'} Server ${r.server}: ${r.error ? r.error : r.queued + ' accounts'}`),
      '',
      '_Votes are sent gradually in the background._',
      '💫 _POWERED BY EXPERT MINI BOT_'
    ]
    await expert.reply(lines.join('\n'))
  }
}
