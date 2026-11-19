// ⟦EXPERT⟧ .grouprestore — restore the last .groupbackup of this group (admins; bot must be admin)
import { expertGet, expertSet } from '../lib/expert.store.js'
import { expertGuard } from '../lib/expert.admin.js'
import { expertFmt, expertTz } from '../lib/expert.activity.js'
import { expertBox } from '../lib/expert.frame.js'

export default {
  name: 'grouprestore',
  desc: 'Restore the last group backup (name, description, locks, bot settings)',
  async run(z) {
    const g = await expertGuard(z)
    if (!g) return
    const ns = z.session.number
    const b = expertGet(ns, `gbackup:${z.jid}`, null)
    if (!b) return z.reply('💾 No backup found. Create one with .groupbackup')
    const done = []
    const failed = []
    const attempt = async (label, fn) => { try { await fn(); done.push(label) } catch { failed.push(label) } }
    if (b.subject && b.subject !== g.meta.subject) await attempt('name', () => z.sock.groupUpdateSubject(z.jid, b.subject))
    if ((b.desc || '') !== (g.meta.desc || '')) await attempt('description', () => z.sock.groupUpdateDescription(z.jid, b.desc || undefined))
    if (b.announce !== !!g.meta.announce) await attempt('chat lock', () => z.sock.groupSettingUpdate(z.jid, b.announce ? 'announcement' : 'not_announcement'))
    if (b.restrict !== !!g.meta.restrict) await attempt('info lock', () => z.sock.groupSettingUpdate(z.jid, b.restrict ? 'locked' : 'unlocked'))
    for (const [k, v] of Object.entries(b.data || {})) expertSet(ns, k, v)
    done.push(`${Object.keys(b.data || {}).length} bot settings`)
    await z.reply(expertBox('♻️', 'GROUP RESTORED', [
      `From backup of ${expertFmt(b.at, expertTz(ns, z.jid))}`,
      `✅ ${done.join(', ')}`,
      ...(failed.length ? [`❌ Failed: ${failed.join(', ')}`] : [])
    ]))
  }
}
