// ⟦EXPERT⟧ .listactive [days] — members who chatted in the last N days
import { expertActivity, expertEntryFor, expertCount, expertTz, expertIsBot, expertMention, expertTag } from '../lib/expert.activity.js'
import { expertBox } from '../lib/expert.frame.js'

export default {
  name: 'listactive',
  desc: 'List members active in the last N days (default 7). Usage: .listactive [days]',
  async run(z) {
    if (!z.isGroup) return z.reply('👥 Groups only.')
    const days = Math.min(60, Math.max(1, parseInt(z.args[0]) || 7))
    const meta = await z.sock.groupMetadata(z.jid)
    const a = expertActivity(z.session.number, z.jid)
    const tz = expertTz(z.session.number, z.jid)
    const rows = meta.participants.filter((p) => !expertIsBot(z, p))
      .map((p) => ({ p, n: expertCount(expertEntryFor(a, p), days, tz) })).filter((r) => r.n > 0).sort((x, y) => y.n - x.n).slice(0, 50)
    if (!rows.length) return z.reply('📊 No activity tracked yet.')
    await z.sock.sendMessage(z.jid, {
      text: expertBox('🔥', `ACTIVE · ${days}D`, rows.map((r, i) => `${i + 1}. ${expertTag(r.p)} — ${r.n}`)),
      mentions: rows.map((r) => expertMention(r.p))
    }, { quoted: z.msg })
  }
}
