// ⟦EXPERT⟧ .autolikestatus — auto-view and like (react to) every WhatsApp status
//   .autolikestatus          → toggle on/off
//   .autolikestatus on|off   → set explicitly
import { expertGet, expertSet } from '../lib/expert.store.js'

export default {
  name: 'autolikestatus',
  aliases: ['autolike', 'likestatus', 'statuslike'],
  desc: 'Auto-view and like every WhatsApp status',
  owner: true,
  async run(z) {
    const ns = z.session.number
    const sub = (z.args[0] || '').toLowerCase()
    const cur = expertGet(ns, 'autolikestatus', false)
    const next = ['on', 'enable', 'true', '1'].includes(sub) ? true : ['off', 'disable', 'false', '0'].includes(sub) ? false : !cur
    expertSet(ns, 'autolikestatus', next)
    await z.reply(`❤️ Auto Like Status is now *${next ? 'ON 🟢' : 'OFF ⚪'}*.\n` + (next ? 'New statuses will be viewed and liked with a random emoji (change with .autostatusreact emoji ❤️ 🔥).' : 'Statuses will no longer be auto-liked.'))
  }
}
