export default {
  name: 'qr',
  aliases: ['qrcode'],
  desc: 'Make a QR code. Usage: .qr any text or link',
  async run(z) {
    if (!z.text.trim()) return z.reply('Usage: .qr https://example.com')
    await z.sock.sendMessage(z.jid, {
      image: { url: `https://api.qrserver.com/v1/create-qr-code/?size=500x500&margin=10&data=${encodeURIComponent(z.text.trim())}` },
      caption: '📱 Scan me'
    }, { quoted: z.msg })
  }
}
