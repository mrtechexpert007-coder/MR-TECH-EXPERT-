// ⟦EXPERT⟧ .antilink on|off|warn|delete|kick|limit <n> — deletes links from non-admins, with warnings
import { expertShieldCommand } from '../lib/expert.shield.js'
export default expertShieldCommand({
  name: 'antilink',
  desc: 'Delete links from non-admins (with warnings)',
  label: 'Deletes messages with links sent by regular members.'
})
