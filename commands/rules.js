import { expertGet } from '../lib/expert.store.js'

export default {
  name: 'rules',
  desc: 'Show the group rules',
  async run(z) {
    if (!z.isGroup) return z.reply('👥 Groups only.')
    const r = expertGet(z.session.number, 'rules', {})[z.jid]
    await z.reply(r ? `📜 *Group Rules*\n\n${r}` : 'No rules set yet. Admins can use .setrules')
  }
}
