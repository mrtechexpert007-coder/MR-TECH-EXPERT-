// Remove one or more quoted/mentioned members.
async function admin(z){ if(!z.isGroup)return false; const m=await z.sock.groupMetadata(z.jid); const me=m.participants.find(p=>p.id?.split(':')[0]===z.sender?.split(':')[0] || p.phoneNumber===z.sender); return z.isOwner || !!me?.admin }
export default { name:'kick', aliases:['remove'], desc:'Remove mentioned/replied member(s)', async run(z){
 if(!z.isGroup)return z.reply('👥 Groups only.'); if(!(await admin(z)))return z.reply('⛔ Group admins only.');
 const c=z.msg.message?.extendedTextMessage?.contextInfo; const ids=[...(c?.mentionedJid||[]), ...(c?.participant?[c.participant]:[])].filter((v,i,a)=>a.indexOf(v)===i);
 if(!ids.length)return z.reply('Tag or reply to the member you want to remove.');
 const r=await z.sock.groupParticipantsUpdate(z.jid,ids,'remove'); await z.reply('✅ Removal request sent. WhatsApp may reject members the bot cannot remove.');
} }
