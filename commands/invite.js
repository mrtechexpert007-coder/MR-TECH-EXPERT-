// ⟦EXPERT⟧ .invite 2348012345678 — DM the group invite link to a number (admins; bot must be admin)
import { expertGuard } from '../lib/expert.admin.js'
import { expertBox } from '../lib/expert.frame.js'

export default {
  name: 'invite',
  desc: 'Send the group invite link to a number. Usage: .invite 2348012345678',
  async run(z) {
    const g = await expertGuard(z)
    if (!g) return
    const num = (z.args[0] || '').replace(/\D/g, '')
    if (num.length < 8 || num.length > 15) return z.reply('Usage: .invite 2348012345678  (full number with country code)')
    if (g.meta.participants.some((p) => [p.id, p.phoneNumber].filter(Boolean).some((i) => i.startsWith(`${num}@`)))) return z.reply('✅ That number is already in the group.')
    try {
      const code = await z.sock.groupInviteCode(z.jid)
      await z.sock.sendMessage(`${num}@s.whatsapp.net`, {
        text: expertBox('💌', 'YOU\'RE INVITED', [`Join *${g.meta.subject}*`, `https://chat.whatsapp.com/${code}`, `_invited by @${z.sender.split('@')[0].split(':')[0]}_`]),
        mentions: [z.sender]
      })
      await z.reply(`📨 Invite sent to +${num}`)
    } catch (e) {
      await z.reply(`❌ Could not send the invite: ${e?.message || e}`)
    }
  }
}
