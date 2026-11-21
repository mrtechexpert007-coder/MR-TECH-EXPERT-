// ⟦EXPERT⟧ .checkwa — WhatsApp number check via the bot's own socket
// Uses z.sock.onWhatsApp() — no external API needed.

async function ownerOnly(z) {
  return !!z.isOwner
}

// Normalize any input (mention, reply context, raw number) to a bare number
function extractNumber(z) {
  // 1. Direct arg
  let raw = (z.args?.[0] || '').trim()

  // 2. If no arg, try mention
  if (!raw) {
    const ctx = z.msg?.message?.extendedTextMessage?.contextInfo
    raw = ctx?.mentionedJid?.[0] || ctx?.participant || ''
  }

  // 3. If still nothing, try quoted sender
  if (!raw) {
    const ctx = z.msg?.message?.extendedTextMessage?.contextInfo
    raw = ctx?.participant || ''
  }

  if (!raw) return null

  // Strip everything except digits
  const digits = String(raw).replace(/[^0-9]/g, '')
  if (!digits) return null
  if (digits.length < 8 || digits.length > 15) return null

  return digits
}

export default {
  name: 'checkwa',
  aliases: ['wacheck', 'validwa', 'onwa'],
  desc: 'Check if a phone number has WhatsApp (via socket)',
  async run(z) {
    await z.react('🔍').catch(() => {})

    try {
      const number = extractNumber(z)

      if (!number) {
        return z.reply(
          `🔍 *WHATSAPP NUMBER CHECK*\n\n` +
          `*Usage:*\n` +
          `• ${z.prefix}checkwa 2348012345678\n` +
          `• ${z.prefix}checkwa @user\n` +
          `• Reply to a message with ${z.prefix}checkwa\n\n` +
          `_Include country code, no + or spaces._`
        )
      }

      await z.reply(`🔍 *Checking ${number}...*`)

      // ─── The core call ───
      const results = await z.sock.onWhatsApp(number)

      if (!Array.isArray(results) || results.length === 0) {
        return z.reply(
          `🔍 *WHATSAPP CHECK*\n\n` +
          `📱 *Number:* ${number}\n` +
          `❌ *Not on WhatsApp* (no record)`
        )
      }

      const hit = results[0]
      const exists = !!hit?.exists
      const jid = hit?.jid || `${number}@s.whatsapp.net`

      // ─── If it exists, try to fetch profile info ───
      let name = null
      let pic = null
      if (exists) {
        try {
          const contact = await z.sock.getBusinessProfile?.(jid).catch(() => null)
          if (contact?.name) name = contact.name
        } catch {}
        try {
          pic = await z.sock.profilePictureUrl(jid, 'image').catch(() => null)
        } catch {}
      }

      // ─── Build output ───
      let out = `🔍 *WHATSAPP CHECK*\n\n`
      out += `📱 *Number:* ${number}\n`
      out += `✅ *Exists:* ${exists ? 'YES' : 'NO'}\n`
      if (exists) out += `🆔 *JID:* ${jid}\n`
      if (name) out += `👤 *Name:* ${name}\n`

      // ─── If profile pic available, send with image ───
      if (pic) {
        try {
          await z.sock.sendMessage(z.jid, {
            image: { url: pic },
            caption: out
          }, { quoted: z.msg })
          await z.react('✅').catch(() => {})
          return
        } catch {}
      }

      await z.reply(out)
      await z.react('✅').catch(() => {})
    } catch (e) {
      console.error('[checkwa]', e)
      await z.reply(`❌ *Check failed*\n${e.message}`)
      await z.react('❌').catch(() => {})
    }
  }
}
