// ⟦EXPERT⟧ .time [city] — local time anywhere
const fmt = (tz) => new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())
const WORLD = ['Africa/Lagos', 'Europe/London', 'America/New_York', 'Asia/Dubai', 'Asia/Tokyo']

export default {
  name: 'time',
  aliases: ['clock'],
  desc: 'Time in a city. Usage: .time Tokyo',
  async run(z) {
    const q = z.text.trim().toLowerCase().replace(/\s+/g, '_')
    if (!q) return z.reply(`🕒 *World clock*\n\n${WORLD.map((tz) => `• ${tz.split('/')[1].replace(/_/g, ' ')}: *${fmt(tz)}*`).join('\n')}`)
    const zones = Intl.supportedValuesOf('timeZone')
    const tz = zones.find((x) => x.toLowerCase() === q) || zones.find((x) => x.toLowerCase().split('/').pop() === q) || zones.find((x) => x.toLowerCase().includes(q))
    if (!tz) return z.reply('❌ Unknown city. Try a major city like Lagos, London or Tokyo.')
    await z.reply(`🕒 *${tz.split('/').pop().replace(/_/g, ' ')}*\n${fmt(tz)}  (${tz})`)
  }
}
