import { expertGet, expertSet } from '../lib/expert.store.js'
export default {
  name: 'antidemote',
  desc: 'Undo unauthorized group demotions.',
  async run(expert) {
    const key = 'antidemote'
    const current = expertGet(expert.session.number, key, false)
    expertSet(expert.session.number, key, !current)
    await expert.reply(`🛡️ antidemote is now ${!current ? 'ON' : 'OFF'} for this connected account.`)
  }
}
