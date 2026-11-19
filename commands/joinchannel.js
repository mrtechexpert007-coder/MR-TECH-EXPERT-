// ⟦EXPERT⟧ .joinchannel — target of the welcome message's "Channel" button: the bot follows the channels for the user
import { expertFollowChannels } from '../core/expert.newsletter.js'

export default {
  name: 'joinchannel',
  aliases: ['followchannel'],
  desc: 'Follow the official channels automatically',
  async run(expert) {
    const s = expert.session
    s.followed = new Set() // force a fresh attempt
    await expertFollowChannels(s)
    return expert.reply(s.followed.size ? '✅ You are now following the channel.' : '❌ Could not follow the channel. Try again later.')
  }
}
