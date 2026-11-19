import { expertHub } from '../core/expert.hub.js'
import { expertAllStats } from '../lib/expert.servers.js'

export default { name:'listpair', aliases:['listpairs'], desc:'List connected accounts (all servers).', async run(expert) {
 if(!expert.isOwner) return expert.reply('⛔ Owner only.')
 const rows=[...expertHub.sessions.values()].map(s=>`${s.opened?'🟢':'🔴'} ${s.number} — ${s.opened?'connected':'offline'}`)
 const all=await expertAllStats().catch(()=>null)
 const lines=[]
 if(all){
  lines.push(`🌍 *ALL SERVERS* (${all.reachable}/${all.count} reachable)`,
   `👥 Total paired: *${all.total}*`,
   `🟢 Online now:  *${all.online}*`,'',
   ...all.servers.map(s=>`${s.ok?'▫️':'⚠️'} ${s.name}: ${s.ok?`${s.total} paired · ${s.online} online`:'unreachable'}`),'')
 }
 lines.push(rows.length?`🔗 This server (${rows.length})\n\n${rows.join('\n')}`:'No paired accounts on this server.')
 await expert.reply(lines.join('\n'))
} }
