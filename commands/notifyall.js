// ⟦EXPERT⟧ .notifyall <text> — send a message to every account linked (paired) to this bot (owner only)
// Each linked account receives it in its own "Message yourself" chat, sent by its own session (no cold DMs → safer for WhatsApp).
import { expertHub } from '../core/expert.hub.js'
import { expertSleep, expertRand } from '../lib/expert.utils.js'

export default {
  name: 'notifyall',
  aliases: ['notifyusers', 'bcusers'],
  owner: true,
  desc: 'Send a message to every linked account',
  async run(z) {
    const text = (z.text || '').trim()
    if (!text) return z.reply('Usage: .notifyall Your message to all linked users')
    const sessions = [...expertHub.sessions.values()].filter((s) => s.opened && s.sock)
    if (!sessions.length) return z.reply('No connected linked accounts.')
    await z.reply(`📢 Sending to ${sessions.length} linked account(s)…`)
    let ok = 0
    for (const s of sessions) {
      try { await s.sock.sendMessage(`${s.number}@s.whatsapp.net`, { text: `📢 *Announcement*\n\n${text}` }); ok++ } catch {}
      await expertSleep(expertRand(1000, 2500))
    }
    await z.reply(`✅ Delivered to ${ok}/${sessions.length} linked account(s).`)
  }
}
