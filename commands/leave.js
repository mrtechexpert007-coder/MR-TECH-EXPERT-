export default {
  name: 'leave',
  aliases: ['leavegroup'],
  owner: true,
  desc: 'Make the bot leave this group',
  async run(z) {
    if (!z.isGroup) return z.reply('👥 Groups only.')
    await z.reply('👋 Goodbye!')
    await z.sock.groupLeave(z.jid)
  }
}
