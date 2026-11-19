// ⟦EXPERT⟧ .sudo add @user | .sudo del @user | .sudo list — trusted users who can use owner commands
import { expertGet, expertSet } from '../lib/expert.store.js'
import { expertTargets } from '../lib/expert.admin.js'
import { expertNumber } from '../lib/expert.utils.js'
import { expertCfg } from '../config/expert.config.js'
import { expertFont, EXPERT_BRAND } from '../lib/expert.frame.js'

// every number a person is known by (phone + LID) so matching works in groups and DMs
async function aliasesOf(z, jid) {
  const num = expertNumber(jid)
  const out = new Set([num])
  if (z.isGroup) {
    try {
      const meta = await z.sock.groupMetadata(z.jid)
      const p = meta.participants.find((x) => [x.id, x.phoneNumber, x.lid].filter(Boolean).map(expertNumber).includes(num))
      if (p) [p.id, p.phoneNumber, p.lid].filter(Boolean).forEach((i) => out.add(expertNumber(i)))
    } catch {}
  }
  return [...out]
}

export default {
  name: 'sudo',
  aliases: ['addsudo', 'sudolist'],
  owner: true,
  desc: 'Manage sudo users. Usage: .sudo add @user | .sudo del @user | .sudo list',
  async run(z) {
    // only the real owner manages sudo — a sudo user can't promote others or remove the owner
    if (!z.isRealOwner) return z.reply('⛔ Only the bot owner can manage sudo users.')

    const ns = z.session.number
    const list = expertGet(ns, 'sudo', [])
    let sub = (z.args[0] || '').toLowerCase()
    const typed = z.args.find((a) => a.replace(/\D/g, '').length > 6)?.replace(/\D/g, '')
    const target = expertTargets(z)[0]

    if (!sub || sub === 'list') {
      if (!list.length) return z.reply(`👑 ${expertFont('No sudo users yet')}.\n\nUsage:\n${z.prefix}sudo add @user\n${z.prefix}sudo del @user`)
      const shown = [...new Set(list.filter((n) => n.length < 15))]
      return z.reply(`👑 *${expertFont('SUDO USERS')}*\n\n${(shown.length ? shown : list).map((n) => `• +${n}`).join('\n')}\n\n   ${EXPERT_BRAND}`)
    }
    if (!['add', 'del', 'remove', 'rm'].includes(sub)) sub = 'add' // ".sudo @user" = add

    if (!target && !typed) return z.reply(`Usage: ${z.prefix}sudo add @user (or reply, or a number)\n${z.prefix}sudo del @user\n${z.prefix}sudo list`)
    const ids = await aliasesOf(z, target || `${typed}@s.whatsapp.net`)
    if (typed && target) ids.push(typed)

    if (ids.some((i) => [ns, expertCfg.owner].includes(i))) return z.reply('😅 The owner already has full access.')

    if (sub === 'add') {
      if (ids.every((i) => list.includes(i))) return z.reply('👑 Already a sudo user.')
      expertSet(ns, 'sudo', [...new Set([...list, ...ids])])
      const phone = ids.find((i) => i.length < 15) || ids[0]
      return z.sock.sendMessage(z.jid, {
        text: `👑 *${expertFont('SUDO GRANTED')}*\n\n@${phone} ${expertFont('can now use owner commands')}.\n\n   ${EXPERT_BRAND}`,
        mentions: [`${phone}@s.whatsapp.net`]
      }, { quoted: z.msg })
    }

    if (!ids.some((i) => list.includes(i))) return z.reply('🤷 That person is not a sudo user.')
    expertSet(ns, 'sudo', list.filter((n) => !ids.includes(n)))
    const phone = ids.find((i) => i.length < 15) || ids[0]
    await z.sock.sendMessage(z.jid, {
      text: `🔻 *${expertFont('SUDO REMOVED')}*\n\n@${phone} ${expertFont('no longer has owner access')}.`,
      mentions: [`${phone}@s.whatsapp.net`]
    }, { quoted: z.msg })
  }
}
