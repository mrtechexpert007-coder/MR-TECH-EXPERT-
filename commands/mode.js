// ⟦EXPERT⟧ .mode public|private  (per linked account)
import { expertSet } from '../lib/expert.store.js'

export default {
  name: 'mode',
  owner: true,
  desc: 'Set public/private mode',
  async run(expert) {
    const m = (expert.args[0] || '').toLowerCase()
    if (!['public', 'private'].includes(m)) {
      return expert.buttons({
        text: `⚙️ Mode is *${expert.mode}*`,
        buttons: [{ id: '.mode public', text: '🌍 Public' }, { id: '.mode private', text: '🔒 Private' }]
      })
    }
    expertSet(expert.session.number, 'mode', m)
    await expert.reply(`✅ Mode set to *${m}*`)
  }
}
