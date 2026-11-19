// ⟦EXPERT⟧ .membercount
import { expertIsAdm } from '../lib/expert.activity.js'
import { expertBox } from '../lib/expert.frame.js'

export default {
  name: 'membercount',
  aliases: ['members'],
  desc: 'How many members this group has',
  async run(z) {
    if (!z.isGroup) return z.reply('👥 Groups only.')
    const meta = await z.sock.groupMetadata(z.jid)
    const admins = meta.participants.filter(expertIsAdm).length
    await z.reply(expertBox('👥', 'MEMBER COUNT', [`*${meta.subject}*`, `Total: *${meta.participants.length}*`, `Admins: *${admins}*  ·  Members: *${meta.participants.length - admins}*`]))
  }
}
