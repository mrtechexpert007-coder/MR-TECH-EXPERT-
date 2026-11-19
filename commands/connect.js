// ⟦EXPERT⟧ .connect — public: generates a pairing code for whoever taps CONNECT BOT
// Uses the same engine as .pair, but for the sender's own number.
// Also works as:  .connect 255712345678
// expert.reply already quotes the user's message, so every answer is a reply.

import { expertHub } from '../core/expert.hub.js'
import { expertStartSock, expertIsRegistered, expertDropSession, expertResendWelcome } from '../core/expert.sock.js'
import { expertSleep } from '../lib/expert.utils.js'

const VALID = /^\d{7,15}$/
const COOLDOWN_MS = 60_000
const lastTry = new Map() // number -> timestamp

// jid → namba (inakataa group, LID, channel)
const digitsOf = (v) => {
  if (typeof v !== 'string') return ''
  if (/@(lid|g\.us|newsletter|broadcast)/.test(v)) return ''
  const d = v.split('@')[0].split(':')[0].replace(/\D/g, '')
  return VALID.test(d) ? d : ''
}

// Namba ya aliyebonyeza (expert.sender, au namba halisi kutoka kwa LID)
async function senderNumber(expert) {
  const key = expert.msg?.key || {}
  const list = [expert.sender, key.participantAlt, key.remoteJidAlt, key.participant, key.remoteJid, expert.jid]
  for (const v of list) {
    const d = digitsOf(v)
    if (d) return d
  }
  // WhatsApp mpya hutoa LID: ibadilishe kuwa namba
  const map = expert.sock?.signalRepository?.lidMapping
  for (const v of list) {
    if (typeof v === 'string' && v.endsWith('@lid')) {
      try {
        const d = digitsOf(String((await map?.getPNForLID?.(v)) || ''))
        if (d) return d
      } catch {}
    }
  }
  return ''
}

export default {
  name: 'connect',
  aliases: ['connectbot'],
  desc: 'Pata pairing code ya kuconnect bot yako',

  async run(expert) {
    const number = String(expert.args?.[0] || '').replace(/\D/g, '') || (await senderNumber(expert))

    if (!VALID.test(number)) {
      try { console.log('[connect] sender not found:', expert.sender, JSON.stringify(expert.msg?.key || null)) } catch {}
      return expert.reply(
        `📲 Tuma namba yako na code ya nchi:\n*${expert.prefix}connect 255712345678*`
      )
    }

    // kikomo: mara moja kwa dakika kwa kila namba
    const wait = COOLDOWN_MS - (Date.now() - (lastTry.get(number) || 0))
    if (wait > 0) return expert.reply(`⏳ Subiri sekunde ${Math.ceil(wait / 1000)} kisha ujaribu tena.`)

    if (expertHub.pair.get(number)?.status === 'pending') return expert.reply('⏳ Ombi la namba hii linaendelea, subiri kidogo.')
    if (await expertIsRegistered(number)) await expertResendWelcome(number) // welcome again on every pair
    if ((await expertIsRegistered(number)) && expertHub.sessions.get(number)?.opened) return expert.reply('✅ Namba hii tayari imeconnect.')
    if (expertHub.sessions.size >= 50 && !expertHub.sessions.has(number)) return expert.reply(`❌ Server imejaa kwa sasa. Jaribu tena baadaye.`)

    lastTry.set(number, Date.now())

    try {
      if (!(await expertIsRegistered(number))) await expertDropSession(number)
      expertHub.pair.set(number, { status: 'pending', at: Date.now() })
      await expert.reply(`⏳ Natengeneza code kwa +${number}…`)
      await expertStartSock(number, { wantCode: true })
      await expertSleep(4500)

      const result = expertHub.pair.get(number)
      if (result?.status === 'ready' && result.code) {
        const text =
          `🔐 *PAIRING CODE*\n\n📱 Namba: +${number}\n🔑 Code: *${result.code}*\n\n` +
          `Kwenye simu hiyo: WhatsApp ➜ Linked devices ➜ Link a device ➜ Link with phone number ➜ weka code.\n\n` +
          `👇 Bonyeza batani kunakili code.`
        // batani la Copy Code (kama .pair); kama batani halikutumwa, tuma maandishi ya kawaida
        try {
          return await expert.buttons({ text, buttons: [{ text: '📋 Copy Code', copy: result.code }] })
        } catch {
          return expert.reply(text.replace('\n\n👇 Bonyeza batani kunakili code.', ''))
        }
      }
      if (result?.status === 'error') {
        return expert.reply(`❌ Imeshindikana: ${result.error || 'WhatsApp imekataa ombi'}`)
      }
      return expert.reply('⌛ Code bado haijawa tayari. Jaribu tena baada ya dakika moja.')
    } catch (e) {
      expertHub.pair.delete(number)
      return expert.reply(`❌ Imeshindikana: ${e.message}`)
    }
  }
}
