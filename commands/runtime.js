// ⟦EXPERT⟧ .runtime
import os from 'node:os'
import { expertHub } from '../core/expert.hub.js'
import { expertUptime, expertBytes } from '../lib/expert.utils.js'

export default {
  name: 'runtime',
  aliases: ['uptime', 'rt'],
  desc: 'How long the bot has been running',
  async run(expert) {
    const up = expertUptime(process.uptime())
    const mine = expertHub.sessions.get(expert.session.number)
    const link = mine?.openedAt ? expertUptime((Date.now() - mine.openedAt) / 1000) : '—'
    const linked = [...expertHub.sessions.values()].filter((s) => s.opened).length

    await expert.buttons({
      text:
        `⏱️ *Runtime*\n\n` +
        `🟢 Bot uptime: *${up}*\n` +
        `🔗 This link: *${link}*\n` +
        `👥 Linked accounts: *${linked}*\n` +
        `💾 RAM: *${expertBytes(process.memoryUsage().rss)}* / ${expertBytes(os.totalmem())}\n` +
        `🧩 Node: *${process.version}*`,
      buttons: [
        { id: '.runtime', text: '🔄 Refresh' },
        { id: '.ping', text: '🏓 Ping' }
      ]
    })
  }
}
