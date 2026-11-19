import { expertGuard } from '../lib/expert.admin.js'

export default {
  name: 'unlock',
  desc: 'Let all members edit group info',
  async run(z) {
    if (!(await expertGuard(z))) return
    await z.sock.groupSettingUpdate(z.jid, 'unlocked')
    await z.reply('🔓 Group info unlocked: all members can edit it.')
  }
}
