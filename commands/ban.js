// ⟦EXPERT⟧ .ban @user | .ban list — stop someone from using this account's bot
import { expertGet, expertSet } from '../lib/expert.store.js'
import { expertTargets } from '../lib/expert.admin.js'
import { expertNumber } from '../lib/expert.utils.js'
import { expertCfg } from '../config/expert.config.js'

export default {
  name: 'ban',
  owner: true,
  desc: 'Block a user from using the bot (tag, reply, or number)',
  async run(z) {
    const ns = z.session.number
    const list = expertGet(ns, 'banned', [])
    if ((z.args[0] || '').toLowerCase() === 'list') return z.reply(list.length ? `🚫 *Banned*\n${list.map((n) => `• +${n}`).join('\n')}` : 'Nobody is banned.')
    const raw = z.args[0]?.replace(/\D/g, '')
    const num = expertTargets(z)[0] ? expertNumber(expertTargets(z)[0]) : (raw?.length > 6 ? raw : (!z.isGroup ? expertNumber(z.jid) : ''))
    if (!num) return z.reply('Usage: .ban @user  (or reply, or .ban 2548012345678)\n.ban list')
    if ([ns, expertCfg.owner].includes(num)) return z.reply('😅 I will not ban the owner.')
    if (!list.includes(num)) expertSet(ns, 'banned', [...list, num])
    await z.reply(`🚫 +${num} can no longer use the bot.`)
  }
}
