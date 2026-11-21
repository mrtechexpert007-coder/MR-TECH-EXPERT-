// ⟦EXPERT⟧ .claude — AI chat via Omegatech Secret (Claude Fable 5)
async function ownerOnly(z) {
  return !!z.isOwner
}

// ─── Per-user session store ───
const sessions = new Map()

async function askClaude(message, sessionId) {
  const url = new URL('https://api.omegatech.app/api/ai/Secret')
  url.searchParams.set('action', 'chat')
  url.searchParams.set('message', message)
  if (sessionId) url.searchParams.set('sessionId', sessionId)

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'EXPERT-XMD/1.0'
    },
    signal: AbortSignal.timeout(90000)
  })

  if (!res.ok) throw new Error(`API ${res.status}`)
  const data = await res.json()
  if (!data?.success || !data?.data?.reply) {
    throw new Error(data?.error || 'Empty response from Claude')
  }
  return {
    text: data.data.reply,
    sessionId: data.sessionId,
    model: data.data.model || 'claude-fable-5',
    usage: data.data.usage || null
  }
}

export default {
  name: 'claude',
  aliases: ['c', 'fable', 'secret'],
  desc: 'Chat with Claude Fable 5 AI (per-user session memory)',
  async run(z) {
    await z.react('🧠').catch(() => {})

    try {
      const prompt = z.text?.trim() || z.args?.join(' ')?.trim()

      if (!prompt) {
        return z.reply(
          `🧠 *CLAUDE FABLE 5*\n\n` +
          `*Usage:* ${z.prefix}claude <question>\n\n` +
          `*Examples:*\n` +
          `• ${z.prefix}claude explain quantum entanglement simply\n` +
          `• ${z.prefix}c write a python function to sort a dict\n\n` +
          `💡 Session memory persists per user.\n` +
          `🔄 Reset: ${z.prefix}claude reset`
        )
      }

      if (prompt.toLowerCase() === 'reset') {
        sessions.delete(z.sender)
        return z.reply('🔄 *Claude session reset. Starting fresh.*')
      }

      await z.react('⏳').catch(() => {})

      const sessionId = sessions.get(z.sender) || null
      const { text, sessionId: newSession, model, usage } = await askClaude(prompt, sessionId)

      if (newSession) sessions.set(z.sender, newSession)

      // ─── Trim ───
      let out = text.trim()
      const MAX = 3500
      if (out.length > MAX) out = out.slice(0, MAX) + '\n\n_…(truncated)_'

      // ─── Usage footer ───
      const footer = usage
        ? `\n\n_${model} · ${usage.completion_tokens} tokens_`
        : `\n\n_${model}_`

      await z.reply(`🧠 *Claude Fable 5*\n\n${out}${footer}`)
      await z.react('✅').catch(() => {})
    } catch (e) {
      console.error('[claude]', e)
      await z.reply(`❌ *Claude failed*\n${e.message}`)
      await z.react('❌').catch(() => {})
    }
  }
}
