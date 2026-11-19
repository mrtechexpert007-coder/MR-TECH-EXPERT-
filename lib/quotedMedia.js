import { downloadContentFromMessage } from '@rennzsync/baileys'

const WRAP = [
  'ephemeralMessage',
  'viewOnceMessage',
  'viewOnceMessageV2',
  'viewOnceMessageV2Extension',
  'documentWithCaptionMessage'
]

export function unwrapMessage(message) {
  let cur = message
  for (let i = 0; i < 6 && cur; i++) {
    const w = WRAP.find((k) => cur[k]?.message)
    if (w) {
      cur = cur[w].message
      continue
    }
    break
  }
  return cur || {}
}

export function findMedia(message) {
  const inner = unwrapMessage(message)
  const type = [
    'imageMessage',
    'videoMessage',
    'audioMessage',
    'stickerMessage',
    'documentMessage'
  ].find((k) => inner[k])
  if (!type) return null
  return { type, msg: inner[type], mediaType: type.replace('Message', '').toLowerCase() }
}

export function getTargetMessage(expert) {
  const ctx =
    expert.msg.message?.extendedTextMessage?.contextInfo ||
    expert.msg.message?.imageMessage?.contextInfo ||
    expert.msg.message?.videoMessage?.contextInfo
  if (ctx?.quotedMessage) return ctx.quotedMessage
  return expert.msg.message
}

export async function downloadQuotedMedia(expert) {
  const target = getTargetMessage(expert)
  const found = findMedia(target)
  if (!found) throw new Error('Reply to an image, video, audio, sticker or document')
  const stream = await downloadContentFromMessage(found.msg, found.mediaType)
  const chunks = []
  for await (const c of stream) chunks.push(c)
  const buffer = Buffer.concat(chunks)
  if (!buffer.length) throw new Error('Downloaded media is empty')
  return {
    buffer,
    type: found.type,
    mediaType: found.mediaType,
    mimetype: found.msg.mimetype || '',
    meta: found.msg
  }
}
