// ⟦EXPERT⟧ .afk [reason] — tell people who tag you that you're away
import { expertGet, expertSet } from '../lib/expert.store.js'
import { expertAliases } from '../lib/expert.activity.js'
import { expertNumber } from '../lib/expert.utils.js'
import { expertBox } from '../lib/expert.frame.js'

export default {
  name: 'afk',
  desc: 'Go AFK — the bot answers when someone tags you. Usage: .afk [reason]',
  async run(z) {
    if (!z.isGroup) return z.reply('👥 Groups only.')
    const ids = new Set(await expertAliases(z, z.sender))
    if (z.msg.key.participantAlt) ids.add(expertNumber(z.msg.key.participantAlt))
    const reason = (z.text || 'No reason').slice(0, 120)
    const afk = expertGet(z.session.number, 'afk', {})
    afk[[...ids][0]] = { ids: [...ids], reason, since: Date.now(), jid: z.sender }
    expertSet(z.session.number, 'afk', afk)
    await z.sock.sendMessage(z.jid, {
      text: expertBox('💤', 'AFK SET', [`@${expertNumber(z.sender)} is now away`, `📝 ${reason}`, '_Send any message to come back._']),
      mentions: [z.sender]
    }, { quoted: z.msg })
  }
}
