// ⟦EXPERT⟧ .settings — see every switch for this linked account
import { expertGet } from '../lib/expert.store.js'
import { DEFAULT_ON as CHATBOT_ON } from '../lib/expert.chatbot.js'

const TOGGLES = [
  ['antilink', false], ['antisticker', false], ['antibot', false], ['antigroupstatus', false], ['antitag', false], ['antimention', false], ['antigroupmention', false], ['antibadword', false],
  ['antipromote', false], ['antidemote', false], ['antidelete', false], ['antiedit', false], ['anticall', false],
  ['autoreact', false], ['autoread', false], ['autotyping', false], ['autorecording', false], ['alwaysonline', false], ['autobio', true], ['savestatus', false], ['autoviewstatus', false], ['autolikestatus', false], ['autostatusreact', false], ['viewonce', true], ['chatbot', CHATBOT_ON]
]

export default {
  name: 'settings',
  aliases: ['config', 'status'],
  owner: true,
  desc: 'Show all settings for this account',
  async run(z) {
    const ns = z.session.number
    const p = expertGet(ns, 'prefix', undefined)
    const rows = TOGGLES.map(([k, d]) => `${expertGet(ns, k, d) ? '🟢' : '⚪'} ${k}`)
    await z.reply(
      `⚙️ *Settings*\n\n🔧 Mode: *${z.mode}*\n🔣 Prefix: *${p === '' ? 'none' : p || 'default (. ! # /)'}*\n` +
      `🚫 Banned users: *${expertGet(ns, 'banned', []).length}*\n🛑 Banned words: *${expertGet(ns, 'badwords', []).length}*\n\n${rows.join('\n')}\n\n_Toggle any switch by sending its command, e.g. ${z.prefix}antilink_`
    )
  }
}
