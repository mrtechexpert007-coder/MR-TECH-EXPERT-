import { expertGet, expertSet } from '../lib/expert.store.js'
export default {
  name: 'antidelete',
  desc: 'Send deleted-message copies to this linked account owner DM.',
  async run(expert) {
    const key = 'antidelete'
    const current = expertGet(expert.session.number, key, false)
    expertSet(expert.session.number, key, !current)
    await expert.reply(`🛡️ antidelete is now ${!current ? 'ON' : 'OFF'} for this connected account.`)
  }
}
