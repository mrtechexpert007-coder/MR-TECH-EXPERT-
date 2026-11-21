import { expertGet, expertSet } from '../lib/expert.store.js'
export default {
  name: 'antiedit',
  desc: 'Send edited-message copies to this linked account owner DM.',
  async run(expert) {
    const key = 'antiedit'
    const current = expertGet(expert.session.number, key, false)
    expertSet(expert.session.number, key, !current)
    await expert.reply(`🛡️ antiedit is now ${!current ? 'ON' : 'OFF'} for this connected account.`)
  }
}
