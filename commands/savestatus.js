import { expertGet, expertSet } from '../lib/expert.store.js'
export default { name:'savestatus', desc:'Toggle saving incoming WhatsApp statuses to owner DM.', async run(expert) {
 const key='savestatus', next=!expertGet(expert.session.number,key,false)
 expertSet(expert.session.number,key,next)
 await expert.reply(`📥 Save Status is now ${next?'ON':'OFF'}. New statuses will ${next?'be copied to this linked account owner DM':'not be copied'}.`)
} }
