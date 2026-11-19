// ⟦EXPERT⟧ .votekick @user — members vote; the bot removes them at the vote target (needs bot admin)
//        .votekick yes | status | cancel (admin) | set <n> (admin)
import { expertGet, expertSet } from '../lib/expert.store.js'
import { expertGroup, expertTargets } from '../lib/expert.admin.js'
import { expertNumber } from '../lib/expert.utils.js'
import { expertPIds, expertIsAdm, expertIsBot, expertMention, expertTag } from '../lib/expert.activity.js'
import { expertCfg } from '../config/expert.config.js'
import { expertBox } from '../lib/expert.frame.js'

const votes = new Map() // `${ns}|${gid}` -> { p, voters:Set, need, until }
const TTL = 10 * 60 * 1000

export default {
  name: 'votekick',
  desc: 'Vote to remove a member. Usage: .votekick @user · .votekick yes · status · (admins) cancel · set <n>',
  async run(z) {
    if (!z.isGroup) return z.reply('👥 Groups only.')
    const ns = z.session.number
    const k = `${ns}|${z.jid}`
    const g = await expertGroup(z)
    const need = expertGet(ns, `vk:${z.jid}`, 5)
    const sub = (z.args[0] || '').toLowerCase()
    let v = votes.get(k)
    if (v && Date.now() > v.until) { votes.delete(k); v = null }
    const voter = expertNumber(z.sender)

    if (sub === 'set') {
      if (!g.senderAdmin) return z.reply('⛔ Group admins only.')
      const n = parseInt(z.args[1])
      if (!n || n < 2 || n > 50) return z.reply('Usage: .votekick set <votes needed, 2–50>')
      expertSet(ns, `vk:${z.jid}`, n)
      return z.reply(`✅ Votes needed to kick: *${n}*`)
    }
    if (sub === 'cancel') {
      if (!g.senderAdmin) return z.reply('⛔ Group admins only.')
      if (!v) return z.reply('No vote is running.')
      votes.delete(k)
      return z.reply('🛑 Vote cancelled.')
    }
    if (sub === 'status' || (!sub && !expertTargets(z).length)) {
      if (!v) return z.reply(`🗳️ No vote running. Start one with .votekick @user (needs *${need}* votes).`)
      return z.sock.sendMessage(z.jid, { text: `🗳️ Vote to kick ${expertTag(v.p)}: *${v.voters.size}/${v.need}*\nVote with .votekick yes`, mentions: [expertMention(v.p)] }, { quoted: z.msg })
    }

    const finish = async () => {
      votes.delete(k)
      try {
        await z.sock.groupParticipantsUpdate(z.jid, [v.p.id], 'remove')
        await z.sock.sendMessage(z.jid, { text: `👢 The group voted — ${expertTag(v.p)} has been removed.`, mentions: [expertMention(v.p)] })
      } catch (e) { await z.reply(/forbidden|not-authorized|403/i.test(e?.message || '') ? '🤖 Vote passed, but I need to be a group admin to remove them.' : `❌ Could not remove them: ${e?.message || e}`) }
    }

    if (sub === 'yes') {
      if (!v) return z.reply('No vote is running.')
      if (expertPIds(v.p).includes(voter)) return z.reply('😅 You can\'t vote on your own removal.')
      if (v.voters.has(voter)) return z.reply('✅ You already voted.')
      v.voters.add(voter)
      if (v.voters.size >= v.need) return finish()
      return z.reply(`🗳️ Vote counted: *${v.voters.size}/${v.need}*`)
    }

    // start a new vote
    if (v) return z.reply('🗳️ A vote is already running. Use .votekick status')
    const target = expertNumber(expertTargets(z)[0])
    const p = g.meta.participants.find((x) => expertPIds(x).includes(target))
    if (!p) return z.reply('⚠️ That person is not in this group.')
    if (expertIsBot(z, p)) return z.reply('😅 Nice try — I\'m not voting myself out.')
    if (expertIsAdm(p)) return z.reply('🛡️ Admins can\'t be vote-kicked.')
    if (expertPIds(p).some((i) => [ns, expertCfg.owner].includes(i))) return z.reply('👑 The owner can\'t be vote-kicked.')
    if (expertPIds(p).includes(voter)) return z.reply('😅 You can\'t start a vote on yourself.')
    v = { p, voters: new Set([voter]), need, until: Date.now() + TTL }
    votes.set(k, v)
    if (v.voters.size >= v.need) return finish()
    await z.sock.sendMessage(z.jid, {
      text: expertBox('🗳️', 'VOTE KICK', [`Remove ${expertTag(p)}?`, `Votes needed: *${need}*  ·  so far: *1*`, 'Vote with *.votekick yes*', '_Expires in 10 minutes._']),
      mentions: [expertMention(p)]
    }, { quoted: z.msg })
  }
}
