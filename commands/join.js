// ⟦EXPERT⟧ .join <invite link> — make the bot join a group
export default {
  name: 'join',
  owner: true,
  desc: 'Join a group via invite link',
  async run(z) {
    const code = z.args[0]?.match(/chat\.whatsapp\.com\/([A-Za-z0-9]{10,})/)?.[1]
    if (!code) return z.reply('Usage: .join https://chat.whatsapp.com/XXXXXXXX')
    try { await z.sock.groupAcceptInvite(code); await z.reply('✅ Joined.') }
    catch (e) { await z.reply(`❌ Could not join (${/expired|gone|not-authorized|forbidden/i.test(String(e?.message)) ? 'link invalid or revoked' : 'request may need admin approval'}).`) }
  }
}
