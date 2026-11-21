// ⟦EXPERT⟧ .topchatters [today|week|month|all]
import { expertActivity, expertEntryFor, expertCount, expertTz, expertMention, expertTag, expertIsBot, EXPERT_PERIODS } from '../lib/expert.activity.js'
import { expertBox } from '../lib/expert.frame.js'

export default {
  name: 'topchatters',
  aliases: ['top', 'chatters'],
  desc: 'Most active members. Usage: .topchatters [today|week|month|all]',
  async run(z) {
    if (!z.isGroup) return z.reply('👥 Groups only.')
    const key = (z.args[0] || 'week').toLowerCase()
    const days = EXPERT_PERIODS[key]
    if (!days) return z.reply('Usage: .topchatters [today|week|month|all]')
    const meta = await z.sock.groupMetadata(z.jid)
    const a = expertActivity(z.session.number, z.jid)
    const tz = expertTz(z.session.number, z.jid)
    const rows = meta.participants
      .filter((p) => !expertIsBot(z, p))
      .map((p) => ({ p, n: expertCount(expertEntryFor(a, p), days, tz) }))
      .filter((r) => r.n > 0)
      .sort((x, y) => y.n - x.n)
      .slice(0, 10)
    if (!rows.length) return z.reply('📊 No activity tracked yet. Stats build up as members chat.')
    const medals = ['🥇', '🥈', '🥉']
    const lines = rows.map((r, i) => `${medals[i] || `${i + 1}.`} ${expertTag(r.p)} — *${r.n}* msgs`)
    await z.sock.sendMessage(z.jid, {
      text: expertBox('🏆', `TOP CHATTERS · ${key.toUpperCase()}`, [...lines, '', `_tracking since ${new Date(a.since).toLocaleDateString('en-GB')}_`]),
      mentions: rows.map((r) => expertMention(r.p))
    }, { quoted: z.msg })
  }
}
