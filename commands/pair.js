import { expertHub } from '../core/expert.hub.js'
import { expertStartSock, expertIsRegistered, expertDropSession, expertResendWelcome } from '../core/expert.sock.js'
import { expertSleep } from '../lib/expert.utils.js'

const VALID = /^\d{7,15}$/
export default {
  name: 'pair', aliases: ['paircode'], desc: 'Generate a WhatsApp pairing code for a phone number.',
  async run(expert) {
    const number = String(expert.args[0] || '').replace(/\D/g, '')
    if (!VALID.test(number)) return expert.reply(`📲 Usage: ${expert.prefix}pair <number with country code>\nExample: ${expert.prefix}pair 2348012345678`)
    if (expertHub.pair.get(number)?.status === 'pending') return expert.reply('⏳ A pairing request for this number is already running.')
    if (await expertIsRegistered(number)) await expertResendWelcome(number) // welcome again on every pair
    if ((await expertIsRegistered(number)) && expertHub.sessions.get(number)?.opened) return expert.reply('✅ This number is already paired and connected.')
    if (expertHub.sessions.size >= 50 && !expertHub.sessions.has(number)) return expert.reply('❌ Session limit reached.')
    try {
      if (!(await expertIsRegistered(number))) await expertDropSession(number)
      expertHub.pair.set(number, { status: 'pending', at: Date.now() })
      await expert.reply(`⏳ Requesting pairing code for +${number}…`)
      await expertStartSock(number, { wantCode: true })
      await expertSleep(4500)
      const result = expertHub.pair.get(number)
      if (result?.status === 'ready' && result.code) return expert.buttons({
        text: `🔐 *WhatsApp Pairing Code*\n\n📱 Number: +${number}\n🔑 Code: *${result.code}*\n\nOn that phone, open WhatsApp → Linked devices → Link a device → Link with phone number.\n\n👇 Tap the button to copy the code.`,
        buttons: [{ text: '📋 Copy Code', copy: result.code }]
      })
      if (result?.status === 'error') return expert.reply(`❌ Could not generate a pairing code: ${result.error || 'WhatsApp rejected the request'}`)
      return expert.reply('⌛ Pairing request started, but the code is not ready yet. Try again in a few seconds or use the web pairing page.')
    } catch (e) {
      expertHub.pair.delete(number)
      return expert.reply(`❌ Pairing failed: ${e.message}`)
    }
  }
            }
