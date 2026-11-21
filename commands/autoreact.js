import { expertGet, expertSet } from '../lib/expert.store.js'
export default {
  name: 'autoreact',
  desc: 'Automatically react to incoming messages.',
  async run(expert) {
    const key = 'autoreact'
    const current = expertGet(expert.session.number, key, false)
    expertSet(expert.session.number, key, !current)
    await expert.reply(`🛡️ autoreact is now ${!current ? 'ON' : 'OFF'} for this connected account.`)
  }
}
