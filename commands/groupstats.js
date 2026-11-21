// ⟦EXPERT⟧ .groupstats — members, admins and message counts
import { expertActivity, expertEntryFor, expertCount, expertTz, expertIsAdm, expertIsBot, expertTag, expertMention } from '../lib/expert.activity.js'
import { expertBox } from '../lib/expert.frame.js'

export default {
  name: 'groupstats',
  aliases: ['gstats'],
  desc: 'Group statistics',
  async run(z) {
    if (!z.isGroup) return z.reply('👥 Groups only.')
    const meta = await z.sock.groupMetadata(z.jid)
    const a = expertActivity(z.session.number, z.jid)
    const tz = expertTz(z.session.number, z.jid)
    const users = Object.values(a.users)
    const sum = (d) => users.reduce((n, u) => n + expertCount(u, d, tz), 0)
    const members = meta.participants.filter((p) => !expertIsBot(z, p))
    const active7 = members.filter((p) => expertCount(expertEntryFor(a, p), 7, tz) > 0).length
    const top = members.map((p) => ({ p, n: expertCount(expertEntryFor(a, p), 7, tz) })).sort((x, y) => y.n - x.n)[0]
    const lines = [
      `👥 Members: *${meta.participants.length}*  🛡️ Admins: *${meta.participants.filter(expertIsAdm).length}*`,
      `💬 Today: *${sum(1)}*  ·  7 days: *${sum(7)}*  ·  total: *${sum(Infinity)}*`,
      `🔥 Active (7d): *${active7}*  ·  😴 Quiet: *${members.length - active7}*`
    ]
    if (top?.n) lines.push(`🏆 Top this week: ${expertTag(top.p)} (${top.n})`)
    lines.push(`_tracking since ${new Date(a.since).toLocaleDateString('en-GB')}_`)
    await z.sock.sendMessage(z.jid, { text: expertBox('📊', 'GROUP STATS', [`*${meta.subject}*`, ...lines]), mentions: top?.n ? [expertMention(top.p)] : [] }, { quoted: z.msg })
  }
}
