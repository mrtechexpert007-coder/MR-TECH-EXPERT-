// ⟦EXPERT⟧ .lock / .unlock — only admins can edit group name, picture and description
import { expertGuard } from '../lib/expert.admin.js'

export default {
  name: 'lock',
  desc: 'Only admins can edit group info',
  async run(z) {
    if (!(await expertGuard(z))) return
    await z.sock.groupSettingUpdate(z.jid, 'locked')
    await z.reply('🔐 Group info locked: only admins can edit it.')
  }
}
