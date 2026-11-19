// ⟦EXPERT⟧ .remind 10m take the food off the stove   (units: s m h, max 24h)
// Reminders live in memory — a bot restart/redeploy clears pending ones.
const pending = globalThis.__expertReminders ??= new Map()
const MAX_PER_ACCOUNT = 20

export default {
  name: 'remind',
  aliases: ['reminder'],
  desc: 'Set a reminder. Usage: .remind 10m call mum',
  async run(z) {
    const m = (z.args[0] || '').match(/^(\d+)([smh])$/i)
    const what = z.args.slice(1).join(' ').trim()
    if (!m || !what) return z.reply('Usage: .remind 10m call mum\nUnits: s, m, h (max 24h)')
    const ms = Number(m[1]) * { s: 1000, m: 60000, h: 3600000 }[m[2].toLowerCase()]
    if (ms < 1000 || ms > 86400000) return z.reply('❌ Choose between 1 second and 24 hours.')
    const mine = [...pending.keys()].filter((k) => k.startsWith(`${z.session.number}:`)).length
    if (mine >= MAX_PER_ACCOUNT) return z.reply('❌ Too many pending reminders.')
    const id = `${z.session.number}:${Date.now()}:${Math.random()}`
    const { sock, jid, sender, msg } = z
    pending.set(id, setTimeout(async () => {
      pending.delete(id)
      try { await sock.sendMessage(jid, { text: `⏰ *Reminder* @${String(sender).split('@')[0].split(':')[0]}\n${what}`, mentions: [sender] }, { quoted: msg }) } catch {}
    }, ms))
    await z.reply(`⏰ Okay, I'll remind you in *${m[1]}${m[2].toLowerCase()}*.`)
  }
}
