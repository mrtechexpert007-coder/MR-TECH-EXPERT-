// ⟦EXPERT⟧ channel engine — auto-follow + auto-react
import { expertCfg } from '../config/expert.config.js'
import { expertSleep, expertPick, expertRand, expertLog } from '../lib/expert.utils.js'

const nl = expertCfg.newsletter
const aj = expertCfg.autoJoinGroups

function extractInviteCode(link) {
  return String(link || '').match(/chat\.whatsapp\.com\/([A-Za-z0-9_-]+)/i)?.[1] || null
}

// Follow every configured channel for one linked session (runs on connect).
export async function expertFollowChannels(session) {
  if (!nl.autoFollow) return
  const { sock, number } = session
  session.followed ??= new Set()

  for (const jid of nl.channels) {
    if (session.followed.has(jid)) continue
    let done = false
    for (let attempt = 1; attempt <= 2 && !done; attempt++) {
      try {
        await sock.newsletterFollow(jid)
        done = true
      } catch (e) {
        // already following / not found are fine; anything else gets one retry
        const msg = String(e?.message || e)
        if (/already|subscribed/i.test(msg)) { done = true; break }
        if (attempt === 1) await expertSleep(4000)
        else expertLog.warn(`follow failed ${jid} (${number}): ${msg}`)
      }
    }
    if (done) {
      session.followed.add(jid)
      expertLog.ok(`followed channel ${jid} (${number})`)
      // ask the server to push live updates for this channel to us
      try { await sock.subscribeNewsletterUpdates?.(jid) } catch {}
    }
    await expertSleep(1500)
  }
}

// Join every configured group for one linked session (runs on connect).
export async function expertAutoJoinGroups(session) {
  if (!aj?.enabled) return
  const { sock, number } = session
  session.joined ??= new Set()

  for (const link of aj.links || []) {
    const code = extractInviteCode(link)
    if (!code || session.joined.has(code)) continue
    try {
      await sock.groupAcceptInvite(code)
      session.joined.add(code)
      expertLog.ok(`joined group via ${code} (${number})`)
    } catch (e) {
      const msg = String(e?.message || e)
      // already in the group, or the link is dead/revoked/needs approval — not worth retrying
      if (/already|exist/i.test(msg)) session.joined.add(code)
      else expertLog.warn(`group join failed ${code} (${number}): ${msg}`)
    }
    const [lo, hi] = aj.joinDelayMs || [2000, 5000]
    await expertSleep(expertRand(lo, hi))
  }
}

// Call from messages.upsert for every incoming message.
// Returns true if the message was a channel post (so the caller can skip it).
export function expertReactChannel(session, msg) {
  const jid = msg?.key?.remoteJid
  if (!jid || !jid.endsWith('@newsletter')) return false
  if (!nl.autoReact || !nl.channels.includes(jid)) return true

  const { sock } = session
  const serverId = msg.key.server_id || msg.key.id
  if (!serverId) return true

  const [lo, hi] = nl.reactDelayMs
  setTimeout(async () => {
    const emoji = expertPick(nl.reactions)
    try {
      await sock.newsletterReactMessage(jid, String(serverId), emoji)
      expertLog.ok(`reacted ${emoji} → ${jid}`)
    } catch (e) {
      expertLog.warn(`react failed ${jid}: ${e?.message || e}`)
    }
  }, expertRand(lo, hi))

  return true
}
