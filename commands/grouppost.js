// ⟦EXPERT⟧ .grouppost — post text and/or media to the *Group Status* of the group(s) YOU choose. Owner only.
//   .grouppost list                       → numbered list of your groups
//   .grouppost 3 <text>                   → post to group #3
//   .grouppost 1,4,7 <text>               → post to several groups
//   .grouppost Global Squad | <text>      → post to the group whose name matches
//   .grouppost here <text>                → post to the group you're in
//   .grouppost all <text>                 → post to every group
// Attach or reply to an image, video or audio to post media (text becomes the caption; audio has no caption, so text is posted as a separate status).
import { expertGetMedia, expertQuoted, expertCtx } from '../lib/expert.admin.js'
import { expertSleep, expertRand } from '../lib/expert.utils.js'
import { expertFont, EXPERT_BRAND } from '../lib/expert.frame.js'
import { expertGenContent, expertGenMsg } from '../core/expert.baileys.js'
import { randomBytes } from 'node:crypto'

const USAGE = (p) =>
  `📢 *${expertFont('GROUPPOST')}*\n\n` +
  `${p}grouppost list\n` +
  `${p}grouppost 3 <text>\n` +
  `${p}grouppost 1,4,7 <text>\n` +
  `${p}grouppost Group Name | <text>\n` +
  `${p}grouppost here <text>\n` +
  `${p}grouppost all <text>\n\n` +
  `_Attach or reply to an image, video or audio to post media. Run ${p}grouppost list to see group numbers._`

async function sortedGroups(sock) {
  const all = Object.values(await sock.groupFetchAllParticipating())
  return all
    .map((g) => ({ id: g.id, name: g.subject || 'Unnamed group', size: g.participants?.length || 0 }))
    .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
}

export default {
  name: 'grouppost',
  aliases: ['gpost'],
  owner: true,
  desc: 'Post text/media to chosen group(s): .grouppost list | 3 text | Name | text | here text | all text',
  async run(z) {
    const raw = z.text.trim()
    if (!raw && !hasMedia(z)) return z.reply(USAGE(z.prefix))

    const groups = await sortedGroups(z.sock)
    if (!groups.length) return z.reply('Not in any groups.')

    // ── list ──
    if (/^list$/i.test(raw)) {
      const rows = groups.map((g, i) => `${i + 1}. ${g.name} (${g.size})`)
      return z.reply(`👥 *${expertFont('YOUR GROUPS')}* (${groups.length})\n\n${rows.join('\n')}\n\n_${z.prefix}grouppost <number> <text>_`)
    }

    // ── split "selector" from "caption" ──
    let selector = ''
    let caption = ''
    if (raw.includes('|')) {
      const i = raw.indexOf('|')
      selector = raw.slice(0, i).trim()
      caption = raw.slice(i + 1).trim()
    } else {
      const first = raw.split(/\s+/)[0] || ''
      if (/^(all|here)$/i.test(first) || /^\d+(,\d+)*$/.test(first) || /@g\.us$/.test(first)) {
        selector = first
        caption = raw.slice(first.length).trim()
      }
    }
    if (!selector) return z.reply(`⚠️ Tell me which group.\n\n${USAGE(z.prefix)}`)

    // ── resolve targets ──
    let targets = []
    const sel = selector.toLowerCase()
    if (sel === 'all') targets = groups
    else if (sel === 'here') {
      if (!z.isGroup) return z.reply('👥 "here" only works inside a group.')
      targets = [groups.find((g) => g.id === z.jid) || { id: z.jid, name: 'this group' }]
    } else if (/^\d+(,\d+)*$/.test(selector)) {
      const nums = [...new Set(selector.split(',').map(Number))]
      const bad = nums.filter((n) => n < 1 || n > groups.length)
      if (bad.length) return z.reply(`❌ No group number ${bad.join(', ')}. Run ${z.prefix}grouppost list (1–${groups.length}).`)
      targets = nums.map((n) => groups[n - 1])
    } else if (/@g\.us$/.test(selector)) {
      targets = groups.filter((g) => g.id === selector)
    } else {
      const exact = groups.filter((g) => g.name.toLowerCase() === sel)
      targets = exact.length ? exact : groups.filter((g) => g.name.toLowerCase().includes(sel))
      if (targets.length > 1) {
        const rows = targets.map((g) => `${groups.indexOf(g) + 1}. ${g.name}`)
        return z.reply(`🔎 More than one group matches "${selector}":\n\n${rows.join('\n')}\n\nUse the number instead: ${z.prefix}grouppost <number> <text>`)
      }
    }
    if (!targets.length) return z.reply(`❌ No group found for "${selector}". Run ${z.prefix}grouppost list.`)

    // ── media + body ──
    let media = null
    if (hasMedia(z)) media = await expertGetMedia(z)
    if (!caption && !media) return z.reply(`⚠️ Nothing to post — add text, or attach/reply to an image, video or audio.\n\n${USAGE(z.prefix)}`)

    const body = caption ? `${caption}\n\n${EXPERT_BRAND}` : EXPERT_BRAND

    const many = targets.length > 1
    await z.reply(`📤 Posting group status to ${many ? `${targets.length} groups` : `*${targets[0].name}*`}…`)

    const done = []
    const failed = []
    for (const g of targets) {
      try {
        if (media?.type === 'imageMessage') await postGroupStatus(z.sock, g.id, { image: media.buffer, caption: body })
        else if (media?.type === 'videoMessage') await postGroupStatus(z.sock, g.id, { video: media.buffer, caption: body })
        else if (media?.type === 'audioMessage') {
          await postGroupStatus(z.sock, g.id, {
            audio: media.buffer,
            mimetype: media.content?.mimetype || 'audio/mp4',
            ptt: !!media.content?.ptt
          })
          // audio can't carry a caption, so any text goes up as its own status right after
          if (caption) await postGroupStatus(z.sock, g.id, { text: body })
        }
        else await postGroupStatus(z.sock, g.id, { text: body })
        done.push(g.name)
      } catch (e) { failed.push(`${g.name} (${e?.message || 'error'})`) }
      if (many) await expertSleep(expertRand(1500, 3500)) // slow on purpose, to avoid WhatsApp flags
    }

    let out = `✅ Group status posted to ${done.length}/${targets.length} group${targets.length === 1 ? '' : 's'}.`
    if (!many && done.length) out = `✅ Group status posted in *${done[0]}*.`
    if (failed.length) out += `\n\n❌ Failed: ${failed.join(', ')}`
    await z.reply(out)
  }
}

// image/video on the command itself, or on the message it replies to
function hasMedia(z) {
  const isMedia = (m) => !!m && Object.keys(m).some((k) => /^(image|video|audio)Message$/.test(k))
  return isMedia(expertQuoted(z)) || isMedia(z.msg.message) || isMedia(expertCtx(z)?.quotedMessage)
}

// Post to a group's *Status* (the WhatsApp Group Status feature) — raw groupStatusMessageV2 relay.
async function postGroupStatus(sock, groupJid, content) {
  if (typeof expertGenContent !== 'function' || typeof expertGenMsg !== 'function') {
    throw new Error('this Baileys fork does not export generateWAMessageContent')
  }
  const inner = await expertGenContent(content, { upload: sock.waUploadToServer })
  const secret = randomBytes(32)
  const msg = expertGenMsg(groupJid, {
    messageContextInfo: { messageSecret: secret },
    groupStatusMessageV2: { message: { ...inner, messageContextInfo: { messageSecret: secret } } }
  }, {})
  await sock.relayMessage(groupJid, msg.message, { messageId: msg.key.id })
}
