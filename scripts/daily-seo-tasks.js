#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
function checklist(snapshot, tasks, today) {
  const selected=[];
  const audit=snapshot.audit || [];
  const failures=audit.filter(x=>x.status!==200 || x.noindex || x.canonical===false || (x.h1Count!==undefined && x.h1Count!==1));
  if(failures.length) selected.push({title:'Check the live site before other SEO work',minutes:10,action:`Open https://terminaljetaime.com/ and investigate: ${failures.map(x=>`${x.path}: ${x.status}${x.noindex?' (noindex)':''}`).join(', ')}. A failed request may be a temporary network problem; confirm it in your browser.`,done:'The homepage, robots.txt and sitemap.xml load, and the homepage is indexable.'});
  if(!snapshot.search?.periods) selected.push({title:'Connect Google Search Console reporting',minutes:20,action:'Check the Google authentication step in GitHub Actions. The workflows use the existing keyless GitHub connection and the Restricted gsc-reader service account. Confirm the property is sc-domain:terminaljetaime.com and the Search Console API is enabled. Do not create a JSON key.\nhttps://github.com/office287/terminal-jetaime/actions',done:'A new weekly report displays Search Console data or explicitly reports no returned data, rather than an access/configuration error.'});
  for(const t of tasks.filter(t=>t.status==='open').sort((a,b)=>a.priority-b.priority)) {
    if(selected.length===3) break;
    selected.push(t);
  }
  const lines=[`Your SEO tasks — ${today}`,'','Do these in order. Complete what you can; unfinished tasks stay on the list.',''];
  selected.forEach((t,i)=>lines.push(`${i+1}. ${t.title} (~${t.minutes} min)`,t.action,`Done when: ${t.done}`,''));
  if(!selected.length) lines.push('No open checklist tasks. Review the weekly report and choose the next improvement.','');
  lines.push(`Search Console: ${snapshot.search?.status || 'Unavailable'}`,'','Completion tracking: tell me which tasks you finished so I can update the checklist. Telegram replies are not processed automatically.','','Weekly progress report continues on Mondays.');
  return lines.join('\n');
}
async function main(){
  const today=new Date().toISOString().slice(0,10);
  // Reuse the read-only audit and Search Console collector; never send a second weekly message.
  execFileSync(process.execPath,[path.join(__dirname,'weekly-seo.js'),'--no-send'],{cwd:ROOT,env:process.env,stdio:'pipe',timeout:180000});
  const snapshot=JSON.parse(fs.readFileSync(path.join(ROOT,'reports',`${today}-weekly-seo.json`),'utf8'));
  const tasks=JSON.parse(fs.readFileSync(path.join(ROOT,'data','daily-seo-tasks.json'),'utf8'));
  const message=checklist(snapshot,tasks,today);
  fs.writeFileSync(path.join(ROOT,'reports',`${today}-daily-seo-tasks.txt`),message+'\n');
  console.log(message);
  if(process.argv.includes('--no-send'))return;
  const token=process.env.TELEGRAM_BOT_TOKEN;
  const chats=(process.env.TELEGRAM_CHAT_ID||'').split(',').map(x=>x.trim()).filter(Boolean);
  if(!token||!chats.length)throw new Error('Telegram is not configured');
  if(message.length>4000)throw new Error('Checklist exceeds Telegram message budget');
  for(const chat_id of chats){
    const r=await fetch(`https://api.telegram.org/bot${token}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id,text:message,disable_web_page_preview:true}),signal:AbortSignal.timeout(30000)});
    const result=await r.json();if(!r.ok||!result.ok)throw new Error('Telegram delivery failed');
  }
  console.log('Daily checklist delivered successfully.');
}
if(require.main===module)main().catch(()=>{console.error('Daily checklist failed; check the saved artifact, configuration and network.');process.exitCode=1;});
module.exports={checklist};
