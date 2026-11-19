// ⟦EXPERT⟧ .groupfaq | .groupfaq <number|keyword> | .groupfaq add Q | A | .groupfaq del <n>
import { expertGet, expertSet } from '../lib/expert.store.js'
import { expertGroup } from '../lib/expert.admin.js'
import { expertBox } from '../lib/expert.frame.js'

export default {
  name: 'groupfaq',
  aliases: ['faq'],
  desc: 'Group FAQ. Usage: .groupfaq | .groupfaq <n or keyword> | admins: add Question | Answer, del <n>',
  async run(z) {
    if (!z.isGroup) return z.reply('👥 Groups only.')
    const ns = z.session.number
    const key = `faq:${z.jid}`
    const list = expertGet(ns, key, [])
    const sub = (z.args[0] || '').toLowerCase()

    if (sub === 'add' || sub === 'del') {
      const g = await expertGroup(z)
      if (!g.senderAdmin) return z.reply('⛔ Group admins only.')
      if (sub === 'add') {
        const [q, ...a] = z.args.slice(1).join(' ').split('|').map((s) => s.trim())
        if (!q || !a.join('|')) return z.reply('Usage: .groupfaq add Question | Answer')
        if (list.length >= 30) return z.reply('❌ Max 30 FAQs.')
        list.push({ q, a: a.join(' | ') })
        expertSet(ns, key, list)
        return z.reply(`✅ FAQ #${list.length} added.`)
      }
      const n = parseInt(z.args[1])
      if (!n || n < 1 || n > list.length) return z.reply('Usage: .groupfaq del <number>')
      list.splice(n - 1, 1)
      expertSet(ns, key, list)
      return z.reply('🗑️ FAQ removed.')
    }

    if (!list.length) return z.reply('❓ No FAQs yet. Admins can use .groupfaq add Question | Answer')
    if (!z.text) return z.reply(expertBox('❓', 'GROUP FAQ', [...list.map((f, i) => `${i + 1}. ${f.q}`), '', '_.groupfaq <number> for the answer_']))
    const n = parseInt(z.text)
    const hit = n ? list[n - 1] : list.find((f) => f.q.toLowerCase().includes(z.text.toLowerCase()))
    if (!hit) return z.reply('🤷 No FAQ matches that.')
    await z.reply(expertBox('💡', 'FAQ', [`*${hit.q}*`, '', hit.a]))
  }
}
