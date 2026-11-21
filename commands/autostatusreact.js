// ⟦EXPERT⟧ .autostatusreact — auto-view and react to every WhatsApp status your contacts post.
//   .autostatusreact            → toggle on/off
//   .autostatusreact on | off   → set explicitly
//   .autostatusreact emoji ❤️ 🔥 😂  → pick the emojis to use (random one per status)
//   .autostatusreact emoji reset     → back to defaults
//   .autostatusreact status          → show current config
import { expertGet, expertSet } from '../lib/expert.store.js'

export const EXPERT_STATUS_EMOJIS = ['❤️', '🔥', '😍', '💯', '✨', '👏', '😂', '🙌']
const EMOJI_RE = /\p{Extended_Pictographic}/u

export default {
  name: 'autostatusreact',
  aliases: ['autoreactstatus', 'statusreact', 'asr'],
  desc: 'Auto-view & react to contacts\' WhatsApp statuses',
  owner: true,
  async run(z) {
    const ns = z.session.number
    const sub = (z.args[0] || '').toLowerCase()
    const enabled = expertGet(ns, 'autostatusreact', false)
    const emojis = expertGet(ns, 'autostatusreact:emojis', EXPERT_STATUS_EMOJIS)
    const p = z.prefix || ''

    if (sub === 'status' || sub === 'info') {
      return z.reply(
        `👁️ *Auto Status React*\n\nState: *${enabled ? 'ON 🟢' : 'OFF ⚪'}*\nEmojis: ${emojis.join(' ')}\n\n` +
        `_${p}autostatusreact on|off_\n_${p}autostatusreact emoji ❤️ 🔥 😂_\n_${p}autostatusreact emoji reset_`
      )
    }

    if (sub === 'emoji' || sub === 'emojis') {
      const rest = z.args.slice(1)
      if (!rest.length) return z.reply(`Current emojis: ${emojis.join(' ')}\nUsage: ${p}autostatusreact emoji ❤️ 🔥 😂\nReset: ${p}autostatusreact emoji reset`)
      if (/^(reset|default)$/i.test(rest[0])) {
        expertSet(ns, 'autostatusreact:emojis', EXPERT_STATUS_EMOJIS)
        return z.reply(`♻️ Status reaction emojis reset: ${EXPERT_STATUS_EMOJIS.join(' ')}`)
      }
      // accept emojis separated by spaces or stuck together
      const picked = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(rest.join(' '))]
        .map((s) => s.segment).filter((g) => EMOJI_RE.test(g))
      const unique = [...new Set(picked)].slice(0, 12)
      if (!unique.length) return z.reply('❌ I couldn\'t find any emojis in that. Example: .autostatusreact emoji ❤️ 🔥 😂')
      expertSet(ns, 'autostatusreact:emojis', unique)
      return z.reply(`✅ Status reaction emojis set: ${unique.join(' ')}`)
    }

    const next = sub === 'on' ? true : sub === 'off' ? false : !enabled
    expertSet(ns, 'autostatusreact', next)
    await z.reply(
      `👁️ Auto Status React is now *${next ? 'ON' : 'OFF'}*.\n` +
      (next ? `New statuses will be viewed and reacted to with: ${emojis.join(' ')}` : 'Statuses will no longer be auto-reacted to.')
    )
  }
}
