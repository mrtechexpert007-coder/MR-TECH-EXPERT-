import { expertGet, expertSet } from '../lib/expert.store.js'
export default { name:'anticall', desc:'Toggle automatic rejection of incoming WhatsApp calls.', async run(expert) {
 const key='anticall', next=!expertGet(expert.session.number,key,false)
 expertSet(expert.session.number,key,next)
 await expert.reply(`📵 Anticall is now ${next?'ON':'OFF'}.`)
} }
