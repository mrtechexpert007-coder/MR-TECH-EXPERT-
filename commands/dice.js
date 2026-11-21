import { randomInt } from 'node:crypto'
export default {
  name: 'dice',
  aliases: ['roll'],
  desc: 'Roll a die. Usage: .dice [sides]',
  async run(z) {
    const sides = Math.min(1000, Math.max(2, parseInt(z.args[0], 10) || 6))
    await z.reply(`🎲 d${sides}: *${randomInt(1, sides + 1)}*`)
  }
}
