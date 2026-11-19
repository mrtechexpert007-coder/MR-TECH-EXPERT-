// ⟦EXPERT⟧ .groupnotice | .groupnotice set <text> | .groupnotice clear
import { expertGet, expertSet } from '../lib/expert.store.js'
import { expertGroup } from '../lib/expert.admin.js'
import { expertNumber } from '../lib/expert.utils.js'
import { expertFmt, expertTz } from '../lib/expert.activity.js'
import { expertBox } from '../lib/expert.frame.js'

export default {
  name: 'groupnotice',
  aliases: ['notice'],
  desc: 'Show the group notice. Admins: .groupnotice set <text> | clear',
  async run(z) {
    if (!z.isGroup) return z.reply('👥 Groups only.')
    const ns = z.session.number
    const key = `notice:${z.jid}`
    const sub = (z.args[0] || '').toLowerCase()
    if (sub === 'set' || sub === 'clear') {
      const g = await expertGroup(z)
      if (!g.senderAdmin) return z.reply('⛔ Group admins only.')
      if (sub === 'clear') { expertSet(ns, key, null); return z.reply('🗑️ Notice cleared.') }
      const text = z.args.slice(1).join(' ').trim()
      if (!text) return z.reply('Usage: .groupnotice set <text>')
      expertSet(ns, key, { text, by: expertNumber(z.sender), at: Date.now() })
      return z.reply('📌 Notice saved. Everyone can read it with .groupnotice')
    }
    const n = expertGet(ns, key, null)
    if (!n) return z.reply('📌 No notice set. Admins can use .groupnotice set <text>')
    await z.reply(expertBox('📌', 'GROUP NOTICE', [n.text, '', `_set ${expertFmt(n.at, expertTz(ns, z.jid))}_`]))
  }
}
