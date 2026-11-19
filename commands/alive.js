import { expertCfg } from '../config/expert.config.js'
import { expertUptime } from '../lib/expert.utils.js'

export default {
  name: 'alive',
  desc: 'Check that the bot is online',
  async run(z) {
    await z.buttons({
      text: `✅ *${expertCfg.botName} is alive*\n\n⏱️ Uptime: *${expertUptime(process.uptime())}*\n🔧 Mode: *${z.mode}*\n🔣 Prefix: *${z.prefix || 'none'}*`,
      buttons: [{ id: `${z.prefix}menu`, text: '📜 Menu' }, { id: `${z.prefix}ping`, text: '🏓 Ping' }]
    })
  }
}
