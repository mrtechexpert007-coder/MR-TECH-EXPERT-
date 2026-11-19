// ⟦EXPERT⟧ .event add DD/MM/YYYY HH:MM | Title | details · .eventlist · .eventremove <n>
import { expertGet, expertSet } from '../lib/expert.store.js'
import { expertGroup } from '../lib/expert.admin.js'
import { expertNumber } from '../lib/expert.utils.js'
import { expertTz, expertZoned, expertFmt, expertDur } from '../lib/expert.activity.js'
import { expertBox } from '../lib/expert.frame.js'

export default {
  name: 'event',
  aliases: ['eventlist', 'eventremove'],
  desc: 'Group events. Usage: .event add 25/12/2026 18:00 | Title | details · .eventlist · .eventremove <n>',
  async run(z) {
    if (!z.isGroup) return z.reply('👥 Groups only.')
    const ns = z.session.number
    const key = `events:${z.jid}`
    const tz = expertTz(ns, z.jid)
    let list = expertGet(ns, key, []).filter((e) => e.ts > Date.now() - 12 * 3600000).sort((a, b) => a.ts - b.ts)

    let sub = (z.args[0] || '').toLowerCase()
    if (z.command === 'eventlist') sub = 'list'
    if (z.command === 'eventremove') sub = 'remove'
    const argsAfter = z.command === 'event' ? z.args.slice(1) : z.args

    if (sub === 'add' || sub === 'remove' || sub === 'del') {
      const g = await expertGroup(z)
      if (!g.senderAdmin) return z.reply('⛔ Group admins only.')
      if (sub === 'add') {
        const [when, title, ...details] = argsAfter.join(' ').split('|').map((s) => s.trim())
        const m = (when || '').match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s+(\d{1,2}):(\d{2})$/)
        if (!m || !title) return z.reply(`Usage: .event add 25/12/2026 18:00 | Title | details\n_Times use the group timezone (${tz}). Change it with .timezonegroup_`)
        const ts = expertZoned(+m[3], +m[2], +m[1], +m[4], +m[5], tz)
        if (ts < Date.now()) return z.reply('⏳ That date is in the past.')
        if (list.length >= 30) return z.reply('❌ Max 30 upcoming events.')
        list.push({ ts, title, details: details.join(' | '), by: expertNumber(z.sender) })
        list.sort((a, b) => a.ts - b.ts)
        expertSet(ns, key, list)
        return z.reply(`📅 Event added: *${title}*\n🕒 ${expertFmt(ts, tz)} (${tz})`)
      }
      const n = parseInt(argsAfter[0])
      if (!n || n < 1 || n > list.length) return z.reply('Usage: .eventremove <number> (see .eventlist)')
      const [gone] = list.splice(n - 1, 1)
      expertSet(ns, key, list)
      return z.reply(`🗑️ Removed: ${gone.title}`)
    }

    if (!list.length) return z.reply('📅 No upcoming events. Admins can use .event add 25/12/2026 18:00 | Title | details')
    await z.reply(expertBox('📅', 'UPCOMING EVENTS', list.map((e, i) =>
      `${i + 1}. *${e.title}*\n   🕒 ${expertFmt(e.ts, tz)} — ${e.ts > Date.now() ? `in ${expertDur(e.ts - Date.now())}` : 'happening now'}${e.details ? `\n   📝 ${e.details}` : ''}`
    )))
  }
}
