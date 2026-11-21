// ⟦EXPERT⟧ .groupbackup — save this group's name, description, settings and bot data (admins)
import { expertGet, expertSet } from '../lib/expert.store.js'
import { expertGuard } from '../lib/expert.admin.js'
import { expertFmt, expertTz } from '../lib/expert.activity.js'
import { expertBox } from '../lib/expert.frame.js'

export const EXPERT_BACKUP_KEYS = (gid) => ['welcome', 'goodbye', 'notice', 'faq', 'anotes', 'events', 'bday', 'tz', 'slow', 'only', 'vk'].map((k) => `${k}:${gid}`)

export default {
  name: 'groupbackup',
  desc: 'Save the group name, description, lock settings and bot data. Restore with .grouprestore',
  async run(z) {
    const g = await expertGuard(z)
    if (!g) return
    const ns = z.session.number
    const data = {}
    for (const k of EXPERT_BACKUP_KEYS(z.jid)) { const v = expertGet(ns, k, undefined); if (v !== undefined && v !== null) data[k] = v }
    expertSet(ns, `gbackup:${z.jid}`, {
      at: Date.now(),
      subject: g.meta.subject,
      desc: g.meta.desc || '',
      announce: !!g.meta.announce,
      restrict: !!g.meta.restrict,
      data
    })
    await z.reply(expertBox('💾', 'GROUP BACKUP SAVED', [
      `*${g.meta.subject}*`,
      `📦 ${Object.keys(data).length} bot setting${Object.keys(data).length === 1 ? '' : 's'} + name, description, locks`,
      `🕒 ${expertFmt(Date.now(), expertTz(ns, z.jid))}`,
      '_Restore any time with .grouprestore_'
    ]))
  }
}
