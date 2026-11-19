// ⟦EXPERT⟧ .jid — chat id (handy for channel IDs: send in/forward from a channel)
export default {
  name: 'jid',
  desc: 'Show this chat\'s JID',
  async run(expert) { await expert.reply(`🆔 \`${expert.jid}\``) }
}
