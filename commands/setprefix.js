// ⟦EXPERT⟧ Set a per-linked-account command prefix. Use "null" to disable it.
import { expertGet, expertSet } from '../lib/expert.store.js'

export default {
  name: 'setprefix',
  aliases: ['prefix'],
  desc: 'Change command prefix; use null for no prefix',
  owner: true,
  async run(expert) {
    const requested = (expert.args[0] || '').trim()
    if (!requested) {
      const current = expertGet(expert.session.number, 'prefix', undefined)
      const display = current === '' ? '(no prefix)' : current || '. ! # / (default prefixes)'
      return expert.reply(`⚙️ Current prefix: ${display}\nUsage: ${expert.prefix || ''}setprefix <prefix|null>\nExample: .setprefix null`)
    }

    const value = /^(null|none|off)$/i.test(requested) ? '' : requested
    if (value.length > 5 || /\s/.test(value)) {
      return expert.reply('❌ Prefix must be 1–5 characters with no spaces, or use null to disable it.')
    }

    expertSet(expert.session.number, 'prefix', value)
    if (value === '') {
      return expert.reply('✅ Prefix disabled. You can now type commands without a prefix, for example: ping')
    }
    return expert.reply(`✅ Prefix changed to: ${value}\nExample: ${value}ping`)
  }
}
