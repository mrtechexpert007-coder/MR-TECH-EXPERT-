// ⟦EXPERT⟧ .activity [@user] — someone's message counts
import { expertActivity, expertEntryFor, expertCount, expertTz, expertPIds, expertIsBot, expertMention, expertTag, expertDur } from '../lib/expert.activity.js'
import { expertTargets } from '../lib/expert.admin.js'
import { expertNumber } from '../lib/expert.utils.js'
import { expertBox } from '../lib/expert.frame.js'

export default {
  name: 'activity',
  aliases: ['myactivity', 'rank'],
  desc: 'Message stats for you or a tagged member. Usage: .activity [@user]',
  async run(z) {
    if (!z.isGroup) return z.reply('👥 Groups only.')
    const meta = await z.sock.groupMetadata(z.jid)
    const num = expertNumber(expertTargets(z)[0] || z.sender)
    const p = meta.participants.find((x) => expertPIds(x).includes(num))
    if (!p) return z.reply('⚠️ That person is not in this group.')
    const a = expertActivity(z.session.number, z.jid)
    const tz = expertTz(z.session.number, z.jid)
    const u = expertEntryFor(a, p)
    if (!u) return z.sock.sendMessage(z.jid, { text: `📊 No messages tracked for ${expertTag(p)} yet.`, mentions: [expertMention(p)] }, { quoted: z.msg })
    const ranked = meta.participants.filter((x) => !expertIsBot(z, x)).map((x) => expertCount(expertEntryFor(a, x), Infinity, tz)).sort((x, y) => y - x)
    const rank = ranked.indexOf(u.total) + 1
    await z.sock.sendMessage(z.jid, {
      text: expertBox('📈', 'ACTIVITY', [
        expertTag(p),
        `💬 Today *${expertCount(u, 1, tz)}* · Week *${expertCount(u, 7, tz)}* · Month *${expertCount(u, 30, tz)}*`,
        `📦 Total: *${u.total}*  ·  🏅 Rank: *#${rank}* of ${ranked.length}`,
        `🕒 Last message: ${expertDur(Date.now() - u.last)} ago`
      ]),
      mentions: [expertMention(p)]
    }, { quoted: z.msg })
  }
}
