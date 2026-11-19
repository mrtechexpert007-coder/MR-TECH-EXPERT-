// ⟦EXPERT⟧ .currency 100 usd ngn
import { expertHttp } from '../lib/expert.admin.js'

export default {
  name: 'currency',
  aliases: ['convert', 'fx'],
  desc: 'Convert money. Usage: .currency 100 usd ngn',
  async run(z) {
    const amount = Number(z.args[0])
    const from = (z.args[1] || '').toUpperCase()
    const to = (z.args[2] || '').toUpperCase()
    if (!Number.isFinite(amount) || !/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to)) return z.reply('Usage: .currency 100 usd ngn')
    try {
      const d = await (await expertHttp(`https://open.er-api.com/v6/latest/${from}`)).json()
      const rate = d.rates?.[to]
      if (!rate) return z.reply('❌ Unknown currency code.')
      await z.reply(`💱 *${amount.toLocaleString()} ${from}* = *${(amount * rate).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${to}*\n_Rate: 1 ${from} = ${rate} ${to}_`)
    } catch { await z.reply('❌ Rate lookup failed.') }
  }
}
