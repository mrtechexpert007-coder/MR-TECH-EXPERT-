// ⟦EXPERT⟧ .unjail @user | .unjail all — release members from jail
import { expertGuard, expertTargets } from '../lib/expert.admin.js'
import { expertGet, expertSet } from '../lib/expert.store.js'
import { expertNumber } from '../lib/expert.utils.js'
import { expertFont, EXPERT_BRAND } from '../lib/expert.frame.js'

export default {
  name: 'unjail',
  aliases: ['release', 'free'],
  desc: 'Release a jailed member. Usage: .unjail @user | .unjail all',
  async run(z) {
    const g = await expertGuard(z)
    if (!g) return
    const key = `jail:${z.jid}`
    const list = expertGet(z.session.number, key, [])
    if (!list.length) return z.reply('🚔 Nobody is in jail.')

    if (z.args[0]?.toLowerCase() === 'all') {
      expertSet(z.session.number, key, [])
      return z.reply(`🔓 ${expertFont('Jailbreak! Everyone has been released')} (${list.length}).\n\n   ${EXPERT_BRAND}`)
    }

    const targets = expertTargets(z)
    if (!targets.length) return z.reply(`Usage: ${z.prefix}unjail @user  (or reply to them)  |  ${z.prefix}unjail all`)
    const num = expertNumber(targets[0])
    // match by any known id; also try the group roster so LID/phone forms both work
    const p = g.meta.participants.find((x) => [x.id, x.phoneNumber, x.lid].filter(Boolean).map(expertNumber).includes(num))
    const known = new Set([num, ...(p ? [p.id, p.phoneNumber, p.lid].filter(Boolean).map(expertNumber) : [])])
    const entry = list.find((j) => j.ids.some((i) => known.has(i)))
    if (!entry) return z.reply('🤷 That member is not in jail.')

    expertSet(z.session.number, key, list.filter((j) => j !== entry))
    const mention = `${entry.ids.find((i) => i.length < 15) || entry.ids[0]}@s.whatsapp.net`
    await z.sock.sendMessage(z.jid, {
      text:
        `🔓 *${expertFont('RELEASED')}*\n\n` +
        `@${mention.split('@')[0]} ${expertFont('is free to talk again. Behave this time')}! 🕊️\n\n   ${EXPERT_BRAND}`,
      mentions: [mention]
    }, { quoted: z.msg })
  }
}
