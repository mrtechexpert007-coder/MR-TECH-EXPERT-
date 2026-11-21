// ⟦EXPERT⟧ .note add <text> | list | del <n> | clear — private notes for this linked account
import { expertGet, expertSet } from '../lib/expert.store.js'

export default {
  name: 'note',
  aliases: ['notes'],
  owner: true,
  desc: 'Save quick notes. Usage: .note add buy data',
  async run(z) {
    const ns = z.session.number
    const notes = expertGet(ns, 'notes', [])
    const sub = (z.args[0] || 'list').toLowerCase()
    const rest = z.args.slice(1).join(' ').trim()
    if (sub === 'add' && rest) {
      if (notes.length >= 100) return z.reply('❌ Note limit reached (100).')
      expertSet(ns, 'notes', [...notes, rest.slice(0, 500)])
      return z.reply(`📝 Saved as note #${notes.length + 1}.`)
    }
    if (sub === 'del' && /^\d+$/.test(rest)) {
      const i = Number(rest) - 1
      if (!notes[i]) return z.reply('❌ No such note.')
      expertSet(ns, 'notes', notes.filter((_, k) => k !== i))
      return z.reply('🗑️ Deleted.')
    }
    if (sub === 'clear') { expertSet(ns, 'notes', []); return z.reply('🗑️ All notes cleared.') }
    await z.reply(notes.length ? `📝 *Notes*\n\n${notes.map((n, i) => `${i + 1}. ${n}`).join('\n')}` : 'No notes yet. Use .note add <text>')
  }
}
