// ⟦EXPERT⟧ .restart — exits non-zero so Railway's ON_FAILURE policy brings it straight back.
// Sessions live in Postgres, so every linked account reconnects on its own.
import { expertCfg } from '../config/expert.config.js'

export default {
  name: 'restart',
  aliases: ['reboot'],
  owner: true,
  desc: 'Restart the bot process',
  async run(z) {
    if (z.session.number !== expertCfg.owner) return z.reply('⛔ Only the main owner (OWNER_NUMBER) can restart the shared server.')
    await z.reply('♻️ Restarting… back in a few seconds.')
    setTimeout(() => process.exit(1), 1500)
  }
}
