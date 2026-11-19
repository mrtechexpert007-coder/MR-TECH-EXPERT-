// ⟦EXPERT⟧ .chatbot on|off — AI auto-reply switch (the hook lives in lib/expert.chatbot.js)
//   .chatbot on / off        → turn auto-reply for this linked account
//   .chatbot groups all|mention|off
//   .chatbot lang <language> → force a reply language (.chatbot lang auto = follow the user)
import { expertGet, expertSet } from '../lib/expert.store.js'
import { DEFAULT_ON } from '../lib/expert.chatbot.js'

export default {
  name: 'chatbot',
  aliases: ['autoreply'],
  owner: true,
  desc: 'AI auto-reply. Usage: .chatbot on | off | groups all|mention|off | lang <language>',
  async run(z) {
    const ns = z.session.number
    const [sub, ...rest] = z.args
    const s = String(sub || '').toLowerCase()

    if (s === 'on' || s === 'off') {
      expertSet(ns, 'chatbot', s === 'on')
      return z.reply(`🤖 Chatbot is now *${s.toUpperCase()}*.`)
    }
    if (s === 'groups') {
      const v = String(rest[0] || '').toLowerCase()
      if (!['all', 'mention', 'off'].includes(v)) return z.reply(`Usage: ${z.prefix}chatbot groups all|mention|off`)
      expertSet(ns, 'chatbot:groups', v)
      return z.reply(`👥 Chatbot in groups: *${v}*`)
    }
    if (s === 'lang') {
      const v = rest.join(' ').trim() || 'auto'
      expertSet(ns, 'chatbot:lang', v)
      return z.reply(`🌍 Chatbot language: *${v}*`)
    }
    const on = expertGet(ns, 'chatbot', DEFAULT_ON)
    return z.reply(
      `🤖 Chatbot: *${on ? 'ON' : 'OFF'}*\n👥 Groups: *${expertGet(ns, 'chatbot:groups', 'all')}*\n🌍 Language: *${expertGet(ns, 'chatbot:lang', 'auto')}*\n\n` +
      `${z.prefix}chatbot on | off\n${z.prefix}chatbot groups all|mention|off\n${z.prefix}chatbot lang <language|auto>`
    )
  }
}
