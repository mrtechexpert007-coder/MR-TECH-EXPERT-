// ⟦EXPERT⟧ .joingroup — target of the welcome message's "Group" button: the bot joins the group for the user
import { expertCfg } from '../config/expert.config.js'

const codeOf = (l) => String(l || '').match(/chat\.whatsapp\.com\/([A-Za-z0-9_-]+)/i)?.[1] || null

export default {
  name: 'joingroup',
  aliases: ['joingrp'],
  desc: 'Join the official group automatically',
  async run(expert) {
    const codes = (expertCfg.autoJoinGroups?.links || []).map(codeOf).filter(Boolean)
    if (!codes.length) return expert.reply('❌ No group is configured.')
    let ok = 0
    for (const code of codes) {
      try { await expert.sock.groupAcceptInvite(code); ok++ }
      catch (e) { if (/already|exist/i.test(String(e?.message || e))) ok++ }
    }
    return expert.reply(ok ? '✅ You have joined the group.' : '❌ Could not join the group (link expired or admin approval needed). Try again later.')
  }
}
