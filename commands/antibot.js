// ⟦EXPERT⟧ .antibot on|off|warn|delete|kick|limit <n> — removes messages sent by other bots
import { expertShieldCommand } from '../lib/expert.shield.js'
export default expertShieldCommand({
  name: 'antibot',
  desc: 'Delete/remove other bots in the group',
  label: 'Deletes bot commands typed by members (.menu, !play, /ping...) and messages sent by other bots. Admins, owner and sudo are exempt.'
})
