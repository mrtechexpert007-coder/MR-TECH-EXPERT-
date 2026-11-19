// ⟦EXPERT⟧ .warnings [@user] | .resetwarn @user
import { expertGet, expertSet } from '../lib/expert.store.js'
import { expertGuard, expertTargets } from '../lib/expert.admin.js'
import { expertNumber } from '../lib/expert.utils.js'

export default {
  name: 'warnings',
  aliases: ['warns'],
  desc: 'Show warnings in this group',
  async run(z) {
    if (!z.isGroup) return z.reply('👥 Groups only.')
    const grp = expertGet(z.session.number, 'warns', {})[z.jid] || {}
    const [target] = expertTargets(z)
    if (target) {
      const n = expertNumber(target)
      return z.sock.sendMessage(z.jid, { text: `📋 @${n} has *${grp[n] || 0}/3* warnings.`, mentions: [target] }, { quoted: z.msg })
    }
    const rows = Object.entries(grp).filter(([, c]) => c > 0)
    if (!rows.length) return z.reply('✅ Nobody has warnings in this group.')
    await z.sock.sendMessage(z.jid, {
      text: `📋 *Warnings*\n\n${rows.map(([n, c]) => `• @${n} — ${c}/3`).join('\n')}`,
      mentions: rows.map(([n]) => `${n}@s.whatsapp.net`)
    }, { quoted: z.msg })
  }
}
