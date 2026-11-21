import { expertGet, expertSet } from '../lib/expert.store.js'
import { expertTargets } from '../lib/expert.admin.js'
import { expertNumber } from '../lib/expert.utils.js'

export default {
  name: 'unban',
  owner: true,
  desc: 'Let a banned user use the bot again',
  async run(z) {
    const raw = z.args[0]?.replace(/\D/g, '')
    const num = expertTargets(z)[0] ? expertNumber(expertTargets(z)[0]) : (raw?.length > 6 ? raw : (!z.isGroup ? expertNumber(z.jid) : ''))
    if (!num) return z.reply('Usage: .unban @user  (or reply, or number)')
    expertSet(z.session.number, 'banned', expertGet(z.session.number, 'banned', []).filter((n) => n !== num))
    await z.reply(`✅ +${num} is unbanned.`)
  }
}
