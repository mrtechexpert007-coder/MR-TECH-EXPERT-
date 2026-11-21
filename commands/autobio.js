import { expertGet, expertSet } from '../lib/expert.store.js'
export default { name: 'autobio', desc: 'Toggle automatic profile bio/status.', async run(expert) {
 const key='autobio', current=expertGet(expert.session.number,key,true), next=!current
 expertSet(expert.session.number,key,next)
 if(next) { try { await expert.sock.updateProfileStatus('⚡ EXPERT MINI BOT • Online'); } catch {} }
 await expert.reply(`📝 Autobio is now ${next?'ON':'OFF'}.`)
} }
