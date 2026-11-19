import { expertTargets } from '../lib/expert.admin.js'

const make = (name, action, done) => ({
  name,
  owner: true,
  desc: `${name[0].toUpperCase()}${name.slice(1)} a contact (tag, reply, or number)`,
  async run(z) {
    const num = (z.args[0] || '').replace(/\D/g, '')
    const jid = expertTargets(z)[0] || (num.length > 6 ? `${num}@s.whatsapp.net` : (!z.isGroup ? z.jid : null))
    if (!jid) return z.reply(`Usage: .${name} 2348012345678  (or tag/reply)`)
    await z.sock.updateBlockStatus(jid, action)
    await z.reply(done)
  }
})

export default make('block', 'block', '🚫 Blocked.')
