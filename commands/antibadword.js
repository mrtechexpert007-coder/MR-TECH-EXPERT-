// ⟦EXPERT⟧ .antibadword on|off|add <word>|remove <word>|list  — deletes messages with banned words
import { expertGet, expertSet } from '../lib/expert.store.js'
import { expertGuard } from '../lib/expert.admin.js'

export default {
  name: 'antibadword',
  aliases: ['badword'],
  desc: 'Delete messages containing banned words',
  async run(z) {
    if (!(await expertGuard(z))) return
    const ns = z.session.number
    const sub = (z.args[0] || '').toLowerCase()
    const word = z.args.slice(1).join(' ').toLowerCase().trim()
    const list = expertGet(ns, 'badwords', [])

    if (sub === 'on' || sub === 'off') {
      expertSet(ns, 'antibadword', sub === 'on')
      return z.reply(`🛡️ antibadword is now ${sub.toUpperCase()}.${sub === 'on' && !list.length ? '\nAdd words with .antibadword add <word>' : ''}`)
    }
    if (sub === 'add' && word) {
      if (!list.includes(word)) expertSet(ns, 'badwords', [...list, word])
      return z.reply(`✅ Added "${word}". (${new Set([...list, word]).size} words)`)
    }
    if ((sub === 'remove' || sub === 'del') && word) {
      expertSet(ns, 'badwords', list.filter((w) => w !== word))
      return z.reply(`✅ Removed "${word}".`)
    }
    if (sub === 'list') return z.reply(list.length ? `🚫 Banned words:\n${list.map((w) => `• ${w}`).join('\n')}` : 'No banned words yet.')
    await z.reply(`🛡️ antibadword: *${expertGet(ns, 'antibadword', false) ? 'ON' : 'OFF'}* · ${list.length} words\n\nUsage:\n.antibadword on|off\n.antibadword add <word>\n.antibadword remove <word>\n.antibadword list`)
  }
}
