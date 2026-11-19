// ⟦EXPERT⟧ .autoread on|off — marks incoming messages as read (blue ticks)
import { expertSwitchCommand } from '../lib/expert.presence.js'
export default expertSwitchCommand({
  name: 'autoread',
  desc: 'Mark incoming messages as read',
  label: 'Every incoming message is marked as read automatically.'
})
