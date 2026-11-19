// ⟦EXPERT⟧ .kickall — removes every non-admin member from the group (bot must be admin)
// Safety: group admins/owner only · needs ".kickall confirm" within 60s · admins, owner, sudo and the bot are never removed
import { expertGuard } from '../lib/expert.admin.js'
import { expertNumber } from '../lib/expert.utils.js'
import { expertGet } from '../lib/expert.store.js'
import { expertCfg } from '../config/expert.config.js'
import { expertPIds, expertIsAdm } from '../lib/expert.activity.js'

const pending = new Map() // `${session}:${jid}:${sender}` -> timestamp
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export default {
  name: 'kickall',
  aliases: ['removeall'],
  desc: 'Remove all non-admin members from the group',
  async run(z) {
    const g = await expertGuard(z)
    if (!g) return
    const key = `${z.session.number}:${z.jid}:${expertNumber(z.sender)}`
    const confirm = (z.args[0] || '').toLowerCase() === 'confirm'

    if (!confirm) {
      pending.set(key, Date.now())
      const n = g.meta.participants.length
      return z.reply(`⚠️ This will remove *all non-admin members* (${n} in group, admins/owner/sudo are kept).\n\nTo continue send: *.kickall confirm* (valid 60 seconds).`)
    }
    if (Date.now() - (pending.get(key) || 0) > 60_000) return z.reply('Send *.kickall* first, then *.kickall confirm* within 60 seconds.')
    pending.delete(key)

    const ns = z.session.number
    const keep = new Set([ns, expertCfg.owner, ...expertGet(ns, 'sudo', [])])
    const me = [z.sock.user?.id, z.sock.user?.lid].filter(Boolean).map(expertNumber)
    me.forEach((i) => keep.add(i))

    const targets = g.meta.participants.filter((p) => !expertIsAdm(p) && !expertPIds(p).some((i) => keep.has(i))).map((p) => p.id)
    if (!targets.length) return z.reply('Nobody to remove — everyone left is an admin, owner or sudo.')

    await z.reply(`🧹 Removing *${targets.length}* member(s)…`)
    let ok = 0
    for (let i = 0; i < targets.length; i += 5) {
      try { await z.sock.groupParticipantsUpdate(z.jid, targets.slice(i, i + 5), 'remove'); ok += Math.min(5, targets.length - i) } catch {}
      await sleep(1500) // go slowly so WhatsApp does not rate-limit the account
    }
    await z.reply(ok ? `✅ Removed about *${ok}* of ${targets.length} member(s).` : '❌ Could not remove anyone — make sure the bot is a group admin.')
  }
}
