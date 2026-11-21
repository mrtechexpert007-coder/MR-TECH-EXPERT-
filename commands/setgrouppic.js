// ⟦EXPERT⟧ .setgrouppic — reply to / send an image to set the group picture
import { expertGuard, expertGetMedia } from '../lib/expert.admin.js'

export default {
  name: 'setgrouppic',
  aliases: ['gpp'],
  desc: 'Set group picture (reply to an image)',
  async run(z) {
    if (!(await expertGuard(z))) return
    const media = await expertGetMedia(z)
    if (media?.type !== 'imageMessage') return z.reply('Reply to an image (or send one with the caption .setgrouppic).')
    await z.sock.updateProfilePicture(z.jid, media.buffer)
    await z.reply('✅ Group picture updated.')
  }
}
