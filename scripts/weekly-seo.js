#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
const date = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const clean = s => String(s).replace(/[\r\n|]/g, ' ');
const windows = [{start:date(-9),end:date(-3)}, {start:date(-16),end:date(-10)}];
async function searchData() {
  if (!process.env.GSC_ACCESS_TOKEN && !process.env.GSC_SERVICE_ACCOUNT_JSON) return {status:'Unavailable: Search Console authentication is not configured. Check the Google authentication step in GitHub Actions.'};
  try {
    const { google } = require('googleapis');
    let auth;
    if (process.env.GSC_ACCESS_TOKEN) {
      auth = new google.auth.OAuth2();
      auth.setCredentials({access_token:process.env.GSC_ACCESS_TOKEN});
    } else {
      const credentials = JSON.parse(Buffer.from(process.env.GSC_SERVICE_ACCOUNT_JSON, 'base64').toString());
      auth = new google.auth.GoogleAuth({credentials, scopes:['https://www.googleapis.com/auth/webmasters.readonly']});
    }
    const api = google.searchconsole({version:'v1', auth});
    const query = async (w, dimensions) => (await api.searchanalytics.query({
      siteUrl:process.env.GSC_SITE_URL || 'sc-domain:terminaljetaime.com',
      requestBody:{startDate:w.start,endDate:w.end,dimensions,type:'web',dataState:'final',rowLimit:25000}
    })).data.rows || [];
    const periods = [];
    for (const w of windows) periods.push({window:w, totals:await query(w, []), queries:await query(w,['query']), pages:await query(w,['page'])});
    return {status:'Available; finalized Google web search data. Three-day reporting lag; dates follow Search Console Pacific time.', periods};
  } catch (e) { return {status:`Unavailable: Search Console request failed (${e.code || 'authentication/API error'}). Check property access and the Google authentication step in GitHub Actions.`}; }
}
async function audit() {
  const results = [];
  for (const suffix of ['', 'robots.txt', 'sitemap.xml']) {
    try {
      const r = await fetch(`https://terminaljetaime.com/${suffix}`, {signal:AbortSignal.timeout(20000)});
      const html = await r.text();
      const checks = suffix ? {} : {
        title:html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || 'MISSING',
        canonical:/rel=["']canonical["']/i.test(html),
        noindex:/<meta[^>]+(?:name=["']robots["'][^>]+content=["'][^"']*noindex|content=["'][^"']*noindex[^>]+name=["']robots)/i.test(html) || /noindex/i.test(r.headers.get('x-robots-tag') || ''),
        h1Count:(html.match(/<h1\b/gi)||[]).length
      };
      results.push({path:'/'+suffix,status:r.status,finalUrl:r.url,...checks});
    } catch {results.push({path:'/'+suffix,status:'Unavailable: network request failed'});}
  }
  return results;
}
function report(data) {
  const lines = [`# Weekly SEO report — ${date(0)}`, '', '## Work recorded in the last seven days', '', data.commits || 'No commits recorded in this checkout during the period.', '', 'Commits describe repository work; they do not prove production deployment.', '', '## Search performance', '', data.search.status, '', `Current: ${windows[0].start}–${windows[0].end}. Previous: ${windows[1].start}–${windows[1].end}.`, ''];
  if (data.search.periods) {
    const [a,b] = data.search.periods;
    const x = a.totals[0], y = b.totals[0];
    if (x && y) {
      lines.push('| Metric | Previous | Current | Change |','|---|---:|---:|---:|');
      for (const key of ['clicks','impressions','ctr','position']) {
        const format = v => key==='ctr' ? `${(v*100).toFixed(2)}%` : Number(v.toFixed(2));
        const delta = key==='ctr' ? `${((x[key]-y[key])*100).toFixed(2)} pp` : (x[key]-y[key]).toFixed(2);
        lines.push(`| ${key} | ${format(y[key])} | ${format(x[key])} | ${delta} |`);
      }
      lines.push('', 'Position is an average: lower is better. Clicks are Google search visits, not total page views. Changes do not establish causation.');
    } else lines.push('Insufficient returned data for a period comparison; missing data is not reported as zero.');
    for (const dimension of ['queries','pages']) {
      const prev = new Map(b[dimension].map(r=>[r.keys[0],r]));
      const changes = a[dimension].filter(r=>prev.has(r.keys[0])).map(r=>({r,old:prev.get(r.keys[0])})).sort((u,v)=>(v.old.position-v.r.position)-(u.old.position-u.r.position));
      lines.push('',`## Ranking changes: ${dimension}`, '', '| Search term / page | Previous position | Current position | Movement |', '|---|---:|---:|---|');
      for (const {r,old} of changes.slice(0,15)) {
        const gain=old.position-r.position;
        lines.push(`| ${clean(r.keys[0])} | ${old.position.toFixed(1)} | ${r.position.toFixed(1)} | ${gain>0?'Up':gain<0?'Down':'Unchanged'} ${Math.abs(gain).toFixed(1)} |`);
      }
      if (!changes.length) lines.push('| No comparable rows | — | — | — |');
    }
    lines.push('', 'Query/page rows are a bounded Search Console sample and can exclude anonymized queries. New/missing rows are not treated as ranking gains/losses.');
  }
  lines.push('', '## Live technical snapshot', '', '```json', JSON.stringify(data.audit,null,2), '```', '', '## Next actions', '', '1. Resolve any failed live checks and verify production deployment.', '2. Establish Search Console access if unavailable, then prioritize queries with impressions and average positions 8–30.', '3. Publish an original, tested macOS guide targeting one demonstrated query; link it from the cheat sheet. Candidate topics: pbcopy/pbpaste, caffeinate, finding files.', '4. Improve titles and examples on pages with impressions but low click-through rate; compare again after enough data accumulates.', '', 'Total page views and organic sessions: unavailable until a suitable analytics source is connected. No traffic or ranking improvement is claimed without measurements.');
  return lines.join('\n')+'\n';
}
async function main() {
  let commits;
  try {commits=execFileSync('git',['log','--since=7 days ago','--format=- %h %s','--','public/','scripts/','.github/','docs/'],{cwd:ROOT,encoding:'utf8'}).trim();} catch {commits='Git history unavailable.';}
  const data={generatedAt:new Date().toISOString(),commits,search:await searchData(),audit:await audit()};
  const markdown=report(data);
  fs.mkdirSync(path.join(ROOT,'reports'),{recursive:true});
  const base=path.join(ROOT,'reports',`${date(0)}-weekly-seo`);
  fs.writeFileSync(base+'.md',markdown); fs.writeFileSync(base+'.json',JSON.stringify(data,null,2)+'\n');
  console.log(markdown);
  if (process.argv.includes('--no-send')) return;
  const token=process.env.TELEGRAM_BOT_TOKEN;
  const chats=(process.env.TELEGRAM_CHAT_ID || '').split(',').map(x=>x.trim()).filter(Boolean);
  if (!token || !chats.length) throw new Error('Report saved; Telegram delivery is not configured.');
  for (const chat of chats) {
    const form=new FormData(); form.set('chat_id',chat); form.set('caption',`Weekly SEO report — ${date(0)}`);
    form.set('document',new Blob([markdown],{type:'text/plain'}),path.basename(base)+'.md');
    const r=await fetch(`https://api.telegram.org/bot${token}/sendDocument`,{method:'POST',body:form,signal:AbortSignal.timeout(30000)});
    const body=await r.json(); if (!r.ok || !body.ok) throw new Error('Report saved; Telegram delivery failed.');
  }
}
if (require.main===module) main().catch(()=>{console.error('Weekly report failed. Check artifact, network, and delivery configuration.');process.exitCode=1;});
module.exports={report,windows,searchData};
