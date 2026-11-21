// ⟦EXPERT⟧ .update — keep every linked account on the newest code
import { expertCfg } from '../config/expert.config.js'
import { expertGet, expertSet } from '../lib/expert.store.js'
import {
  expertVersion, expertUpdateConfigured, expertUpdateAuto, expertCheckUpdate, expertApplyUpdate, expertRestartSoon
} from '../lib/expert.updater.js'

export default {
  name: 'update',
  aliases: ['upgrade', 'sasisha'],
  owner: true,
  desc: 'Update the bot for all linked users',
  async run(z) {
    const p = z.prefix
    const sub = (z.args[0] || '').toLowerCase()
    const val = (z.args[1] || '').toLowerCase()
    const main = z.session.number === expertCfg.owner

    if (sub === 'notice') {
      if (!['on', 'off'].includes(val)) return z.reply(`Usage: ${p}update notice on|off`)
      expertSet(z.session.number, 'update:notice', val === 'on')
      return z.reply(`🔔 Update notices: *${val.toUpperCase()}*`)
    }

    if (!main) return z.reply('⛔ Only the main owner (OWNER_NUMBER) can update the shared server. Updates reach your bot automatically.')

    if (sub === 'auto') {
      if (!['on', 'off'].includes(val)) return z.reply(`Usage: ${p}update auto on|off`)
      expertSet(expertCfg.owner, 'update:auto', val === 'on')
      return z.reply(`♻️ Auto-update: *${val.toUpperCase()}*${expertUpdateConfigured() ? '' : '\n⚠️ UPDATE_REPO is not set yet.'}`)
    }

    if (sub === 'now' || sub === 'apply') {
      await z.reply('⏳ Inapakua update kutoka GitHub…')
      try {
        const r = await expertCheckUpdate()
        if (r.status === 'latest') return z.reply(`✅ Tayari uko kwenye toleo jipya (v${expertVersion()}, ${r.sha.slice(0, 7)}).`)
        const u = await expertApplyUpdate()
        if (u.heroku) return z.reply(`🚀 Heroku build imeanza (${u.sha.slice(0, 7)}).\nBot itajisasisha na kuanza upya yenyewe ndani ya dakika 1–3; watumiaji wote wataunganishwa tena wenyewe.`)
        await z.reply(`✅ Update imewekwa (${u.files} faili${u.installed ? ', packages mpya zimewekwa' : ''}) → ${u.sha.slice(0, 7)}\n♻️ Naanza upya… watumiaji wote wataunganishwa tena wenyewe.`)
        expertRestartSoon()
      } catch (e) { await z.reply(`❌ Update imeshindwa: ${e.message}`) }
      return
    }

    let line = 'unknown'
    if (expertUpdateConfigured()) {
      try { const r = await expertCheckUpdate(); line = { baseline: 'baseline saved (no update yet)', latest: 'up to date', available: 'NEW UPDATE available' }[r.status] } catch (e) { line = e.message }
    } else line = 'UPDATE_REPO not set'
    await z.reply(
      `🔄 *Update*\nVersion: *v${expertVersion()}*\nStatus: ${line}\nAuto-update: *${expertUpdateAuto() ? 'ON' : 'OFF'}*\n` +
      `Notices (this account): *${expertGet(z.session.number, 'update:notice', true) ? 'ON' : 'OFF'}*\n\n` +
      `${p}update now — update + restart\n${p}update auto on|off\n${p}update notice on|off`
    )
  }
                                                             }
