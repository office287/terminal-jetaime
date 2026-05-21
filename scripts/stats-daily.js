#!/usr/bin/env node
/**
 * scripts/stats-daily.js
 * Daily stats report: traffic + Google Search Console insights
 *
 * OUTPUT: reports/YYYY-MM-DD-stats.md  +  Telegram summary
 *
 * ─── ENV VARS ────────────────────────────────────────────────────────────────
 *
 *  TELEGRAM_BOT_TOKEN        — Telegram bot API token
 *  TELEGRAM_CHAT_ID          — comma-separated chat IDs
 *  RAILWAY_TOKEN             — Railway API token
 *  RAILWAY_SERVICE_ID        — Railway service ID (default: terminal-jetaime)
 *  GSC_SERVICE_ACCOUNT_JSON  — Google service account key, base64-encoded JSON
 *  GSC_SITE_URL              — GSC property URL (default: https://terminaljetaime.com/)
 *
 * ─── GSC SETUP (one-time) ────────────────────────────────────────────────────
 *
 *  1. console.cloud.google.com → New project → enable "Google Search Console API"
 *  2. Credentials → Create credentials → Service account → name "gsc-reader" → Done
 *  3. Click the service account → Keys tab → Add key → JSON → Download
 *  4. Base64-encode:  base64 -i service-account.json | tr -d '\n'
 *  5. GitHub: Settings → Secrets → Actions → New secret:
 *       Name:  GSC_SERVICE_ACCOUNT_JSON
 *       Value: <the base64 string from step 4>
 *  6. Google Search Console → Settings → Users & permissions
 *       → Add user → paste service account email (ends in @...iam.gserviceaccount.com)
 *       → Permission: Restricted (read-only)
 *
 * ─── RUN ─────────────────────────────────────────────────────────────────────
 *
 *   node scripts/stats-daily.js              # today's report
 *   node scripts/stats-daily.js --force      # overwrite if exists
 *   node scripts/stats-daily.js --no-send    # skip Telegram
 *   node scripts/stats-daily.js --print      # print to stdout
 */

'use strict';

const fs         = require('fs');
const path       = require('path');
const https      = require('https');
const { spawnSync } = require('child_process');

const ROOT        = path.resolve(__dirname, '..');
const REPORTS_DIR = path.join(ROOT, 'reports');

// ── Env loader ────────────────────────────────────────────────────────────────
function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const rawLine of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
      val = val.slice(1, -1);
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnvFile(path.join(ROOT, '.env.local'));
loadEnvFile(path.join(ROOT, '.env'));

const ARGS     = new Set(process.argv.slice(2));
const FORCE    = ARGS.has('--force');
const PRINT    = ARGS.has('--print');
const NO_SEND  = ARGS.has('--no-send');

const TG_TOKEN    = process.env.TELEGRAM_BOT_TOKEN || '';
const TG_CHAT_IDS = (process.env.TELEGRAM_CHAT_ID || '').split(',').map(s => s.trim()).filter(Boolean);
const RAILWAY_TOKEN = process.env.RAILWAY_TOKEN || '';
const RAILWAY_SVC   = process.env.RAILWAY_SERVICE_ID || 'terminal-jetaime';
const GSC_JSON_B64  = process.env.GSC_SERVICE_ACCOUNT_JSON || '';
const GSC_SITE_URL  = process.env.GSC_SITE_URL || 'https://terminaljetaime.com/';

// ── Date helpers ──────────────────────────────────────────────────────────────
function isoDate(d = new Date()) { return d.toISOString().slice(0, 10); }

function offsetDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

// ── Railway log fetch (same as daily-report.js) ───────────────────────────────
function findRailwayCLI() {
  const which = spawnSync('which', ['railway'], { encoding: 'utf8' });
  if (which.status === 0 && which.stdout.trim()) return which.stdout.trim();
  for (const p of ['/opt/homebrew/bin/railway', '/usr/local/bin/railway', '/usr/bin/railway'])
    if (fs.existsSync(p)) return p;
  return null;
}

function fetchRailwayLogs() {
  const cli = findRailwayCLI();
  if (!cli)          { console.warn('Railway CLI not found'); return ''; }
  if (!RAILWAY_TOKEN){ console.warn('RAILWAY_TOKEN not set'); return ''; }
  const r = spawnSync(cli, ['logs', '--service', RAILWAY_SVC], {
    cwd: ROOT, timeout: 30000, encoding: 'utf8',
    env: { ...process.env, RAILWAY_TOKEN },
  });
  return (r.stdout || '') + (r.stderr || '');
}

const LOG_SKIP = ['wp-admin','wordpress','.git','.php','.env','xmlrpc','wlwmanifest','feed','ID3','favicon'];

function parseHits(logs) {
  return logs.split('\n').filter(l => l.includes('"GET / HTTP') && !LOG_SKIP.some(s => l.includes(s)));
}

function filterHitsByDate(hits, prefix) {
  return hits.filter(h => h.includes(prefix));
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function logDatePrefix(d = new Date()) {
  return `${String(d.getUTCDate()).padStart(2,'0')}/${MONTHS[d.getUTCMonth()]}/${d.getUTCFullYear()}`;
}

function parseLine(line) {
  const m = line.match(
    /^(\S+) \[([^\]]+)\] - - \[(\d+\/\w+\/\d+):(\d+:\d+:\d+)[^\]]*\] "[^"]*" (\d+) \S+ "([^"]*)" "([^"]*)"/
  );
  if (!m) return null;
  const [, ip, geo, , time, status, referrer, ua] = m;
  const device =
    ua.includes('iPhone') ? 'iPhone' : ua.includes('iPad') ? 'iPad' :
    ua.includes('Android') ? 'Android' : ua.includes('Macintosh') ? 'Mac' :
    ua.includes('Windows') ? 'Windows' : ua.includes('Linux') ? 'Linux' : '—';
  const source =
    referrer === '-'                        ? 'Direct' :
    referrer.includes('terminaljetaime.com')? 'Self'   :
    referrer.includes('t.me')               ? 'Telegram': referrer;
  return { ip, geo, time, status, referrer, ua, device, source };
}

function classifyHit(p) {
  const { ua, referrer } = p;
  if (ua.includes('Googlebot'))                         return 'Googlebot';
  if (ua.includes('SemrushBot') || ua.includes('AhrefsBot') || ua.includes('Bingbot')) return 'SEO Crawler';
  if (ua.includes('curl') || ua.includes('Go-http') || ua.includes('Python') || ua.includes('aiohttp')) return 'Bot';
  if (ua.includes('Telegram') || referrer.includes('t.me')) return 'Via Telegram';
  if (/Chrome\/(78|88|89|95)\./.test(ua) || (ua.includes('iPhone') && ua.includes('13_2_3'))) return 'Suspicious';
  const chromeV = (ua.match(/Chrome\/(\d+)/)  || [])[1];
  const ffV     = (ua.match(/Firefox\/(\d+)/) || [])[1];
  const safV    = (ua.match(/Version\/(\d+)/) || [])[1];
  const criosV  = (ua.match(/CriOS\/(\d+)/)   || [])[1];
  if ((chromeV && +chromeV >= 120) || (ffV && +ffV >= 100) || (safV && +safV >= 16) || (criosV && +criosV >= 100))
    return 'Real visitor';
  return 'Unknown';
}

function trafficSummary(logs) {
  const today    = new Date();
  const allHits  = parseHits(logs);
  const todayHits = filterHitsByDate(allHits, logDatePrefix(today));
  const parsed   = todayHits.map(parseLine).filter(Boolean);
  const byClass  = {};
  for (const p of parsed) {
    const cls = classifyHit(p);
    byClass[cls] = (byClass[cls] || 0) + 1;
  }
  const geos = new Set(parsed.map(p => p.geo.split(',')[0].trim()).filter(Boolean));
  return {
    totalHits:  todayHits.length,
    realVisitors: byClass['Real visitor'] || 0,
    viaTelegram:  byClass['Via Telegram']  || 0,
    googlebots:   byClass['Googlebot']     || 0,
    seoCrawlers:  byClass['SEO Crawler']   || 0,
    bots:         byClass['Bot']           || 0,
    suspicious:   byClass['Suspicious']    || 0,
    unknown:      byClass['Unknown']       || 0,
    countries:    geos.size,
    allTimeHits:  allHits.length,
  };
}

// ── GSC fetch ─────────────────────────────────────────────────────────────────
async function fetchGSC() {
  if (!GSC_JSON_B64) return null;

  let credentials;
  try {
    credentials = JSON.parse(Buffer.from(GSC_JSON_B64, 'base64').toString('utf8'));
  } catch {
    console.warn('GSC: failed to parse GSC_SERVICE_ACCOUNT_JSON (expected base64 JSON)');
    return null;
  }

  let google;
  try {
    ({ google } = require('googleapis'));
  } catch {
    console.warn('GSC: googleapis not installed — run npm install');
    return null;
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  });

  const sc = google.searchconsole({ version: 'v1', auth });

  const yesterday = offsetDate(-1);
  const start28   = offsetDate(-28);

  async function query(startDate, endDate, dimensions, rowLimit = 20, orderBy = 'clicks') {
    try {
      const res = await sc.searchanalytics.query({
        siteUrl: GSC_SITE_URL,
        requestBody: {
          startDate, endDate,
          dimensions,
          rowLimit,
          orderBy: [{ fieldName: orderBy, sortOrder: 'DESCENDING' }],
        },
      });
      return res.data.rows || [];
    } catch (err) {
      console.warn(`GSC query(${dimensions}) failed: ${err.message}`);
      return [];
    }
  }

  const [queriesYday, pagesYday, countriesYday, queries28] = await Promise.all([
    query(yesterday, yesterday, ['query'], 20, 'clicks'),
    query(yesterday, yesterday, ['page'],  10, 'clicks'),
    query(yesterday, yesterday, ['country'], 10, 'clicks'),
    query(start28,   yesterday, ['query'], 50, 'impressions'),
  ]);

  // Aggregate 28-day totals
  const totals28 = queries28.reduce((acc, r) => {
    acc.clicks      += r.clicks || 0;
    acc.impressions += r.impressions || 0;
    return acc;
  }, { clicks: 0, impressions: 0 });

  // Opportunities from 28-day data
  const almostPage1 = queries28
    .filter(r => r.position >= 4 && r.position <= 20 && r.impressions >= 5)
    .sort((a, b) => a.position - b.position)
    .slice(0, 10);

  const fixCTR = queries28
    .filter(r => r.position <= 10 && r.ctr < 0.03 && r.impressions >= 20)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 8);

  const zeroClicks = queries28
    .filter(r => r.clicks === 0 && r.impressions >= 30)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 8);

  return {
    date: yesterday,
    queriesYday, pagesYday, countriesYday,
    queries28, totals28,
    almostPage1, fixCTR, zeroClicks,
  };
}

// ── Report builder ────────────────────────────────────────────────────────────
function fmtPct(n) { return (n * 100).toFixed(1) + '%'; }
function fmtPos(n) { return n.toFixed(1); }

function buildReport(today, traffic, gsc) {
  const L = [];
  const push = s => L.push(s);

  push(`# Stats Daily — ${today}`);
  push('');
  push(`**Site:** terminaljetaime.com  |  **Generated:** ${today}`);
  push('');

  // ── Traffic ──────────────────────────────────────────────────────────────
  push('## Traffic — Today');
  push('');
  if (!RAILWAY_TOKEN) {
    push('_Railway logs not available (RAILWAY_TOKEN not set)._');
  } else {
    push('| Metric | Count |');
    push('|---|---|');
    push(`| Total hits | ${traffic.totalHits} |`);
    push(`| Real visitors | **${traffic.realVisitors}** |`);
    push(`| Via Telegram | ${traffic.viaTelegram} |`);
    push(`| Googlebot | ${traffic.googlebots} |`);
    push(`| SEO crawlers | ${traffic.seoCrawlers} |`);
    push(`| Bots / scans | ${traffic.bots} |`);
    push(`| Suspicious | ${traffic.suspicious} |`);
    push(`| Unknown UA | ${traffic.unknown} |`);
    push(`| Countries seen | ${traffic.countries} |`);
    push(`| All-time in log | ${traffic.allTimeHits} |`);
  }
  push('');

  // ── GSC ──────────────────────────────────────────────────────────────────
  if (!gsc) {
    push('## Google Search Console — Not configured');
    push('');
    push('GSC data is not available. Add the `GSC_SERVICE_ACCOUNT_JSON` secret to unlock:');
    push('');
    push('```');
    push('1. console.cloud.google.com → New project → enable "Google Search Console API"');
    push('2. Credentials → Service account → name "gsc-reader" → Done');
    push('3. Keys tab → Add key → JSON → Download');
    push('4. base64 -i service-account.json | tr -d \'\\n\'');
    push('5. GitHub Secrets → GSC_SERVICE_ACCOUNT_JSON = <base64 string>');
    push('6. Search Console → Users & permissions → Add service account email → Restricted');
    push('```');
    push('');
  } else {
    push(`## Google Search Console — ${gsc.date}`);
    push('');
    push(`**28-day totals:** ${gsc.totals28.clicks.toLocaleString()} clicks · ${gsc.totals28.impressions.toLocaleString()} impressions`);
    push('');

    // Top queries yesterday
    push('### Top Queries — Yesterday');
    push('');
    if (gsc.queriesYday.length === 0) {
      push('_No query data for yesterday (may take 2–3 days to appear in GSC)._');
    } else {
      push('| Query | Clicks | Impr | CTR | Position |');
      push('|---|---|---|---|---|');
      for (const r of gsc.queriesYday) {
        push(`| ${r.keys[0]} | ${r.clicks} | ${r.impressions} | ${fmtPct(r.ctr)} | ${fmtPos(r.position)} |`);
      }
    }
    push('');

    // Top pages yesterday
    push('### Top Pages — Yesterday');
    push('');
    if (gsc.pagesYday.length === 0) {
      push('_No page data for yesterday._');
    } else {
      push('| Page | Clicks | Impr | CTR | Position |');
      push('|---|---|---|---|---|');
      for (const r of gsc.pagesYday) {
        const pg = r.keys[0].replace(GSC_SITE_URL, '/');
        push(`| ${pg} | ${r.clicks} | ${r.impressions} | ${fmtPct(r.ctr)} | ${fmtPos(r.position)} |`);
      }
    }
    push('');

    // Countries yesterday
    push('### Countries — Yesterday');
    push('');
    if (gsc.countriesYday.length === 0) {
      push('_No country data for yesterday._');
    } else {
      push('| Country | Clicks | Impr | CTR |');
      push('|---|---|---|---|');
      for (const r of gsc.countriesYday) {
        push(`| ${r.keys[0].toUpperCase()} | ${r.clicks} | ${r.impressions} | ${fmtPct(r.ctr)} |`);
      }
    }
    push('');

    // Opportunities
    push('## Opportunities (28-day data)');
    push('');

    push('### Almost Page 1 — Position 4–20');
    push('> Improve content depth, add internal links, or target exact phrasing.');
    push('');
    if (gsc.almostPage1.length === 0) {
      push('_No queries in position 4–20 with ≥5 impressions._');
    } else {
      push('| Query | Pos | Clicks | Impr | CTR |');
      push('|---|---|---|---|---|');
      for (const r of gsc.almostPage1) {
        push(`| ${r.keys[0]} | ${fmtPos(r.position)} | ${r.clicks} | ${r.impressions} | ${fmtPct(r.ctr)} |`);
      }
    }
    push('');

    push('### Fix CTR — Ranking but not clicked (pos ≤10, CTR <3%)');
    push('> Rewrite title tag and meta description for these queries.');
    push('');
    if (gsc.fixCTR.length === 0) {
      push('_No CTR issues found (or insufficient data)._');
    } else {
      push('| Query | Pos | Clicks | Impr | CTR |');
      push('|---|---|---|---|---|');
      for (const r of gsc.fixCTR) {
        push(`| ${r.keys[0]} | ${fmtPos(r.position)} | ${r.clicks} | ${r.impressions} | ${fmtPct(r.ctr)} |`);
      }
    }
    push('');

    push('### High Visibility, Zero Clicks — ≥30 impressions, 0 clicks');
    push('> Check if your page matches the intent. Add a clearer call-to-action in the snippet.');
    push('');
    if (gsc.zeroClicks.length === 0) {
      push('_No zero-click, high-impression queries found._');
    } else {
      push('| Query | Impr | Position |');
      push('|---|---|---|');
      for (const r of gsc.zeroClicks) {
        push(`| ${r.keys[0]} | ${r.impressions} | ${fmtPos(r.position)} |`);
      }
    }
    push('');
  }

  push('---');
  push('');
  push(`_Generated by \`scripts/stats-daily.js\`. Re-run: \`npm run stats\`._`);
  push('');

  return L.join('\n');
}

// ── Telegram ──────────────────────────────────────────────────────────────────
function buildTelegramSummary(today, traffic, gsc) {
  const lines = [];
  lines.push(`*Stats Daily — ${today}*`);
  lines.push('');

  if (RAILWAY_TOKEN) {
    lines.push(`*Traffic today*`);
    lines.push(`  Hits: ${traffic.totalHits}  |  Real: ${traffic.realVisitors}  |  Countries: ${traffic.countries}`);
    lines.push(`  Telegram: ${traffic.viaTelegram}  |  Googlebot: ${traffic.googlebots}  |  Bots: ${traffic.bots}`);
  }

  if (gsc) {
    lines.push('');
    lines.push(`*GSC — ${gsc.date}*`);
    if (gsc.queriesYday.length > 0) {
      lines.push(`Top queries yesterday:`);
      for (const r of gsc.queriesYday.slice(0, 5)) {
        lines.push(`  • ${r.keys[0]} — ${r.clicks} clicks, pos ${fmtPos(r.position)}`);
      }
    } else {
      lines.push(`No GSC query data yet for ${gsc.date}.`);
    }
    if (gsc.almostPage1.length > 0) {
      lines.push('');
      lines.push(`*Quick wins — almost page 1:*`);
      for (const r of gsc.almostPage1.slice(0, 5)) {
        lines.push(`  • "${r.keys[0]}" — pos ${fmtPos(r.position)}, ${r.impressions} impr`);
      }
    }
  } else {
    lines.push('');
    lines.push('GSC not configured. See SETUP in scripts/stats-daily.js.');
  }

  lines.push('');
  lines.push(`Full report: reports/${today}-stats.md`);
  return lines.join('\n');
}

function sendTelegram(text) {
  if (!TG_TOKEN || TG_CHAT_IDS.length === 0) {
    console.log('Telegram: skipped (no token/chat IDs)');
    return Promise.resolve();
  }
  const truncated = text.length > 4000 ? text.slice(0, 3950) + '\n_(truncated)_' : text;
  const promises = TG_CHAT_IDS.map(chatId => new Promise((resolve, reject) => {
    const payload = JSON.stringify({ chat_id: chatId, text: truncated, parse_mode: 'Markdown', disable_web_page_preview: true });
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${TG_TOKEN}/sendMessage`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        if (res.statusCode === 200) { console.log(`Telegram: sent to ${chatId}`); resolve(); }
        else { console.error(`Telegram: failed ${chatId} HTTP ${res.statusCode}: ${body}`); reject(new Error('Telegram HTTP ' + res.statusCode)); }
      });
    });
    req.on('error', err => { console.error('Telegram: network error:', err.message); reject(err); });
    req.write(payload);
    req.end();
  }));
  return Promise.allSettled(promises);
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  const today = isoDate();
  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const outPath = path.join(REPORTS_DIR, `${today}-stats.md`);

  if (fs.existsSync(outPath) && !FORCE) {
    console.log(`Stats report already exists: ${path.relative(ROOT, outPath)} (--force to overwrite)`);
    if (PRINT) console.log('\n' + fs.readFileSync(outPath, 'utf8'));
    process.exit(0);
  }

  console.log('Fetching Railway logs...');
  const logs = fetchRailwayLogs();
  const traffic = trafficSummary(logs);
  console.log(`Traffic: ${traffic.totalHits} hits, ${traffic.realVisitors} real visitors`);

  console.log('Fetching GSC data...');
  const gsc = await fetchGSC();
  if (gsc) console.log(`GSC: ${gsc.queriesYday.length} queries yesterday, ${gsc.queries28.length} queries in 28d`);
  else      console.log('GSC: skipped (no credentials or error)');

  const report = buildReport(today, traffic, gsc);
  fs.writeFileSync(outPath, report, 'utf8');
  console.log(`Wrote ${path.relative(ROOT, outPath)}`);
  if (PRINT) console.log('\n' + report);

  if (!NO_SEND) {
    const summary = buildTelegramSummary(today, traffic, gsc);
    await sendTelegram(summary);
  }
})().catch(err => { console.error('Error:', err.message); process.exit(1); });
