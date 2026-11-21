// ⟦EXPERT⟧ .birthday set DD/MM | remove | today | month | list
import { expertGet, expertSet } from '../lib/expert.store.js'
import { expertGroup, expertTargets } from '../lib/expert.admin.js'
import { expertNumber } from '../lib/expert.utils.js'
import { expertTz, expertDay } from '../lib/expert.activity.js'
import { expertBox } from '../lib/expert.frame.js'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const tag = (b) => `@${expertNumber(b.jid)}`

function parseDM(s = '') {
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})$/)
  if (!m) return null
  const d = +m[1], mo = +m[2]
  if (mo < 1 || mo > 12 || d < 1 || d > new Date(Date.UTC(2024, mo, 0)).getUTCDate()) return null
  return { d, m: mo }
}

export default {
  name: 'birthday',
  aliases: ['bday', 'birthdayboard'],
  desc: 'Group birthdays. Usage: .birthday set 14/02 | remove | today | month | list',
  async run(z) {
    if (!z.isGroup) return z.reply('👥 Groups only.')
    const ns = z.session.number
    const key = `bday:${z.jid}`
    const data = expertGet(ns, key, {})
    const sub = (z.args[0] || 'list').toLowerCase()
    const tz = expertTz(ns, z.jid)
    const [Y, M, D] = expertDay(Date.now(), tz).split('-').map(Number)
    const todayUTC = Date.UTC(Y, M - 1, D)
    const until = (b) => {
      let t = Date.UTC(Y, b.m - 1, b.d)
      if (t < todayUTC) t = Date.UTC(Y + 1, b.m - 1, b.d)
      return Math.round((t - todayUTC) / 86400000)
    }
    const show = (title, rows) => z.sock.sendMessage(z.jid, { text: expertBox('🎂', title, rows), mentions: rows.length ? Object.values(data).map((b) => b.jid) : [] }, { quoted: z.msg })

    if (sub === 'set' || sub === 'remove') {
      const target = expertTargets(z)[0]
      let who = z.sender
      if (target && expertNumber(target) !== expertNumber(z.sender)) {
        const g = await expertGroup(z)
        if (!g.senderAdmin) return z.reply('⛔ Only admins can set or remove someone else\'s birthday.')
        who = target
      }
      const id = expertNumber(who)
      if (sub === 'remove') {
        if (!data[id]) return z.reply('🤷 No birthday saved for that person.')
        delete data[id]
        expertSet(ns, key, data)
        return z.reply('🗑️ Birthday removed.')
      }
      const dm = parseDM(z.args.find((a) => /^\d/.test(a)))
      if (!dm) return z.reply('Usage: .birthday set 14/02  (day/month)')
      data[id] = { jid: who, ...dm }
      expertSet(ns, key, data)
      return z.sock.sendMessage(z.jid, { text: `🎂 Saved: @${id} — *${dm.d} ${MONTHS[dm.m - 1]}*`, mentions: [who] }, { quoted: z.msg })
    }

    const all = Object.values(data)
    if (!all.length) return z.reply('🎂 No birthdays saved. Members can use .birthday set 14/02')
    if (sub === 'today') {
      const rows = all.filter((b) => b.d === D && b.m === M).map((b) => `🎉 ${tag(b)} — happy birthday!`)
      return rows.length ? show('BIRTHDAY TODAY', rows) : z.reply('🎂 No birthdays today.')
    }
    if (sub === 'month') {
      const rows = all.filter((b) => b.m === M).sort((a, b) => a.d - b.d).map((b) => `${String(b.d).padStart(2, '0')} ${MONTHS[b.m - 1]} — ${tag(b)}`)
      return rows.length ? show(`${MONTHS[M - 1].toUpperCase()} BIRTHDAYS`, rows) : z.reply('🎂 No birthdays this month.')
    }
    const rows = all.map((b) => ({ b, n: until(b) })).sort((x, y) => x.n - y.n).slice(0, 8)
      .map(({ b, n }) => `${tag(b)} — ${b.d} ${MONTHS[b.m - 1]} ${n === 0 ? '(today! 🎉)' : `(in ${n}d)`}`)
    show('UPCOMING BIRTHDAYS', rows)
  }
}
