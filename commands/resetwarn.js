import { expertGet, expertSet } from '../lib/expert.store.js'
import { expertGuard, expertTargets } from '../lib/expert.admin.js'
import { expertNumber } from '../lib/expert.utils.js'

export default {
  name: 'resetwarn',
  aliases: ['clearwarn'],
  desc: 'Clear a member\'s warnings',
  async run(z) {
    if (!(await expertGuard(z))) return
    const [target] = expertTargets(z)
    if (!target) return z.reply('Tag or reply to the member.\nUsage: .resetwarn @user')
    const all = expertGet(z.session.number, 'warns', {})
    if (all[z.jid]) delete all[z.jid][expertNumber(target)]
    expertSet(z.session.number, 'warns', all)
    await z.reply('✅ Warnings cleared.')
  }
}
