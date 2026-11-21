// ⟦EXPERT⟧ .antitag on|off|warn|delete|kick|limit <n>|max <n> — blocks mass member tagging from non-admins
import { expertGet, expertSet } from '../lib/expert.store.js'
import { expertShieldCommand } from '../lib/expert.shield.js'
export default expertShieldCommand({
  name: 'antitag',
  desc: 'Delete messages that tag many members (non-admins)',
  label: 'Deletes messages tagging too many members at once.',
  extra: {
    sub: 'max',
    usage: '.antitag max <n> — tags allowed per message',
    run: (z, val) => {
      const n = parseInt(val, 10)
      if (!n || n < 2 || n > 100) return z.reply(`Usage: .antitag max <2-100> (now ${expertGet(z.session.number, 'antitag:max', 5)})`)
      expertSet(z.session.number, 'antitag:max', n)
      return z.reply(`✅ antitag now triggers at *${n}* or more tags.`)
    }
  }
})
