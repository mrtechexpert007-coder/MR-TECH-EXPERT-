// ⟦EXPERT⟧ .closetime 30m — mute the group now and reopen it later · .opentime 30m — open now and close later
// Timers live in memory: they are lost if the bot restarts.
import { expertGuard } from '../lib/expert.admin.js'
import { expertParseDur, expertDur, expertFmt, expertTz } from '../lib/expert.activity.js'
import { expertBox } from '../lib/expert.frame.js'

const timers = new Map() // `${ns}|${gid}` -> timeout

export default {
  name: 'closetime',
  aliases: ['opentime'],
  desc: 'Timed mute/open. Usage: .closetime 30m (close now, reopen after) · .opentime 30m (open now, close after) · off to cancel',
  async run(z) {
    const g = await expertGuard(z)
    if (!g) return
    const k = `${z.session.number}|${z.jid}`
    const opening = z.command === 'opentime'
    const arg = (z.args[0] || '').toLowerCase()

    if (arg === 'off' || arg === 'cancel') {
      if (!timers.has(k)) return z.reply('⏱️ No timer is running for this group.')
      clearTimeout(timers.get(k)); timers.delete(k)
      return z.reply('🛑 Timer cancelled. The group stays as it is now.')
    }
    const ms = expertParseDur(arg)
    if (!ms || ms < 60000 || ms > 86400000) return z.reply(`Usage: ${z.prefix}${z.command} 30m   (1m – 24h; units: m, h, d)\n${z.prefix}${z.command} off  to cancel`)

    try { await z.sock.groupSettingUpdate(z.jid, opening ? 'not_announcement' : 'announcement') }
    catch (e) { return z.reply(`❌ Could not change the group: ${e?.message || e}`) }

    if (timers.has(k)) clearTimeout(timers.get(k))
    timers.set(k, setTimeout(async () => {
      timers.delete(k)
      try {
        await z.sock.groupSettingUpdate(z.jid, opening ? 'announcement' : 'not_announcement')
        await z.sock.sendMessage(z.jid, { text: opening ? '🔒 Time is up — the group is closed again (admins only).' : '🔓 Time is up — the group is open again!' })
      } catch {}
    }, ms))

    const back = expertFmt(Date.now() + ms, expertTz(z.session.number, z.jid))
    await z.reply(expertBox(opening ? '🔓' : '🔒', opening ? 'OPEN FOR A WHILE' : 'CLOSED FOR A WHILE', [
      opening ? 'Everyone can send messages now.' : 'Only admins can send messages now.',
      `⏱️ ${opening ? 'Closes' : 'Reopens'} in *${expertDur(ms)}* (${back})`
    ]))
  }
}
