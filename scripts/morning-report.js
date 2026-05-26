#!/usr/bin/env node
/**
 * scripts/morning-report.js
 * Generates a dated SEO/AEO progress report at reports/YYYY-MM-DD-morning.md
 * and optionally sends it to Telegram.
 *
 * Env vars for Telegram delivery:
 *   TELEGRAM_BOT_TOKEN  — your bot's API token
 *   TELEGRAM_CHAT_ID    — chat or channel ID to send to (comma-separated for multiple)
 *
 * Run:
 *   node scripts/morning-report.js              # writes + sends (skips if exists)
 *   node scripts/morning-report.js --force      # overwrite today's report + send
 *   node scripts/morning-report.js --print      # write & print to stdout
 *   node scripts/morning-report.js --no-send    # skip Telegram delivery
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const REPORTS_DIR = path.join(ROOT, 'reports');
const PUBLIC_DIR = path.join(ROOT, 'public');
const INDEX_HTML = path.join(PUBLIC_DIR, 'index.html');

// Lightweight .env loader — checks .env.local then .env, populates process.env
// for keys that are not already set. No dependency on dotenv.
function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, 'utf8');
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnvFile(path.join(ROOT, '.env.local'));
loadEnvFile(path.join(ROOT, '.env'));

const ARGS = new Set(process.argv.slice(2));
const FORCE = ARGS.has('--force');
const PRINT = ARGS.has('--print');
const NO_SEND = ARGS.has('--no-send');

const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TG_CHAT_IDS = (process.env.TELEGRAM_CHAT_ID || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

function isoDate(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function safeRead(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return ''; }
}

function countMatches(text, re) {
  return (text.match(re) || []).length;
}

function extractJsonLdTypes(html) {
  const blocks = html.match(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/g) || [];
  const types = [];
  for (const block of blocks) {
    const json = block.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
    try {
      const parsed = JSON.parse(json);
      types.push(parsed['@type'] || 'unknown');
    } catch {
      types.push('INVALID_JSON');
    }
  }
  return types;
}

function countFaqQuestions(html) {
  // schema-side
  const faqBlock = (html.match(/"@type"\s*:\s*"FAQPage"[\s\S]*?<\/script>/) || [])[0] || '';
  const schemaQ = countMatches(faqBlock, /"@type"\s*:\s*"Question"/g);
  // DOM-side
  const domQ = countMatches(html, /itemtype="https:\/\/schema\.org\/Question"/g);
  return { schemaQ, domQ };
}

function gitCommitsSince(sinceISO) {
  try {
    const out = execSync(
      `git log --since="${sinceISO} 00:00:00" --pretty=format:"%h %s" -n 30`,
      { cwd: ROOT, encoding: 'utf8' }
    );
    return out.split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function previousReportDate(today) {
  if (!fs.existsSync(REPORTS_DIR)) return null;
  const files = fs.readdirSync(REPORTS_DIR)
    .filter(f => /^\d{4}-\d{2}-\d{2}-morning\.md$/.test(f))
    .map(f => f.slice(0, 10))
    .filter(d => d < today)
    .sort();
  return files.length ? files[files.length - 1] : null;
}

function audit() {
  const html = safeRead(INDEX_HTML);
  const robots = safeRead(path.join(PUBLIC_DIR, 'robots.txt'));
  const sitemap = safeRead(path.join(PUBLIC_DIR, 'sitemap.xml'));
  const llms = safeRead(path.join(PUBLIC_DIR, 'llms.txt'));

  const jsonLdTypes = extractJsonLdTypes(html);
  const { schemaQ, domQ } = countFaqQuestions(html);

  return {
    bytes: html.length,
    h1: countMatches(html, /<h1[\s>]/g),
    h2: countMatches(html, /<h2[\s>]/g),
    h3: countMatches(html, /<h3[\s>]/g),
    jsonLdTypes,
    schemaQ,
    domQ,
    hasMetaDescription: /<meta\s+name="description"/i.test(html),
    hasCanonical: /<link\s+rel="canonical"/i.test(html),
    hasOG: countMatches(html, /<meta\s+property="og:/gi),
    hasTwitter: countMatches(html, /<meta\s+name="twitter:/gi),
    robotsUserAgents: countMatches(robots, /^User-agent:/gim),
    sitemapUrls: countMatches(sitemap, /<loc>/g),
    hasLlmsTxt: llms.length > 0,
    llmsBytes: llms.length,
  };
}

function loadNightlySummary() {
  const p = path.join(REPORTS_DIR, '.last-nightly.json');
  if (!fs.existsSync(p)) return null;
  try {
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (j.date !== isoDate()) return null; // only count tonight's run
    return j;
  } catch { return null; }
}

function loadActionItems() {
  const p = path.join(ROOT, 'data', 'action-items.json');
  if (!fs.existsSync(p)) return [];
  try {
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    return (j.items || []).filter(i => i.status === 'open');
  } catch { return []; }
}

function loadGscSnapshot() {
  const p = path.join(ROOT, 'data', 'gsc-latest.json');
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

function buildGscSection(gsc) {
  const lines = [];
  if (!gsc) return lines;
  const fmtPct = n => (n * 100).toFixed(1) + '%';
  const fmtPos = n => (+n).toFixed(1);
  lines.push('## Google Search Console (28-day snapshot)');
  lines.push('');
  lines.push(`**Window:** ${gsc.date28Start} → ${gsc.date28End}  |  **Clicks:** ${gsc.totals28.clicks.toLocaleString()}  |  **Impressions:** ${gsc.totals28.impressions.toLocaleString()}`);
  lines.push('');
  if (gsc.queriesYday && gsc.queriesYday.length > 0) {
    lines.push('### Top Queries — Yesterday');
    lines.push('');
    lines.push('| Query | Clicks | Impr | CTR | Position |');
    lines.push('|---|---|---|---|---|');
    for (const r of gsc.queriesYday.slice(0, 10)) {
      lines.push(`| ${r.keys[0]} | ${r.clicks} | ${r.impressions} | ${fmtPct(r.ctr)} | ${fmtPos(r.position)} |`);
    }
    lines.push('');
  }
  if (gsc.almostPage1 && gsc.almostPage1.length > 0) {
    lines.push('### Quick Wins — Almost Page 1 (pos 4–20, ≥5 impressions)');
    lines.push('');
    lines.push('| Query | Position | Clicks | Impressions |');
    lines.push('|---|---|---|---|');
    for (const r of gsc.almostPage1) {
      lines.push(`| ${r.keys[0]} | ${fmtPos(r.position)} | ${r.clicks} | ${r.impressions} |`);
    }
    lines.push('');
  }
  return lines;
}

function buildReport({ today, prev, a, commits }) {
  const sinceLine = prev ? `since ${prev}` : `since project inception`;
  const nightly = loadNightlySummary();
  const openItems = loadActionItems();
  const lines = [];
  lines.push(`# Nightly SEO/AEO Progress Report — ${today}`);
  lines.push('');
  lines.push(`**Site:** terminaljetaime.com`);
  lines.push(`**Goal:** Increase traffic by improving SEO and AEO.`);
  lines.push(`**Window:** ${sinceLine}.`);
  lines.push('');
  lines.push('## What was done tonight');
  lines.push('');
  if (nightly && nightly.actions && nightly.actions.length > 0) {
    for (const act of nightly.actions) {
      lines.push(`- ${act.action} \`${act.file}\` — ${act.detail}`);
    }
  } else if (commits.length > 0) {
    lines.push(`No deterministic refresh was needed (site already up-to-date), but ${commits.length} commit(s) landed in the window — see below.`);
  } else {
    lines.push('_No site changes tonight. Audit only._');
  }
  lines.push('');
  lines.push('## Your action items');
  lines.push('');
  if (openItems.length === 0) {
    lines.push('_Nothing for you to do — all tracked items are closed._');
  } else {
    for (const item of openItems.slice(0, 5)) {
      lines.push(`- **${item.title}**`);
      lines.push(`  _Why:_ ${item.why}`);
      if (item.url) lines.push(`  ${item.url}`);
    }
    if (openItems.length > 5) {
      lines.push(`- _…and ${openItems.length - 5} more in data/action-items.json_`);
    }
  }
  lines.push('');
  const gsc = loadGscSnapshot();
  const gscLines = buildGscSection(gsc);
  if (gscLines.length > 0) {
    lines.push(...gscLines);
  }
  lines.push('## Site audit (live snapshot)');
  lines.push('');
  lines.push('| Signal | Value |');
  lines.push('|---|---|');
  lines.push(`| index.html size | ${a.bytes.toLocaleString()} bytes |`);
  lines.push(`| Heading hierarchy | h1: ${a.h1} · h2: ${a.h2} · h3: ${a.h3} |`);
  lines.push(`| JSON-LD blocks | ${a.jsonLdTypes.length} (${a.jsonLdTypes.join(', ') || 'none'}) |`);
  lines.push(`| FAQ — schema Qs | ${a.schemaQ} |`);
  lines.push(`| FAQ — DOM Qs | ${a.domQ} |`);
  lines.push(`| Meta description | ${a.hasMetaDescription ? '✅' : '❌'} |`);
  lines.push(`| Canonical link | ${a.hasCanonical ? '✅' : '❌'} |`);
  lines.push(`| Open Graph tags | ${a.hasOG} |`);
  lines.push(`| Twitter Card tags | ${a.hasTwitter} |`);
  lines.push(`| robots.txt User-agents | ${a.robotsUserAgents} |`);
  lines.push(`| sitemap.xml URLs | ${a.sitemapUrls} |`);
  lines.push(`| llms.txt | ${a.hasLlmsTxt ? `✅ (${a.llmsBytes.toLocaleString()} bytes)` : '❌'} |`);
  lines.push('');
  lines.push('## Commits in window');
  lines.push('');
  if (commits.length === 0) {
    lines.push('_No commits in this window. Site state matches previous snapshot._');
  } else {
    for (const c of commits) lines.push(`- \`${c.split(' ')[0]}\` ${c.split(' ').slice(1).join(' ')}`);
  }
  lines.push('');
  lines.push('## Health checks');
  lines.push('');
  const checks = [
    [a.h1 > 0, 'At least one H1'],
    [a.h2 >= 5, 'Multiple H2s for crawler hierarchy (>=5)'],
    [a.jsonLdTypes.includes('WebApplication'), 'WebApplication JSON-LD present'],
    [a.jsonLdTypes.includes('FAQPage'), 'FAQPage JSON-LD present'],
    [a.jsonLdTypes.includes('HowTo'), 'HowTo JSON-LD present'],
    [a.jsonLdTypes.includes('BreadcrumbList'), 'BreadcrumbList JSON-LD present'],
    [a.schemaQ >= 5, 'At least 5 FAQ entries in schema'],
    [a.domQ >= 5, 'At least 5 FAQ entries rendered in DOM'],
    [a.hasMetaDescription, 'Meta description present'],
    [a.hasCanonical, 'Canonical URL present'],
    [a.hasOG >= 4, 'Open Graph tags (>=4)'],
    [a.hasTwitter >= 3, 'Twitter Card tags (>=3)'],
    [a.robotsUserAgents >= 20, 'robots.txt covers >=20 user-agents (broad AI bot allowlist)'],
    [a.sitemapUrls >= 3, 'Sitemap has multiple URLs (>=3)'],
    [a.hasLlmsTxt, 'llms.txt present (AEO standard)'],
    [!a.jsonLdTypes.includes('INVALID_JSON'), 'All JSON-LD parses'],
  ];
  for (const [pass, label] of checks) {
    lines.push(`- ${pass ? '✅' : '❌'} ${label}`);
  }
  const passed = checks.filter(c => c[0]).length;
  lines.push('');
  lines.push(`**Score:** ${passed} / ${checks.length} checks passing.`);
  lines.push('');
  lines.push('## Notes');
  lines.push('');
  lines.push('Generated automatically by `scripts/morning-report.js`. Re-run any time with `npm run report`.');
  lines.push('');
  return lines.join('\n');
}

function mdToTelegram(md) {
  return md
    .replace(/^# (.+)$/gm, '*$1*')
    .replace(/^## (.+)$/gm, '\n*$1*')
    .replace(/\*\*(.+?)\*\*/g, '*$1*')
    .replace(/\|---?\|---?\|/g, '')
    .replace(/^\| /gm, '  ')
    .replace(/ \|$/gm, '')
    .replace(/ \| /g, '  —  ')
    .replace(/`([^`]+)`/g, '`$1`')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function sendTelegram(text) {
  if (!TG_TOKEN || TG_CHAT_IDS.length === 0) {
    console.log('Telegram: skipped (TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set).');
    return Promise.resolve();
  }

  const truncated = text.length > 4000 ? text.slice(0, 3950) + '\n\n_(truncated)_' : text;

  const promises = TG_CHAT_IDS.map(chatId => {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify({
        chat_id: chatId,
        text: truncated,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      });

      const req = https.request(
        {
          hostname: 'api.telegram.org',
          path: `/bot${TG_TOKEN}/sendMessage`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
          },
        },
        (res) => {
          let body = '';
          res.on('data', (d) => (body += d));
          res.on('end', () => {
            if (res.statusCode === 200) {
              console.log(`Telegram: sent to ${chatId}.`);
              resolve();
            } else {
              console.error(`Telegram: failed for ${chatId} (HTTP ${res.statusCode}): ${body}`);
              reject(new Error(`Telegram HTTP ${res.statusCode}`));
            }
          });
        }
      );
      req.on('error', (err) => {
        console.error(`Telegram: network error for ${chatId}: ${err.message}`);
        reject(err);
      });
      req.write(payload);
      req.end();
    });
  });

  return Promise.allSettled(promises);
}

async function main() {
  const today = isoDate();
  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const outPath = path.join(REPORTS_DIR, `${today}-morning.md`);

  if (fs.existsSync(outPath) && !FORCE) {
    const msg = `Report already exists for ${today}: ${path.relative(ROOT, outPath)} (re-run with --force to overwrite).`;
    console.log(msg);
    if (PRINT) console.log('\n' + fs.readFileSync(outPath, 'utf8'));
    return;
  }

  const prev = previousReportDate(today);
  const a = audit();
  const commits = gitCommitsSince(prev || today);
  const report = buildReport({ today, prev, a, commits });
  fs.writeFileSync(outPath, report, 'utf8');
  console.log(`Wrote ${path.relative(ROOT, outPath)}`);
  if (PRINT) console.log('\n' + report);

  if (!NO_SEND) {
    const tgText = mdToTelegram(report);
    await sendTelegram(tgText);
  }
}

main();
