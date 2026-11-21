// ⟦EXPERT⟧ .poll Question | option 1 | option 2 | ...
export default {
  name: 'poll',
  desc: 'Create a poll. Usage: .poll Question | A | B | C',
  async run(z) {
    const [name, ...values] = z.text.split('|').map((s) => s.trim()).filter(Boolean)
    if (!name || values.length < 2) return z.reply('Usage: .poll Best food? | Jollof | Fried rice | Pounded yam')
    if (values.length > 12) return z.reply('❌ Max 12 options.')
    await z.sock.sendMessage(z.jid, { poll: { name, values, selectableCount: 1 } })
  }
}
