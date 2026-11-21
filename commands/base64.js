export default {
  name: 'base64',
  aliases: ['b64'],
  desc: 'Encode/decode. Usage: .base64 encode hello',
  async run(z) {
    const mode = (z.args[0] || '').toLowerCase()
    const text = z.args.slice(1).join(' ')
    if (!['encode', 'decode'].includes(mode) || !text) return z.reply('Usage: .base64 encode hello\n.base64 decode aGVsbG8=')
    try { await z.reply(mode === 'encode' ? Buffer.from(text).toString('base64') : Buffer.from(text, 'base64').toString('utf8')) }
    catch { await z.reply('❌ Invalid input.') }
  }
}
