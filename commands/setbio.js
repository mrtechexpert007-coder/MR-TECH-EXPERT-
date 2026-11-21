export default {
  name: 'setbio',
  aliases: ['setstatus'],
  owner: true,
  desc: 'Change this account\'s WhatsApp bio',
  async run(z) {
    if (!z.text.trim()) return z.reply('Usage: .setbio Your new bio')
    await z.sock.updateProfileStatus(z.text.trim().slice(0, 139))
    await z.reply('✅ Bio updated.')
  }
}
