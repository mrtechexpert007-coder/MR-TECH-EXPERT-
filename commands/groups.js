import { expertNumber } from '../lib/expert.utils.js'

export default {
  name: 'groups',
  aliases: ['mygroups'],
  owner: true,
  desc: 'List groups this account is in',
  async run(z) {
    const all = Object.values(await z.sock.groupFetchAllParticipating())
    if (!all.length) return z.reply('Not in any groups.')
    await z.reply(`👥 *Groups (${all.length})*\n\n${all.map((g, i) => `${i + 1}. ${g.subject} — ${g.participants.length} members`).join('\n')}`.slice(0, 4000))
  }
}
