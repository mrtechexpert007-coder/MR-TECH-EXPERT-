// ⟦EXPERT⟧ .ai <question> — free text AI via Pollinations (no API key). Quality/uptime depends on that service.
import { expertHttp, expertQuoted } from '../lib/expert.admin.js'

export default {
  name: 'ai',
  aliases: ['ask', 'gpt'],
  desc: 'Ask an AI. Usage: .ai explain gravity simply',
  async run(z) {
    const q = expertQuoted(z)
    const prompt = (z.text.trim() || q?.conversation || q?.extendedTextMessage?.text || '').slice(0, 1500)
    if (!prompt) return z.reply('Usage: .ai your question')
    await z.react('🤖')
    try {
      const sys = encodeURIComponent('You are a helpful WhatsApp assistant. Keep answers short and clear.')
      const r = await expertHttp(`https://text.pollinations.ai/${encodeURIComponent(prompt)}?system=${sys}`, { signal: AbortSignal.timeout(45000) })
      const out = (await r.text()).trim()
      if (!out) throw new Error('empty')
      await z.reply(out.slice(0, 3500))
    } catch { await z.reply('❌ The AI service did not answer. Try again in a moment.') }
  }
}
