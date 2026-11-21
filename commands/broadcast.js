// ⟦EXPERT⟧ .broadcast <text> — send a message to every group (owner only, throttled)
import { expertSleep, expertRand } from '../lib/expert.utils.js'

export default {
  name: 'broadcast',
  aliases: ['bc'],
  owner: true,
  desc: 'Send a message to all your groups',
  async run(z) {
    if (!z.text.trim()) return z.reply('Usage: .broadcast Your announcement')
    const groups = Object.keys(await z.sock.groupFetchAllParticipating())
    if (!groups.length) return z.reply('Not in any groups.')
    await z.reply(`📣 Sending to ${groups.length} groups…`)
    let ok = 0
    for (const g of groups) {
      try { await z.sock.sendMessage(g, { text: `📣 *Broadcast*\n\n${z.text.trim()}` }); ok++ } catch {}
      await expertSleep(expertRand(1500, 3500)) // slow on purpose, to avoid WhatsApp flags
    }
    await z.reply(`✅ Delivered to ${ok}/${groups.length} groups.`)
  }
}
