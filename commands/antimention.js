// ⟦EXPERT⟧ .antimention on|off|warn|delete|kick|limit <n> — deletes messages that @mention any member (non-admins)
import { expertShieldCommand } from '../lib/expert.shield.js'
export default expertShieldCommand({
  name: 'antimention',
  aliases: ['antimentions'],
  desc: 'Delete messages that @mention anyone (non-admins)',
  label: 'Deletes any message where a regular member @mentions another member. (antitag only reacts to many tags at once.)'
})
