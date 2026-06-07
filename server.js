const express = require('express');
const morgan = require('morgan');
// geoip-lite downloads its database during npm install; if that download fails
// (Railway network timeout, MaxMind CDN issue) the require throws ENOENT and
// crashes the process. Load it optionally so the server always starts.
let geoip = null;
try { geoip = require('geoip-lite'); } catch { /* geo lookups degraded to "unknown" */ }
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// ── Visit tracking ────────────────────────────────────────────────────────────
// Every page view is appended to a JSONL file so the daily report can read real
// numbers over HTTPS (see GET /__stats below). Point STATS_DATA_DIR at a Railway
// volume so the data survives redeploys — otherwise the file resets on each deploy.
const DATA_DIR    = process.env.STATS_DATA_DIR || path.join(__dirname, 'data');
const HITS_FILE   = path.join(DATA_DIR, 'hits.jsonl');
const STATS_TOKEN = process.env.STATS_TOKEN || '';
const RETENTION_DAYS = 40;

app.set('trust proxy', true);

function clientIp(req) {
  return (req.ip || req.connection?.remoteAddress || '').replace(/^::ffff:/, '');
}

function geoString(ip) {
  if (!geoip) return 'unknown';
  const geo = geoip.lookup(ip);
  if (!geo) return 'unknown';
  return [geo.country, geo.region, geo.city].filter(Boolean).join(', ');
}

morgan.token('geo', (req) => {
  const ip = clientIp(req);
  if (!geoip) return `${ip} [unknown]`;
  const geo = geoip.lookup(ip);
  if (!geo) return `${ip} [unknown]`;
  const parts = [geo.country];
  if (geo.region) parts.push(geo.region);
  if (geo.city) parts.push(geo.city);
  return `${ip} [${parts.join(', ')}]`;
});

// A page view is a GET for a route (not an asset with a file extension, not the
// stats endpoint). This mirrors the "GET / HTTP" hits the old log parser counted.
function isPageView(req) {
  if (req.method !== 'GET') return false;
  if (req.path === '/__stats') return false;
  if (/\.[a-zA-Z0-9]{1,8}$/.test(req.path)) return false;
  return true;
}

function recordHit(req) {
  const rec = {
    t:   new Date().toISOString(),
    ip:  clientIp(req),
    geo: geoString(clientIp(req)),
    ref: req.get('referer') || req.get('referrer') || '-',
    ua:  req.get('user-agent') || '-',
  };
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.appendFileSync(HITS_FILE, JSON.stringify(rec) + '\n');
}

function pruneOldHits() {
  if (!fs.existsSync(HITS_FILE)) return;
  const cutoff = Date.now() - RETENTION_DAYS * 86400000;
  const kept = fs.readFileSync(HITS_FILE, 'utf8').split('\n').filter(Boolean).filter(l => {
    try { return new Date(JSON.parse(l).t).getTime() >= cutoff; } catch { return false; }
  });
  fs.writeFileSync(HITS_FILE, kept.length ? kept.join('\n') + '\n' : '');
}

app.use(morgan(':geo - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"'));

app.use((req, res, next) => {
  if (isPageView(req)) {
    try { recordHit(req); } catch (err) { console.error('hit-record failed:', err.message); }
  }
  next();
});

// Token-protected JSON of recorded visits. ?date=YYYY-MM-DD (UTC) filters to one day.
// Token is read from the X-Stats-Token header (preferred) or a ?token= query param.
app.get('/__stats', (req, res) => {
  const presented = req.get('x-stats-token') || req.query.token || '';
  if (!STATS_TOKEN || presented !== STATS_TOKEN) {
    return res.status(403).json({ error: 'forbidden' });
  }
  let lines = [];
  try { lines = fs.readFileSync(HITS_FILE, 'utf8').split('\n').filter(Boolean); } catch { /* no file yet */ }
  const all = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const date = req.query.date || null;
  const hits = date ? all.filter(h => typeof h.t === 'string' && h.t.slice(0, 10) === date) : all;
  res.json({ date, total: all.length, count: hits.length, hits });
});

// Return 404 for dotfiles/dotdirs (.env, .git, .vscode, etc.) and common
// scanner targets before they hit the catch-all and get a misleading 200.
const BLOCKED_PATH_PREFIXES = [
  '/.', '/wp-', '/xmlrpc.php', '/actuator', '/cgi-bin', '/phpmyadmin',
];
app.use((req, res, next) => {
  const p = req.path.toLowerCase();
  if (BLOCKED_PATH_PREFIXES.some(prefix => p.startsWith(prefix))) {
    return res.status(404).end();
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// Serve the SPA only for extensionless paths; file-extension paths that
// weren't found by express.static should 404, not return the HTML page.
app.get('*', (req, res) => {
  if (/\.[a-zA-Z0-9]{1,8}$/.test(req.path)) {
    return res.status(404).end();
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

pruneOldHits();
setInterval(pruneOldHits, 6 * 60 * 60 * 1000).unref();

app.listen(PORT, () => console.log(`terminal je t'aime running on port ${PORT}`));
