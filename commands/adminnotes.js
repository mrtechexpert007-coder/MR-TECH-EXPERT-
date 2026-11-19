// ⟦EXPERT⟧ .adminnotes add <text> | list | del <n> — notes only admins can use
import { expertGet, expertSet } from '../lib/expert.store.js'
import { expertGuard } from '../lib/expert.admin.js'
import { expertNumber } from '../lib/expert.utils.js'
import { expertFmt, expertTz } from '../lib/expert.activity.js'
import { expertBox } from '../lib/expert.frame.js'

export default {
  name: 'adminnotes',
  aliases: ['anotes'],
  desc: 'Private admin notes. Usage: .adminnotes add <text> | list | del <n>',
  async run(z) {
    const g = await expertGuard(z)
    if (!g) return
    const ns = z.session.number
    const key = `anotes:${z.jid}`
    const list = expertGet(ns, key, [])
    const sub = (z.args[0] || 'list').toLowerCase()
    if (sub === 'add') {
      const text = z.args.slice(1).join(' ').trim()
      if (!text) return z.reply('Usage: .adminnotes add <text>')
      if (list.length >= 50) return z.reply('❌ Max 50 notes.')
      list.push({ text, by: expertNumber(z.sender), at: Date.now() })
      expertSet(ns, key, list)
      return z.reply(`📝 Note #${list.length} saved.`)
    }
    if (sub === 'del') {
      const n = parseInt(z.args[1])
      if (!n || n < 1 || n > list.length) return z.reply('Usage: .adminnotes del <number>')
      list.splice(n - 1, 1)
      expertSet(ns, key, list)
      return z.reply('🗑️ Note removed.')
    }
    if (!list.length) return z.reply('📝 No admin notes yet. Use .adminnotes add <text>')
    const tz = expertTz(ns, z.jid)
    await z.reply(expertBox('🛡️', 'ADMIN NOTES', list.map((n, i) => `${i + 1}. ${n.text}\n   _${expertFmt(n.at, tz)}_`)))
  }
}
