export default {
  name: 'calc',
  aliases: ['calculate', 'math'],
  desc: 'Calculator. Usage: .calc 12*(3+4)',
  async run(z) {
    const expr = z.text.replace(/×/g, '*').replace(/÷/g, '/').replace(/\^/g, '**').trim()
    if (!expr) return z.reply('Usage: .calc 12*(3+4)')
    if (!/^[\d+\-*/().%\s]+$/.test(expr) || expr.length > 100) return z.reply('❌ Only numbers and + - * / ( ) % ^ are allowed.')
    try {
      const r = Function(`"use strict"; return (${expr})`)()
      if (!Number.isFinite(r)) throw new Error('bad')
      await z.reply(`🧮 ${z.text.trim()} = *${Number(r.toFixed(10))}*`)
    } catch { await z.reply('❌ Invalid expression.') }
  }
}
