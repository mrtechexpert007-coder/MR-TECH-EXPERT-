import { expertHttp } from '../lib/expert.admin.js'

const IDS = { btc: 'bitcoin', eth: 'ethereum', usdt: 'tether', bnb: 'binancecoin', sol: 'solana', xrp: 'ripple', doge: 'dogecoin', ada: 'cardano', ton: 'the-open-network', trx: 'tron', ltc: 'litecoin' }

export default {
  name: 'crypto',
  aliases: ['coin', 'price'],
  desc: 'Crypto price. Usage: .crypto btc',
  async run(z) {
    const a = (z.args[0] || 'btc').toLowerCase()
    const id = IDS[a] || a
    try {
      const d = (await (await expertHttp(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=usd,ngn&include_24hr_change=true`)).json())[id]
      if (!d) return z.reply('❌ Coin not found. Use a symbol like btc, eth, sol or a CoinGecko id.')
      const ch = d.usd_24h_change
      await z.reply(`🪙 *${id.toUpperCase()}*\n\n💵 $${d.usd.toLocaleString()}\n🇳🇬 ₦${Math.round(d.ngn).toLocaleString()}\n${ch >= 0 ? '📈' : '📉'} 24h: ${ch?.toFixed(2)}%`)
    } catch { await z.reply('❌ Price lookup failed (rate limited?). Try again shortly.') }
  }
}
