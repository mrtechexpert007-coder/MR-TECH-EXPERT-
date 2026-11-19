import { expertGet, expertSet } from '../lib/expert.store.js'
export default {
  name: 'antipromote',
  desc: 'Undo unauthorized group promotions.',
  async run(expert) {
    const key = 'antipromote'
    const current = expertGet(expert.session.number, key, false)
    expertSet(expert.session.number, key, !current)
    await expert.reply(`🛡️ antipromote is now ${!current ? 'ON' : 'OFF'} for this connected account.`)
  }
}
