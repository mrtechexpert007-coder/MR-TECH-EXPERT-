// ⟦EXPERT⟧ .channel — official WhatsApp channel (target of the menu's "View Channel" button)
import { expertCfg } from '../config/expert.config.js'
import { expertFont, EXPERT_BRAND } from '../lib/expert.frame.js'
import { expertSendUrlButton } from '../core/expert.buttons.js'

export default {
  name: 'channel',
  aliases: ['support', 'updates'],
  desc: 'Open the official WhatsApp channel',
  async run(expert) {
    const body =
      `📢 *${expertFont('OFFICIAL CHANNEL')}*\n\n` +
      `${expertFont('Follow for updates, drops & news')}\n\n` +
      `   ${EXPERT_BRAND}`

    // 1) real "tap to open" button  2) fallback: plain link (WhatsApp shows a channel preview)
    const sent = await expertSendUrlButton(expert, { text: body, label: '📢 Follow Channel', url: expertCfg.channelUrl })
    if (!sent) {
      await expert.sock.sendMessage(expert.jid, { text: `${body}\n\n${expertCfg.channelUrl}` }, { quoted: expert.msg })
    }
  }
}
