export default {
  name: 'setprofilename',
  aliases: ['setbotname'],
  owner: true,
  desc: 'Change this account\'s WhatsApp name',
  async run(z) {
    const n = z.text.trim()
    if (!n) return z.reply('Usage: .setprofilename New Name')
    await z.sock.updateProfileName(n.slice(0, 25))
    await z.reply('✅ Name updated.')
  }
}
