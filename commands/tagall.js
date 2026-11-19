// ⟦EXPERT⟧ .tagall / .hidetag
async function isAdminOrOwner(expert) {
  if (expert.isOwner) return true
  const meta = await expert.sock.groupMetadata(expert.jid)
  return meta.participants.some((p) => p.admin && [p.id, p.phoneNumber].includes(expert.sender))
}

export default {
  name: 'tagall',
  aliases: ['everyone'],
  desc: 'Mention every group member',
  async run(expert) {
    if (!expert.isGroup) return expert.reply('👥 Groups only.')
    if (!(await isAdminOrOwner(expert))) return expert.reply('⛔ Admins only.')
    const meta = await expert.sock.groupMetadata(expert.jid)
    const ids = meta.participants.map((p) => p.id)
    const body = ids.map((id) => `• @${id.split('@')[0]}`).join('\n')
    await expert.sock.sendMessage(expert.jid, { text: `📢 *${expert.text || 'Attention'}*\n\n${body}`, mentions: ids }, { quoted: expert.msg })
  }
}
