// ⟦EXPERT⟧ .grouprecap — today in this group
import { expertActivity, expertEntryFor, expertCount, expertTz, expertDay, expertIsBot, expertMention, expertTag } from '../lib/expert.activity.js'
import { expertGet } from '../lib/expert.store.js'
import { expertBox } from '../lib/expert.frame.js'

export default {
  name: 'grouprecap',
  aliases: ['recap'],
  desc: "Today's recap: messages, top chatters, birthdays and events",
  async run(z) {
    if (!z.isGroup) return z.reply('👥 Groups only.')
    const ns = z.session.number
    const tz = expertTz(ns, z.jid)
    const meta = await z.sock.groupMetadata(z.jid)
    const a = expertActivity(ns, z.jid)
    const rows = meta.participants.filter((p) => !expertIsBot(z, p))
      .map((p) => ({ p, n: expertCount(expertEntryFor(a, p), 1, tz) })).filter((r) => r.n > 0).sort((x, y) => y.n - x.n)
    const total = rows.reduce((n, r) => n + r.n, 0)
    const top3 = rows.slice(0, 3)
    const today = expertDay(Date.now(), tz)
    const [, mm, dd] = today.split('-').map(Number)
    const bdays = Object.values(expertGet(ns, `bday:${z.jid}`, {})).filter((b) => b.d === dd && b.m === mm)
    const events = expertGet(ns, `events:${z.jid}`, []).filter((e) => expertDay(e.ts, tz) === today)
    const medals = ['🥇', '🥈', '🥉']
    const lines = [`💬 *${total}* messages from *${rows.length}* people today`]
    if (top3.length) lines.push('', ...top3.map((r, i) => `${medals[i]} ${expertTag(r.p)} — ${r.n}`))
    if (bdays.length) lines.push('', `🎂 Birthday today: ${bdays.map((b) => `@${b.jid.split('@')[0].split(':')[0]}`).join(', ')}`)
    if (events.length) lines.push('', ...events.map((e) => `📅 Today: ${e.title}`))
    await z.sock.sendMessage(z.jid, {
      text: expertBox('🗞️', 'TODAY IN THE GROUP', lines),
      mentions: [...top3.map((r) => expertMention(r.p)), ...bdays.map((b) => b.jid)]
    }, { quoted: z.msg })
  }
}
