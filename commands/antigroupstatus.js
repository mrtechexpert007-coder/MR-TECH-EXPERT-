// ⟦EXPERT⟧ .antigroupstatus on|off|warn|delete|kick|limit <n> — deletes group-status posts from non-admins
import { expertShieldCommand } from '../lib/expert.shield.js'
export default expertShieldCommand({
  name: 'antigroupstatus',
  aliases: ['antigs', 'antigroupstatusgroup'],
  desc: 'Delete group-status posts from non-admins',
  label: 'Deletes group status updates posted in this group by regular members.'
})
