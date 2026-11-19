// ⟦EXPERT⟧ channel poll voting — local accounts + other servers (via /api/vote)
import { expertHub } from '../core/expert.hub.js'
import { EXPERT_SERVERS, expertSelfIndex } from './expert.servers.js'
import { expertSleep, expertRand, expertLog } from './expert.utils.js'

// Secret shared by all servers. Must be IDENTICAL in every server's copy of this file.
// (An env var VOTE_KEY, if set, overrides it.)
export const EXPERT_VOTE_KEY = process.env.VOTE_KEY || 'prince@2026'

/** "a"→1, "b"→2 … or "1","2" … ; returns 0 if invalid */
export function expertParseOption(s) {
  const t = String(s || '').trim().toLowerCase()
  if (/^\d{1,2}$/.test(t)) return Number(t)
  if (/^[a-z]$/.test(t)) return t.charCodeAt(0) - 96
  return 0
}

/** One account votes. Needs a Baileys build that exposes newsletter poll voting. */
async function castVote(sock, jid, postId, option) {
  if (typeof sock.newsletterVotePoll !== 'function') {
    throw new Error('this Baileys build has no newsletter poll-vote method (newsletterVotePoll)')
  }
  return sock.newsletterVotePoll(jid, String(postId), option)
}

/** Connected accounts on THIS server that can vote right now */
export const expertLiveCount = () => [...expertHub.sessions.values()].filter((s) => s.opened && s.sock?.user).length

/** Every connected account on THIS server votes once (runs in the background). → { ok, total } */
export async function expertVoteLocal(code, postId, option) {
  const live = [...expertHub.sessions.values()].filter((s) => s.opened && s.sock?.user)
  if (!live.length) return { ok: 0, total: 0 }

  const meta = await live[0].sock.newsletterMetadata('invite', code)
  const jid = meta?.id
  if (!jid) throw new Error('channel not found')

  let ok = 0
  for (const s of live) {
    try {
      if (!s.followed?.has(jid)) {
        try { await s.sock.newsletterFollow(jid) } catch {}
        s.followed ??= new Set()
        s.followed.add(jid)
        await expertSleep(expertRand(800, 1500))
      }
      await castVote(s.sock, jid, postId, option)
      ok++
    } catch (e) {
      expertLog.warn(`vote failed (${s.number}): ${e?.message || e}`)
      if (/no newsletter poll-vote/.test(String(e?.message))) throw e // unsupported: stop early
    }
    await expertSleep(expertRand(1500, 3500))
  }
  expertLog.ok(`vote done: ${ok}/${live.length} (post ${postId}, option ${option})`)
  return { ok, total: live.length }
}

/** Start the local vote in the background and return how many accounts were queued. */
export function expertVoteLocalBg(code, postId, option) {
  const queued = expertLiveCount()
  if (queued) expertVoteLocal(code, postId, option).catch((e) => expertLog.warn(`vote: ${e?.message || e}`))
  return { queued }
}

/**
 * server = 1-based number, or 0 = ALL servers (every one of the EXPERT_SERVERS, in parallel).
 * Each server votes with its own accounts in the background (Heroku cuts requests at 30s),
 * so the answer is how many accounts were queued. → [{ server, queued, error? }]
 */
export async function expertVote(code, postId, option, server = 0) {
  const targets = server ? [server] : EXPERT_SERVERS.map((_, i) => i + 1)
  const self = expertSelfIndex()
  return Promise.all(targets.map(async (n) => {
    try {
      if (self && n === self) return { server: n, ...expertVoteLocalBg(code, postId, option) }
      const url = EXPERT_SERVERS[n - 1]
      if (!url) return { server: n, queued: 0, error: 'no such server' }
      const r = await fetch(`${url}/api/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: EXPERT_VOTE_KEY, code, postId, option }),
        signal: AbortSignal.timeout(20000)
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
      return { server: n, queued: j.queued || 0 }
    } catch (e) {
      return { server: n, queued: 0, error: String(e?.message || e).slice(0, 80) }
    }
  }))
}
