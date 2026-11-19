// ⟦EXPERT⟧ .report [reason] — reply to a message to alert the group admins
import { expertCtx } from '../lib/expert.admin.js'
import { expertIsAdm, expertMention, expertQuotedText } from '../lib/expert.activity.js'
import { expertNumber } from '../lib/expert.utils.js'
import { expertBox } from '../lib/expert.frame.js'

export default {
  name: 'report',
  desc: 'Report a message to the admins. Reply to it with .report [reason]',
  async run(z) {
    if (!z.isGroup) return z.reply('👥 Groups only.')
    const c = expertCtx(z)
    if (!c?.stanzaId) return z.reply('↩️ Reply to the message you want to report.')
    const meta = await z.sock.groupMetadata(z.jid)
    const admins = meta.participants.filter(expertIsAdm)
    const snippet = expertQuotedText(z).slice(0, 150)
    const quoted = { key: { remoteJid: z.jid, fromMe: false, id: c.stanzaId, participant: c.participant }, message: c.quotedMessage }
    const lines = [
      `📣 Reported by @${expertNumber(z.sender)}`,
      ...(c.participant ? [`👤 Against: @${expertNumber(c.participant)}`] : []),
      `📝 Reason: ${z.text || 'No reason given'}`,
      ...(snippet ? [`💬 "${snippet}"`] : []),
      '', admins.map((p) => `@${expertNumber(expertMention(p))}`).join(' ')
    ]
    await z.sock.sendMessage(z.jid, { text: expertBox('🚨', 'REPORT', lines), mentions: [z.sender, ...(c.participant ? [c.participant] : []), ...admins.map(expertMention)] }, { quoted })
    await z.react('✅')
  }
}
