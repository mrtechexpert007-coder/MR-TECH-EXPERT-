// ⟦EXPERT⟧ .naija multi-site
import axios from 'axios'
import * as cheerio from 'cheerio'
const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0 Safari/537.36'
const SITES={
 darknaija:{name:'DarkNaija',base:'https://darknaija.com',hostRe:/darknaija\.com/i,search:q=>`https://darknaija.com/?s=${encodeURIComponent(q)}`},
 naijaxx:{name:'NaijaXX',base:'https://naijaxx.com',hostRe:/naijaxx\.com/i,search:q=>`https://naijaxx.com/?s=${encodeURIComponent(q)}`},
 stellaplus:{name:'StellaPlus',base:'https://stellaplus.xyz',hostRe:/stellaplus\.xyz/i,search:q=>`https://stellaplus.xyz/?s=${encodeURIComponent(q)}`},
 knackvideos:{name:'KnackVideos',base:'https://knackvideos.com',hostRe:/knackvideos\.com/i,search:q=>`https://knackvideos.com/?s=${encodeURIComponent(q)}`}
}
const http=axios.create({timeout:40000,headers:{'User-Agent':UA,Accept:'text/html'},validateStatus:s=>s>=200&&s<400})
const abs=(b,h)=>{if(!h)return'';if(h.startsWith('http'))return h;try{return new URL(h,b).href}catch{return h}}
const resolveKey=a=>{a=String(a||'').toLowerCase();if(/dark|dn/.test(a))return'darknaija';if(/xx|nj|naijax/.test(a))return'naijaxx';if(/stella|sp/.test(a))return'stellaplus';if(/knack|kv/.test(a))return'knackvideos';return SITES[a]?a:null}
async function scrapeList(key,url,limit=10){
 const site=SITES[key];const {data}=await http.get(url,{headers:{Referer:site.base+'/'}});const $=cheerio.load(data)
 const posts=[],seen=new Set()
 $('.hentry, article.post, article, .post').each((_,el)=>{if(posts.length>=limit)return false
  const a=$(el).find('.entry-title a').first().length?$(el).find('.entry-title a').first():$(el).find('h2 a, h3 a').first()
  const title=(a.attr('title')||a.text()||'').trim();const href=abs(site.base,a.attr('href')||'')
  if(!title||!href||seen.has(href))return;if(!site.hostRe.test(href))return
  const img=$(el).find('img').first();const thumb=abs(site.base,img.attr('data-src')||img.attr('src')||'')
  seen.add(href);posts.push({title,url:href,thumbnail:thumb||null})})
 return posts
}
export default{name:'naija',aliases:['naij'],desc:'Naija adult sites search',async run(expert){
 const args=expert.args||[];if(!args.length)return expert.reply('🔞 `.naija <search|latest>`\n`.naija site darknaija|naijaxx|stellaplus|knackvideos <q>`\n`.naija <url>`')
 await expert.react('🔞').catch(()=>{});try{
  if(/^https?:\/\//i.test(args[0])){const {data}=await http.get(args[0]);const $=cheerio.load(data)
   const title=$('h1').first().text().trim()||$('meta[property="og:title"]').attr('content')||'Post'
   const vids=[...new Set(String(data).match(/https?:\/\/[^"'\\s>]+\.mp4[^"'\\s>]*/gi)||[])].slice(0,6)
   let t=`🔞 *${title}*\n🔗 ${args[0]}\n`;if(vids.length)t+='\n*Media:*\n'+vids.map((v,i)=>`${i+1}. ${v}`).join('\n')
   else t+='\n_Open the link to watch._';await expert.reply(t);return expert.react('✅').catch(()=>{})}
  let key='darknaija',q=args.join(' ')
  if(args[0]?.toLowerCase()==='site'&&args[1]){key=resolveKey(args[1])||'darknaija';q=args.slice(2).join(' ')||'latest'}
  else if(resolveKey(args[0])&&args.length>1){key=resolveKey(args[0]);q=args.slice(1).join(' ')}
  const site=SITES[key];const listUrl=!q||/^latest|new$/i.test(q)?site.base+'/':site.search(q)
  const posts=await scrapeList(key,listUrl,10)
  if(!posts.length)return expert.reply(`No results on *${site.name}*`)
  let text=`🔞 *${site.name}* — “${q||'latest'}”\n\n`;posts.forEach((p,i)=>{text+=`*${i+1}. ${p.title}*\n${p.url}\n`})
  text+='\n`.naija <url>` for media links'
  if(posts[0]?.thumbnail){try{await expert.sock.sendMessage(expert.jid,{image:{url:posts[0].thumbnail},caption:text},{quoted:expert.msg});return expert.react('✅').catch(()=>{})}catch{}}
  await expert.reply(text);await expert.react('✅').catch(()=>{})
 }catch(e){await expert.reply('❌ *Naija failed*\n'+e.message);await expert.react('❌').catch(()=>{})}
}}
