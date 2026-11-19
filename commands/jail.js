// ⟦EXPERT⟧ .jail @user [reason] — jailed members can't talk: every message they send is deleted (needs bot admin)
//        .jail (no target) → list who is in jail
import { expertGuard, expertTargets } from '../lib/expert.admin.js'
import { expertGet, expertSet } from '../lib/expert.store.js'
import { expertNumber } from '../lib/expert.utils.js'
import { expertCfg } from '../config/expert.config.js'
import { expertFont, EXPERT_BRAND } from '../lib/expert.frame.js'

const idsOf = (p) => [...new Set([p.id, p.phoneNumber, p.lid].filter(Boolean).map(expertNumber))]

export default {
  name: 'jail',
  aliases: ['lockup', 'jailed'],
  desc: 'Jail a member — their messages get deleted. Usage: .jail @user [reason] | .jail (list)',
  async run(z) {
    const g = await expertGuard(z)
    if (!g) return
    const key = `jail:${z.jid}`
    const list = expertGet(z.session.number, key, [])
    const targets = expertTargets(z)

    // no target → show the jail
    if (!targets.length) {
      if (!list.length) return z.reply(`🚔 ${expertFont('The jail is empty')}.\n\nUsage: ${z.prefix}jail @user [reason]`)
      const rows = list.map((j, i) => `${i + 1}. @${j.ids[0]}${j.reason ? ` — ${j.reason}` : ''}`)
      return z.sock.sendMessage(z.jid, {
        text: `🚔 *${expertFont('JAILED MEMBERS')}*\n\n${rows.join('\n')}\n\n_${z.prefix}unjail @user to release_`,
        mentions: list.map((j) => `${j.ids[0]}@s.whatsapp.net`)
      }, { quoted: z.msg })
    }

    const targetNum = expertNumber(targets[0])
    const p = g.meta.participants.find((x) => idsOf(x).includes(targetNum))
    if (!p) return z.reply('⚠️ That person is not in this group.')
    const ids = idsOf(p)
    const me = [z.sock.user?.id, z.sock.user?.lid].filter(Boolean).map(expertNumber)

    if (ids.some((i) => me.includes(i))) return z.reply('😅 I can\'t jail myself.')
    if (ids.some((i) => [z.session.number, expertCfg.owner].includes(i))) return z.reply('👑 I can\'t jail my owner.')
    if (g.isAdm(p)) return z.reply(`🛡️ @${ids[0]} is a group admin — demote them first.`.replace(`@${ids[0]}`, 'That person'))
    if (list.some((j) => j.ids.some((i) => ids.includes(i)))) return z.reply('🚔 That member is already in jail.')

    const reason = z.args.filter((a) => !a.startsWith('@')).join(' ').trim()
    list.push({ ids, reason, by: expertNumber(z.sender), at: Date.now() })
    expertSet(z.session.number, key, list)

    const mention = `${ids.find((i) => i.length < 15) || ids[0]}@s.whatsapp.net`
    await z.sock.sendMessage(z.jid, {
      text:
        `✦ ▰▱▰▱▰▱▰▱▰▱▰▱ ✦\n` +
        `   🚔 *${expertFont('BUSTED & JAILED')}* 🚔\n` +
        `✦ ▰▱▰▱▰▱▰▱▰▱▰▱ ✦\n\n` +
        `🔒 ${expertFont('PRISONER')}  ➜  @${mention.split('@')[0]}\n` +
        `📜 ${expertFont('CRIME')}  ➜  ${reason || expertFont('Disturbing the peace')}\n` +
        `⛓️ ${expertFont('SENTENCE')}  ➜  ${expertFont('Silent until released')}\n\n` +
        `▰▱▰▱▰▱▰▱▰▱▰▱\n   ${EXPERT_BRAND}`,
      mentions: [mention]
    }, { quoted: z.msg })
  }
}
