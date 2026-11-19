// ⟦EXPERT⟧ .warn @user [reason] — 3 warnings = removed from the group
import { expertGet, expertSet } from '../lib/expert.store.js'
import { expertGuard, expertTargets } from '../lib/expert.admin.js'
import { expertNumber } from '../lib/expert.utils.js'

const LIMIT = 3

export default {
  name: 'warn',
  desc: 'Warn a member (3 warnings = removed)',
  async run(z) {
    const g = await expertGuard(z)
    if (!g) return
    const [target] = expertTargets(z)
    if (!target) return z.reply('Tag or reply to the member to warn.\nUsage: .warn @user [reason]')
    const num = expertNumber(target)
    if (num === z.session.number) return z.reply('😅 I will not warn myself.')
    const reason = z.args.filter((a) => !a.startsWith('@')).join(' ') || 'No reason given'

    const all = expertGet(z.session.number, 'warns', {})
    const grp = (all[z.jid] ??= {})
    grp[num] = (grp[num] || 0) + 1
    expertSet(z.session.number, 'warns', all)

    if (grp[num] >= LIMIT) {
      delete grp[num]
      expertSet(z.session.number, 'warns', all)
      await z.sock.sendMessage(z.jid, { text: `🚫 @${num} reached ${LIMIT}/${LIMIT} warnings.\nReason: ${reason}`, mentions: [target] }, { quoted: z.msg })
      await z.sock.groupParticipantsUpdate(z.jid, [target], 'remove').catch(() => z.reply('🤖 I could not remove them — I probably need to be a group admin.'))
      return
    }
    await z.sock.sendMessage(z.jid, { text: `⚠️ *WARNING* @${num}\nReason: ${reason}\nWarnings: *${grp[num]}/${LIMIT}*`, mentions: [target] }, { quoted: z.msg })
  }
}
