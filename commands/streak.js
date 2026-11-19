// ⟦EXPERT⟧ .streak [@user] — consecutive days active in this group
import { expertActivity, expertEntryFor, expertTz, expertDay, expertDayShift, expertPIds, expertMention, expertTag } from '../lib/expert.activity.js'
import { expertTargets } from '../lib/expert.admin.js'
import { expertNumber } from '../lib/expert.utils.js'
import { expertBox } from '../lib/expert.frame.js'

export default {
  name: 'streak',
  aliases: ['streaks'],
  desc: 'Your daily chat streak. Usage: .streak [@user]',
  async run(z) {
    if (!z.isGroup) return z.reply('👥 Groups only.')
    const meta = await z.sock.groupMetadata(z.jid)
    const num = expertNumber(expertTargets(z)[0] || z.sender)
    const p = meta.participants.find((x) => expertPIds(x).includes(num))
    if (!p) return z.reply('⚠️ That person is not in this group.')
    const u = expertEntryFor(expertActivity(z.session.number, z.jid), p)
    const days = new Set(Object.keys(u?.days || {}))
    const tz = expertTz(z.session.number, z.jid)
    const today = expertDay(Date.now(), tz)
    let cur = 0
    let d = days.has(today) ? today : expertDayShift(today, -1)
    while (days.has(d)) { cur++; d = expertDayShift(d, -1) }
    let best = 0, run = 0, prev = null
    for (const day of [...days].sort()) {
      run = prev && expertDayShift(prev, 1) === day ? run + 1 : 1
      best = Math.max(best, run)
      prev = day
    }
    await z.sock.sendMessage(z.jid, {
      text: expertBox('🔥', 'CHAT STREAK', [expertTag(p), `🔥 Current: *${cur}* day${cur === 1 ? '' : 's'}`, `🏅 Best (last 60d): *${best}*`, cur ? '_Keep it going — chat today!_' : '_Chat today to start a streak!_']),
      mentions: [expertMention(p)]
    }, { quoted: z.msg })
  }
}
