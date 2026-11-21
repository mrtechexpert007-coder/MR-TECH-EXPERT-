// ⟦EXPERT⟧ .chat <message> — talk to the multilingual AI directly (works even when auto-reply is OFF)
import { expertGet } from '../lib/expert.store.js'
import { expertQuoted } from '../lib/expert.admin.js'
import { expertChatAsk, expertChunk } from '../lib/expert.chatbot.js'

export default {
  name: 'chat',
  aliases: ['sema', 'talk'],
  desc: 'Chat with the AI in any language. Usage: .chat habari, nieleze kuhusu AI',
  async run(z) {
    const q = expertQuoted(z)
    const text = (z.text.trim() || q?.conversation || q?.extendedTextMessage?.text || '').slice(0, 1500)
    if (!text) return z.reply(`💬 Usage: ${z.prefix}chat <ujumbe>\nAndika kwa lugha yoyote — nitajibu kwa lugha hiyo.`)
    await z.react('💬').catch(() => {})
    try { await z.sock.sendPresenceUpdate('composing', z.jid) } catch {}
    try {
      const out = await expertChatAsk(`${z.session.number}:${z.jid}`, text, expertGet(z.session.number, 'chatbot:lang', 'auto'))
      for (const part of expertChunk(out)) await z.reply(part)
    } catch {
      await z.reply('❌ AI haikujibu sasa hivi. Jaribu tena baada ya muda mfupi.')
    }
  }
                                          }
