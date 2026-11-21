// ⟦EXPERT⟧ .del — reply to a message to delete it for everyone
import { expertCtx, expertGroup } from '../lib/expert.admin.js'
import { expertNumber } from '../lib/expert.utils.js'

export default {
  name: 'del',
  aliases: ['delete'],
  desc: 'Delete the replied message',
  async run(z) {
    const c = expertCtx(z)
    if (!c?.stanzaId) return z.reply('↩️ Reply to the message you want deleted.')

    // was the replied message sent by this bot account? (phone and LID forms)
    const me = expertNumber(z.sock.user?.id)
    const meLid = expertNumber(z.sock.user?.lid)
    const author = c.participant ? expertNumber(c.participant) : ''
    const mine = !!author && (author === me || (!!meLid && author === meLid))

    if (z.isGroup) {
      const g = await expertGroup(z)
      if (!g.senderAdmin) return z.reply('⛔ Group admins only.')
    } else {
      if (!z.isOwner) return z.reply('⛔ Owner only.')
      if (!mine) return z.reply('⚠️ In private chats I can only delete messages sent from this account.')
    }

    try {
      await z.sock.sendMessage(z.jid, {
        delete: {
          remoteJid: z.jid,
          fromMe: mine,
          id: c.stanzaId,
          ...(z.isGroup && c.participant ? { participant: c.participant } : {})
        }
      })
    } catch (e) {
      return z.reply(`❌ Could not delete that message: ${e?.message || e}`)
    }

    // tidy up: remove the .del command itself when allowed
    {
      try {
        await z.sock.sendMessage(z.jid, {
          delete: { remoteJid: z.jid, fromMe: !!z.msg.key.fromMe, id: z.msg.key.id, ...(z.msg.key.participant ? { participant: z.msg.key.participant } : {}) }
        })
      } catch {}
    }
  }
}
