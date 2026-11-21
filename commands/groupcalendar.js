// ⟦EXPERT⟧ .groupcalendar [month 1-12] — events + birthdays for the month
import { expertGet } from '../lib/expert.store.js'
import { expertNumber } from '../lib/expert.utils.js'
import { expertTz, expertDay } from '../lib/expert.activity.js'
import { expertBox } from '../lib/expert.frame.js'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default {
  name: 'groupcalendar',
  aliases: ['gcal'],
  desc: 'Events and birthdays this month. Usage: .groupcalendar [month 1-12]',
  async run(z) {
    if (!z.isGroup) return z.reply('👥 Groups only.')
    const ns = z.session.number
    const tz = expertTz(ns, z.jid)
    const [Y, curM] = expertDay(Date.now(), tz).split('-').map(Number)
    const mo = parseInt(z.args[0]) || curM
    if (mo < 1 || mo > 12) return z.reply('Usage: .groupcalendar [month 1-12]')
    const year = mo < curM ? Y + 1 : Y
    const items = []
    for (const e of expertGet(ns, `events:${z.jid}`, [])) {
      const [ey, em, ed] = expertDay(e.ts, tz).split('-').map(Number)
      if (em === mo && ey === year) items.push({ d: ed, text: `📅 ${e.title}` })
    }
    const mentions = []
    for (const b of Object.values(expertGet(ns, `bday:${z.jid}`, {}))) {
      if (b.m === mo) { items.push({ d: b.d, text: `🎂 @${expertNumber(b.jid)}` }); mentions.push(b.jid) }
    }
    if (!items.length) return z.reply(`🗓️ Nothing planned for ${MONTHS[mo - 1]}.`)
    items.sort((a, b) => a.d - b.d)
    await z.sock.sendMessage(z.jid, { text: expertBox('🗓️', `${MONTHS[mo - 1].toUpperCase()} ${year}`, items.map((i) => `${String(i.d).padStart(2, '0')} — ${i.text}`)), mentions }, { quoted: z.msg })
  }
}
