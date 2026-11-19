import { randomInt } from 'node:crypto'
export default { name: 'flip', desc: 'Flip a coin', async run(z) { await z.reply(randomInt(2) ? '🪙 *Heads*' : '🪙 *Tails*') } }
