// ⟦EXPERT⟧ .owner
import { expertCfg } from '../config/expert.config.js'

export default {
  name: 'owner',
  aliases: ['creator'],
  desc: 'Bot owner contact',
  async run(expert) {
    const num = expert.session.number
    const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${expertCfg.botName} Owner\nTEL;type=CELL;waid=${num}:+${num}\nEND:VCARD`
    await expert.sock.sendMessage(expert.jid, { contacts: { displayName: 'Owner', contacts: [{ vcard }] } }, { quoted: expert.msg })
  }
}
