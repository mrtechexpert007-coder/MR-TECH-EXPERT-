// ⟦EXPERT⟧ .inactive [days] — members with no messages for N days (admins only)
import { expertGuard } from '../lib/expert.admin.js'
import { expertActivity, expertEntryFor, expertCount, expertTz, expertIsBot, expertMention, expertTag } from '../lib/expert.activity.js'
import { expertBox } from '../lib/expert.frame.js'

export default {
  name: 'inactive',
  aliases: ['listinactive', 'ghosts'],
  desc: 'List members with no messages in N days (default 7, max 60). Usage: .inactive [days]',
  async run(z) {
    const g = await expertGuard(z)
    if (!g) return
    const days = Math.min(60, Math.max(1, parseInt(z.args[0]) || 7))
    const a = expertActivity(z.session.number, z.jid)
    const tz = expertTz(z.session.number, z.jid)
    const quiet = g.meta.participants.filter((p) => !expertIsBot(z, p) && expertCount(expertEntryFor(a, p), days, tz) === 0)
    const trackedDays = Math.floor((Date.now() - a.since) / 86400000)
    const note = trackedDays < days ? `\n⚠️ I've only tracked ${trackedDays} day${trackedDays === 1 ? '' : 's'} so far, so this may be incomplete.` : ''
    if (!quiet.length) return z.reply(`✅ Everyone chatted in the last ${days} day${days === 1 ? '' : 's'}.${note}`)
    const shown = quiet.slice(0, 50)
    await z.sock.sendMessage(z.jid, {
      text: expertBox('😴', `INACTIVE · ${days}D`, [`*${quiet.length}* silent member${quiet.length === 1 ? '' : 's'}`, ...shown.map((p, i) => `${i + 1}. ${expertTag(p)}`), ...(quiet.length > 50 ? [`…and ${quiet.length - 50} more`] : [])]) + note,
      mentions: shown.map(expertMention)
    }, { quoted: z.msg })
  }
}
