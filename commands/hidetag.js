// ⟦EXPERT⟧ .hidetag — silent mention of everyone
export default {
  name: 'hidetag',
  aliases: ['h'],
  desc: 'Ping everyone invisibly',
  async run(expert) {
    if (!expert.isGroup) return expert.reply('👥 Groups only.')
    const meta = await expert.sock.groupMetadata(expert.jid)
    const me = meta.participants.some((p) => p.admin && [p.id, p.phoneNumber].includes(expert.sender))
    if (!expert.isOwner && !me) return expert.reply('⛔ Admins only.')
    await expert.sock.sendMessage(expert.jid, { text: expert.text || '​', mentions: meta.participants.map((p) => p.id) })
  }
}
