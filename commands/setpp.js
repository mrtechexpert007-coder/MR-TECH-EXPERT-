import { expertGetMedia } from '../lib/expert.admin.js'

export default {
  name: 'setpp',
  aliases: ['setdp'],
  owner: true,
  desc: 'Change this account\'s profile picture (reply to an image)',
  async run(z) {
    const media = await expertGetMedia(z)
    if (media?.type !== 'imageMessage') return z.reply('Reply to an image (or send one with the caption .setpp).')
    await z.sock.updateProfilePicture(z.sock.user.id, media.buffer)
    await z.reply('✅ Profile picture updated.')
  }
}
