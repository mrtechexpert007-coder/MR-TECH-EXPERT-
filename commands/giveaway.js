// ⟦EXPERT⟧ .giveaway [winners] [active] [admins] — pick random winners (admins only)
import { expertGuard } from '../lib/expert.admin.js'
import { expertActivity, expertEntryFor, expertCount, expertTz, expertIsAdm, expertIsBot, expertMention, expertTag } from '../lib/expert.activity.js'
import { expertBox } from '../lib/expert.frame.js'

export default {
  name: 'giveaway',
  aliases: ['raffle'],
  desc: 'Random winners. Usage: .giveaway [number] [active] [admins]  (active = chatted in 7d, admins = include admins)',
  async run(z) {
    const g = await expertGuard(z)
    if (!g) return
    const flags = z.args.map((a) => a.toLowerCase())
    const n = Math.min(10, Math.max(1, parseInt(flags.find((a) => /^\d+$/.test(a))) || 1))
    const a = expertActivity(z.session.number, z.jid)
    const tz = expertTz(z.session.number, z.jid)
    let pool = g.meta.participants.filter((p) => !expertIsBot(z, p))
    if (!flags.includes('admins')) pool = pool.filter((p) => !expertIsAdm(p))
    if (flags.includes('active')) pool = pool.filter((p) => expertCount(expertEntryFor(a, p), 7, tz) > 0)
    if (!pool.length) return z.reply('😕 Nobody is eligible for the draw.')
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]] }
    const winners = pool.slice(0, n)
    await z.sock.sendMessage(z.jid, {
      text: expertBox('🎁', 'GIVEAWAY WINNER' + (winners.length > 1 ? 'S' : ''), [`🎉 Congratulations!`, '', ...winners.map((p, i) => `${i + 1}. ${expertTag(p)}`), '', `_drawn from ${pool.length} eligible member${pool.length === 1 ? '' : 's'}_`]),
      mentions: winners.map(expertMention)
    }, { quoted: z.msg })
  }
}
