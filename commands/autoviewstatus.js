// ⟦EXPERT⟧ .autoviewstatus — auto-view every WhatsApp status your contacts post
//   .autoviewstatus          → toggle on/off
//   .autoviewstatus on|off   → set explicitly
import { expertGet, expertSet } from '../lib/expert.store.js'

export default {
  name: 'autoviewstatus',
  aliases: ['autoview', 'viewstatus', 'statusview'],
  desc: 'Auto-view every WhatsApp status your contacts post',
  owner: true,
  async run(z) {
    const ns = z.session.number
    const sub = (z.args[0] || '').toLowerCase()
    const cur = expertGet(ns, 'autoviewstatus', false)
    const next = ['on', 'enable', 'true', '1'].includes(sub) ? true : ['off', 'disable', 'false', '0'].includes(sub) ? false : !cur
    expertSet(ns, 'autoviewstatus', next)
    await z.reply(`👁️ Auto View Status is now *${next ? 'ON 🟢' : 'OFF ⚪'}*.\n` + (next ? 'New statuses will be viewed automatically.' : 'Statuses will no longer be auto-viewed.'))
  }
}
