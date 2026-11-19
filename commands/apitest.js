// ⟦EXPERT⟧ .apitest — check which external services this host can reach (owner only)
import { expertChatAsk, expertChatLastErrors } from '../lib/expert.chatbot.js'
import { sources } from '../lib/ytMedia.js'

const targets = [
  ['YouTube search', 'https://www.youtube.com/results?search_query=test'],
  ['FAA (play)', `${sources.FAA_BASE}/`],
  ['NexaDev (play)', `${sources.NEXADEV_BASE}/`],
  ['Pollinations (chatbot)', 'https://text.pollinations.ai/openai'],
  ['Omegatech (chatbot)', 'https://api.omegatech.app/'],
  ['Catbox (tourl)', 'https://catbox.moe/'],
  ['Uguu (tourl)', 'https://uguu.se/'],
  ['tmpfiles (tourl)', 'https://tmpfiles.org/']
]

export default {
  name: 'apitest',
  aliases: ['diag'],
  owner: true,
  desc: 'Test which external services work from this host',
  async run(z) {
    await z.react('🔎').catch(() => {})
    const lines = await Promise.all(
      targets.map(async ([name, url]) => {
        const t = Date.now()
        try {
          const r = await fetch(url, { signal: AbortSignal.timeout(12000), headers: { 'User-Agent': 'Mozilla/5.0' } })
          return `${r.status < 500 ? '✅' : '⚠️'} ${name} — HTTP ${r.status} (${Date.now() - t}ms)`
        } catch (e) {
          return `❌ ${name} — ${e?.cause?.code || e?.message}`
        }
      })
    )
    let chat = '✅ works'
    try {
      await expertChatAsk(`apitest:${z.jid}`, 'Say OK', 'English')
    } catch {
      chat = `❌ ${expertChatLastErrors.join(' | ') || 'failed'}`
    }
    const key = process.env.CHATBOT_API_KEY ? '✅ set' : '❌ not set'
    await z.reply(`🔎 *API TEST*\n\n${lines.join('\n')}\n\n🤖 Chatbot answer: ${chat}\n🔑 CHATBOT_API_KEY: ${key}`)
    await z.react('✅').catch(() => {})
  }
      }
