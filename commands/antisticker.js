// ⟦EXPERT⟧ .antisticker on|off|warn|delete|kick|limit <n> — deletes stickers from non-admins
import { expertShieldCommand } from '../lib/expert.shield.js'
export default expertShieldCommand({
  name: 'antisticker',
  desc: 'Delete stickers from non-admins (with warnings)',
  label: 'Deletes stickers sent by regular members.'
})
