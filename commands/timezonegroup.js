// ⟦EXPERT⟧ .timezonegroup [Area/City] — timezone used for events, birthdays and activity days
import { expertGet, expertSet } from '../lib/expert.store.js'
import { expertGroup } from '../lib/expert.admin.js'
import { expertFmt, expertTz } from '../lib/expert.activity.js'

export default {
  name: 'timezonegroup',
  aliases: ['grouptz'],
  desc: 'Show or set the group timezone. Usage: .timezonegroup [Africa/Lagos]',
  async run(z) {
    if (!z.isGroup) return z.reply('👥 Groups only.')
    const ns = z.session.number
    if (!z.text) {
      const tz = expertTz(ns, z.jid)
      return z.reply(`🕒 Group timezone: *${tz}*\nLocal time now: ${expertFmt(Date.now(), tz)}\n\nAdmins: .timezonegroup Africa/Lagos`)
    }
    const g = await expertGroup(z)
    if (!g.senderAdmin) return z.reply('⛔ Group admins only.')
    const want = z.args[0]
    const real = Intl.supportedValuesOf('timeZone').find((t) => t.toLowerCase() === want.toLowerCase())
    if (!real) return z.reply('❌ Unknown timezone. Use the Area/City form, e.g. Africa/Lagos, Europe/London, America/New_York.')
    expertSet(ns, `tz:${z.jid}`, real)
    await z.reply(`✅ Group timezone set to *${real}*\nLocal time now: ${expertFmt(Date.now(), real)}`)
  }
}
