// ⟦EXPERT⟧ .gemini — AI chat via Omegatech Gemini2 API
async function ownerOnly(z) {
  return !!z.isOwner
}

// ─── In-memory session store: sender → sessionId ───
const sessions = new Map()

async function askGemini(message, sessionId) {
  const url = new URL('https://api.omegatech.app/api/ai/Gemini2')
  url.searchParams.set('action', 'chat')
  url.searchParams.set('message', message)
  if (sessionId) url.searchParams.set('sessionId', sessionId)

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'EXPERT-XMD/1.0'
    },
    signal: AbortSignal.timeout(60000)
  })

  if (!res.ok) throw new Error(`API ${res.status}`)
  const data = await res.json()
  if (!data?.success || !data?.data?.response) {
    throw new Error(data?.error || 'Empty response from Gemini')
  }
  return {
    text: data.data.response,
    sessionId: data.data.sessionId
  }
}

export default {
  name: 'gemini',
  aliases: ['ai', 'ask', 'gpt'],
  desc: 'Chat with Gemini AI (per-user session memory)',
  async run(z) {
    await z.react('🤖').catch(() => {})

    try {
      const prompt = z.text?.trim() || z.args?.join(' ')?.trim()

      if (!prompt) {
        return z.reply(
          `🤖 *GEMINI AI*\n\n` +
          `*Usage:* ${z.prefix}${z.args?.length ? 'gemini' : 'gemini'} <question>\n\n` +
          `*Examples:*\n` +
          `• ${z.prefix}gemini what is quantum computing\n` +
          `• ${z.prefix}ai tell me a joke\n\n` +
          `💡 *Memory:* Your chat history is remembered per session.\n` +
          `🔄 *Reset:* ${z.prefix}gemini reset`
        )
      }

      // ─── Reset session ───
      if (prompt.toLowerCase() === 'reset') {
        sessions.delete(z.sender)
        return z.reply('🔄 *Gemini session reset. Starting fresh.*')
      }

      await z.react('⏳').catch(() => {})

      // ─── Get session if exists ───
      const sessionId = sessions.get(z.sender) || null

      // ─── Query the API ───
      const { text, sessionId: newSession } = await askGemini(prompt, sessionId)

      // ─── Save session for continuity ───
      if (newSession) sessions.set(z.sender, newSession)

      // ─── Trim long replies ───
      let out = text.trim()
      const MAX = 3500
      if (out.length > MAX) out = out.slice(0, MAX) + '\n\n_…(truncated)_'

      await z.reply(`🤖 *Gemini*\n\n${out}`)
      await z.react('✅').catch(() => {})
    } catch (e) {
      console.error('[gemini]', e)
      await z.reply(`❌ *Gemini failed*\n${e.message}`)
      await z.react('❌').catch(() => {})
    }
  }
}
