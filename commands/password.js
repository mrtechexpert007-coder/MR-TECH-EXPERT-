import { randomInt } from 'node:crypto'

export default {
  name: 'password',
  aliases: ['genpass'],
  desc: 'Generate a strong password (private chat only)',
  async run(z) {
    if (z.isGroup) return z.reply('🔒 Use this in a private chat, not in a group.')
    const len = Math.min(64, Math.max(8, parseInt(z.args[0], 10) || 16))
    const set = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*-_'
    await z.reply(`🔑 \`${Array.from({ length: len }, () => set[randomInt(set.length)]).join('')}\`\n_${len} characters. Save it in a password manager._`)
  }
}
