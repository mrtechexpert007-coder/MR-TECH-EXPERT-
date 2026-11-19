// ⟦EXPERT⟧ .chpost — post text / image / video / audio to a WhatsApp channel you own or admin
//   .chpost <text>                         → post text to your default channel (POST_CHANNEL env)
//   .chpost <channel link> <text>          → post text to a specific channel
//   (reply to image/video/audio) .chpost [caption]  → post that media
import { findMedia, getTargetMessage, downloadQuotedMedia } from '../lib/quotedMedia.js'

const CHANNEL_LINK = /whatsapp\.com\/channel\/([A-Za-z0-9_-]+)/i
const JID = /^\d+@newsletter$/i

async function resolveChannel(expert, ref) {
  if (ref && JID.test(ref)) return { jid: ref, name: ref }
  const code = ref && (ref.match(CHANNEL_LINK) || [])[1]
  if (code) {
    const meta = await expert.sock.newsletterMetadata('invite', code)
    if (!meta?.id) throw new Error('Channel not found. Check the link.')
    return { jid: meta.id, name: meta.name || meta.id }
  }
  const def = process.env.POST_CHANNEL
  if (def) return resolveChannel(expert, def.trim())
  return null
}

export default {
  name: 'chpost',
  aliases: ['channelpost', 'postch'],
  desc: 'Post to your WhatsApp channel',
  owner: true,
  async run(expert) {
    const args = expert.text.trim().split(/\s+/).filter(Boolean)
    const ref = args.find((a) => CHANNEL_LINK.test(a) || JID.test(a))
    let text = args.filter((a) => a !== ref).join(' ').trim()

    const target = getTargetMessage(expert)
    const media = findMedia(target)

    // nothing typed and no media → maybe a replied text message
    if (!text && !media) {
      const inner = target?.ephemeralMessage?.message || target || {}
      text = (inner.conversation || inner.extendedTextMessage?.text || '').trim()
    }

    if (!text && !media) {
      return expert.reply(
        '📢 *Usage*\n`.chpost <text>` — post text to your default channel\n`.chpost <channel link> <text>` — post to a specific channel\nReply to an image / video / audio with `.chpost [caption]` to post media\n\nSet a default channel with the `POST_CHANNEL` config var (a channel link or its @newsletter id).'
      )
    }

    await expert.react('📢').catch(() => {})
    try {
      const ch = await resolveChannel(expert, ref)
      if (!ch) {
        return expert.reply('❌ No channel given. Add a channel link to the command, or set the `POST_CHANNEL` config var.')
      }

      let payload
      if (media) {
        const m = await downloadQuotedMedia(expert)
        if (m.mediaType === 'image') payload = { image: m.buffer, caption: text }
        else if (m.mediaType === 'video') payload = { video: m.buffer, mimetype: m.mimetype || 'video/mp4', caption: text }
        else if (m.mediaType === 'audio') payload = { audio: m.buffer, mimetype: m.mimetype || 'audio/mpeg' }
        else throw new Error('Only text, image, video and audio can be posted to a channel')
      } else {
        payload = { text }
      }

      await expert.sock.sendMessage(ch.jid, payload)
      await expert.reply(`✅ Posted to *${ch.name}*`)
      await expert.react('✅').catch(() => {})
    } catch (e) {
      console.error('[chpost]', e)
      const msg = String(e?.message || e)
      const hint = /forbidden|not-authorized|403|401/i.test(msg) ? '\nOnly the channel owner or an admin can post.' : ''
      await expert.reply(`❌ *Post failed*\n${msg.slice(0, 300)}${hint}`)
      await expert.react('❌').catch(() => {})
    }
  }
}
