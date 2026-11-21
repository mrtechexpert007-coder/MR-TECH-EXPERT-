// ⟦EXPERT⟧ .membertag admins|members|active|inactive [message]
import { expertGuard } from '../lib/expert.admin.js'
import { expertActivity, expertEntryFor, expertCount, expertTz, expertIsAdm, expertIsBot, expertMention, expertTag } from '../lib/expert.activity.js'
import { expertBox } from '../lib/expert.frame.js'

export default {
  name: 'membertag',
  desc: 'Tag a group of members. Usage: .membertag admins|members|active|inactive [message]',
  async run(z) {
    const g = await expertGuard(z)
    if (!g) return
    const kind = (z.args[0] || '').toLowerCase()
    if (!['admins', 'members', 'active', 'inactive'].includes(kind)) return z.reply('Usage: .membertag admins|members|active|inactive [message]')
    const msg = z.args.slice(1).join(' ')
    const a = expertActivity(z.session.number, z.jid)
    const tz = expertTz(z.session.number, z.jid)
    const pool = g.meta.participants.filter((p) => !expertIsBot(z, p))
    const pick = {
      admins: (p) => expertIsAdm(p),
      members: (p) => !expertIsAdm(p),
      active: (p) => expertCount(expertEntryFor(a, p), 7, tz) > 0,
      inactive: (p) => expertCount(expertEntryFor(a, p), 7, tz) === 0
    }[kind]
    const list = pool.filter(pick)
    if (!list.length) return z.reply('Nobody matches that group.')
    await z.sock.sendMessage(z.jid, {
      text: expertBox('🏷️', `TAG · ${kind.toUpperCase()}`, [...(msg ? [msg, ''] : []), ...list.map(expertTag)]),
      mentions: list.map(expertMention)
    }, { quoted: z.msg })
  }
}
