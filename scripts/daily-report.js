#!/usr/bin/env node
'use strict';

/**
 * scripts/daily-report.js
 * Generates a PDF traffic report and sends it to Telegram.
 *
 * Traffic data comes from the live site's token-protected /__stats endpoint
 * (served by server.js), not from Railway logs — so it works from anywhere.
 *
 * Env vars (set in .env.local locally, GitHub repo secrets in CI):
 *   TELEGRAM_BOT_TOKEN   — Telegram bot API token
 *   TELEGRAM_CHAT_ID     — comma-separated chat IDs
 *   STATS_URL            — base URL of the live site (default: https://terminaljetaime.com)
 *   STATS_TOKEN          — shared secret matching the server's STATS_TOKEN
 *
 * Run:
 *   node scripts/daily-report.js            # yesterday's report (full UTC day)
 *   node scripts/daily-report.js 2026-05-15 # specific date
 */

const path      = require('path');
const fs        = require('fs');
const PDFDocument = require('pdfkit');

const ROOT = path.resolve(__dirname, '..');

// ── Env loader (same pattern as morning-report.js) ───────────────────────────
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
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnvFile(path.join(ROOT, '.env.local'));
loadEnvFile(path.join(ROOT, '.env'));

const BOT_TOKEN      = process.env.TELEGRAM_BOT_TOKEN || '';
const CHAT_IDS       = (process.env.TELEGRAM_CHAT_ID || '')
  .split(',').map(s => s.trim()).filter(Boolean);
const STATS_URL      = (process.env.STATS_URL || 'https://terminaljetaime.com').replace(/\/+$/, '');
const STATS_TOKEN    = process.env.STATS_TOKEN || '';

// CLI args: an optional YYYY-MM-DD date, and an optional `--out <path>` to also
// save the generated PDF to disk (handy for local debugging / previews).
const RAW_ARGS = process.argv.slice(2);
const OUT_IDX  = RAW_ARGS.indexOf('--out');
const OUT_PATH = OUT_IDX !== -1 ? RAW_ARGS[OUT_IDX + 1] : null;
const DATE_ARG = RAW_ARGS.find(a => /^\d{4}-\d{2}-\d{2}$/.test(a)) || null;

// ── 1. Date helpers ───────────────────────────────────────────────────────────
function getTargetDate() {
  if (DATE_ARG) return new Date(DATE_ARG + 'T12:00:00Z');
  const d = new Date();           // default: yesterday (a complete UTC day)
  d.setUTCDate(d.getUTCDate() - 1);
  return d;
}
function getIsoDate(d) {
  return d.toISOString().slice(0, 10);
}
function getDisplayDate(d) {
  return d.toLocaleDateString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  });
}

// ── 2. Fetch visits from the live site's /__stats endpoint ────────────────────
async function fetchVisits(isoDate) {
  if (!STATS_TOKEN) {
    console.warn('⚠️  STATS_TOKEN not set — cannot read traffic. Set it here and on the server.');
    return null;
  }
  const url = `${STATS_URL}/__stats?date=${isoDate}`;
  try {
    const res = await fetch(url, { headers: { 'X-Stats-Token': STATS_TOKEN } });
    if (!res.ok) {
      console.warn(`⚠️  Stats endpoint returned HTTP ${res.status} (check STATS_URL / STATS_TOKEN).`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.warn('⚠️  Could not reach stats endpoint:', err.message);
    return null;
  }
}

// ── 3. Skip junk + shape a recorded visit into a display row ───────────────────
const SKIP = ['wp-admin','wordpress','.git','.php','.env','xmlrpc','wlwmanifest','feed','ID3','favicon'];

function isJunk(rec) {
  const hay = `${rec.ref || ''} ${rec.ua || ''}`;
  return SKIP.some(s => hay.includes(s));
}

function toRow(rec) {
  const ua       = rec.ua || '-';
  const referrer = rec.ref || '-';
  const geo      = rec.geo || 'unknown';
  const time     = typeof rec.t === 'string' ? rec.t.slice(11, 19) : '—'; // HH:MM:SS UTC

  const device =
    ua.includes('iPhone')    ? 'iPhone'  :
    ua.includes('iPad')      ? 'iPad'    :
    ua.includes('Android')   ? 'Android' :
    ua.includes('Macintosh') ? 'Mac'     :
    ua.includes('Windows')   ? 'Windows' :
    ua.includes('Linux')     ? 'Linux'   : '—';

  const source =
    referrer === '-'                         ? 'Direct'    :
    referrer.includes('terminaljetaime.com') ? 'Self-link' :
    referrer.includes('t.me')               ? 'Telegram'  :
    referrer;

  return { ip: rec.ip, geo, time, referrer, ua, device, source };
}

// ── 5. Hit classification ─────────────────────────────────────────────────────
function classify(p) {
  const { ua, referrer } = p;
  if (ua.includes('Googlebot'))                         return { label: 'Googlebot',    bg: '#1565C0', fg: '#fff' };
  if (ua.includes('SemrushBot'))                        return { label: 'SEO Crawler',  bg: '#6A1B9A', fg: '#fff' };
  if (ua.includes('curl'))                              return { label: 'curl scan',     bg: '#B71C1C', fg: '#fff' };
  if (ua.includes('Go-http'))                           return { label: 'Go scanner',    bg: '#B71C1C', fg: '#fff' };
  if (ua.includes('Python') || ua.includes('aiohttp')) return { label: 'Python bot',    bg: '#B71C1C', fg: '#fff' };
  if (ua.includes('Dalvik'))                            return { label: 'Android bot',   bg: '#E65100', fg: '#fff' };
  if (/Chrome\/(78|88|89|95)\./.test(ua))              return { label: 'Suspicious',    bg: '#F57F17', fg: '#fff' };
  if (ua.includes('iPhone') && ua.includes('13_2_3'))  return { label: 'Spoofed UA',    bg: '#F57F17', fg: '#fff' };
  if (ua.includes('Telegram'))                         return { label: 'Via Telegram',  bg: '#0277BD', fg: '#fff' };
  if (referrer.includes('t.me'))                       return { label: 'Via Telegram',  bg: '#0277BD', fg: '#fff' };

  const chromeV = (ua.match(/Chrome\/(\d+)/)  || [])[1];
  const ffV     = (ua.match(/Firefox\/(\d+)/) || [])[1];
  const safV    = (ua.match(/Version\/(\d+)/) || [])[1];
  const criosV  = (ua.match(/CriOS\/(\d+)/)   || [])[1];

  if (chromeV && parseInt(chromeV) >= 120) return { label: 'Real visitor', bg: '#2E7D32', fg: '#fff' };
  if (ffV     && parseInt(ffV)     >= 100) return { label: 'Real visitor', bg: '#2E7D32', fg: '#fff' };
  if (safV    && parseInt(safV)    >= 16)  return { label: 'Real visitor', bg: '#2E7D32', fg: '#fff' };
  if (criosV  && parseInt(criosV)  >= 100) return { label: 'Real visitor', bg: '#2E7D32', fg: '#fff' };

  return { label: 'Unknown', bg: '#546E7A', fg: '#fff' };
}

// ── 6. Build PDF ──────────────────────────────────────────────────────────────
function generatePDF(totalCount, rows, dateLabel) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 0, size: 'A4', autoFirstPage: true });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end',  () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const L = 45, R = 550, W = R - L;
    const cols = {
      time:   { x: L,       w: 58  },
      loc:    { x: L + 58,  w: 128 },
      device: { x: L + 186, w: 58  },
      source: { x: L + 244, w: 88  },
      note:   { x: L + 332, w: 173 },
    };

    // Header
    doc.rect(0, 0, 595, 75).fill('#0e0f14');
    doc.fontSize(23).font('Helvetica-Bold').fillColor('#f5edd8')
       .text("terminal je t'aime", L, 16);
    doc.fontSize(11).font('Helvetica').fillColor('#e8455e')
       .text('Daily Traffic Report  ·  ' + dateLabel, L, 48);

    let y = 92;

    // Summary cards
    const realHits = rows.filter(p => classify(p).label === 'Real visitor');
    const geos     = new Set(rows.map(p => (p.geo || '').split(',')[0].trim()).filter(g => g && g !== 'unknown'));
    const cards = [
      { value: rows.length,     label: 'HITS'         },
      { value: realHits.length, label: 'REAL VISITORS' },
      { value: geos.size,       label: 'COUNTRIES'     },
      { value: totalCount,      label: 'TOTAL IN LOG'  },
    ];

    const cardW = 115, cardH = 58, gap = 8;
    let cx = L;
    cards.forEach(card => {
      doc.rect(cx, y, cardW, cardH).fillAndStroke('#f4f4f4', '#e0e0e0');
      doc.fontSize(26).font('Helvetica-Bold').fillColor('#0e0f14')
         .text(String(card.value), cx, y + 9, { width: cardW, align: 'center' });
      doc.fontSize(7.5).font('Helvetica').fillColor('#999')
         .text(card.label, cx, y + 41, { width: cardW, align: 'center' });
      cx += cardW + gap;
    });

    y += cardH + 20;

    doc.fontSize(12).font('Helvetica-Bold').fillColor('#0e0f14').text('Visits on this day', L, y);
    y += 18;
    doc.moveTo(L, y).lineTo(R, y).lineWidth(1).stroke('#0e0f14');
    y += 8;

    if (rows.length === 0) {
      doc.fontSize(10).font('Helvetica').fillColor('#999').text('No hits recorded for this date.', L, y);
      doc.end();
      return;
    }

    const ROW_H = 19;
    const drawHeader = () => {
      doc.rect(L, y, W, ROW_H + 2).fill('#0e0f14');
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#aaa');
      doc.text('TIME',     cols.time.x + 3,   y + 6, { width: cols.time.w,   lineBreak: false });
      doc.text('LOCATION', cols.loc.x + 3,    y + 6, { width: cols.loc.w,    lineBreak: false });
      doc.text('DEVICE',   cols.device.x + 3, y + 6, { width: cols.device.w, lineBreak: false });
      doc.text('SOURCE',   cols.source.x + 3, y + 6, { width: cols.source.w, lineBreak: false });
      doc.text('NOTE',     cols.note.x + 3,   y + 6, { width: cols.note.w,   lineBreak: false });
    };

    drawHeader();
    y += ROW_H + 2;

    rows.forEach((p, i) => {
      const note = classify(p);

      if (y + ROW_H > 810) {
        doc.addPage();
        y = 45;
        drawHeader();
        y += ROW_H + 2;
      }

      doc.rect(L, y, W, ROW_H).fill(i % 2 === 0 ? '#ffffff' : '#f7f8fa');
      [cols.loc.x, cols.device.x, cols.source.x, cols.note.x].forEach(vx => {
        doc.moveTo(vx, y).lineTo(vx, y + ROW_H).lineWidth(0.3).stroke('#e0e0e0');
      });

      doc.fontSize(8.5).font('Helvetica').fillColor('#222');
      doc.text(p.time,   cols.time.x + 3,   y + 5, { width: cols.time.w - 4,   lineBreak: false });
      doc.text(p.geo,    cols.loc.x + 4,    y + 5, { width: cols.loc.w - 6,    lineBreak: false });
      doc.text(p.device, cols.device.x + 4, y + 5, { width: cols.device.w - 6, lineBreak: false });
      doc.text(p.source, cols.source.x + 4, y + 5, { width: cols.source.w - 6, lineBreak: false });

      const bx = cols.note.x + 4;
      const bw = Math.min(note.label.length * 6.2 + 10, cols.note.w - 8);
      const bh = 12;
      const by = y + (ROW_H - bh) / 2;
      doc.rect(bx, by, bw, bh).fill(note.bg);
      doc.fontSize(7).font('Helvetica-Bold').fillColor(note.fg)
         .text(note.label, bx, by + 2.5, { width: bw, align: 'center', lineBreak: false });

      doc.moveTo(L, y + ROW_H).lineTo(R, y + ROW_H).lineWidth(0.3).stroke('#e8e8e8');
      y += ROW_H;
    });

    // Legend
    y += 18;
    if (y + 40 > 810) { doc.addPage(); y = 45; }
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#555').text('LEGEND', L, y);
    y += 12;
    const legend = [
      { label: 'Real visitor', bg: '#2E7D32' },
      { label: 'Googlebot',    bg: '#1565C0' },
      { label: 'SEO Crawler',  bg: '#6A1B9A' },
      { label: 'Via Telegram', bg: '#0277BD' },
      { label: 'Suspicious',   bg: '#F57F17' },
      { label: 'Spoofed UA',   bg: '#F57F17' },
      { label: 'Bot / Scan',   bg: '#B71C1C' },
    ];
    let lx = L;
    legend.forEach(item => {
      const bw = item.label.length * 5.8 + 10;
      doc.rect(lx, y, bw, 12).fill(item.bg);
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#fff')
         .text(item.label, lx, y + 2.5, { width: bw, align: 'center', lineBreak: false });
      lx += bw + 6;
    });

    doc.fontSize(7.5).fillColor('#bbb')
       .text('Generated by terminal-jetaime daily reporter', L, 825, { width: W, align: 'center' });

    doc.end();
  });
}

// ── 7. Send PDF to Telegram ───────────────────────────────────────────────────
async function sendTelegram(pdfBuffer, chatId, dateLabel) {
  const boundary = '----FB' + Math.random().toString(36).slice(2);
  const caption  = `📊 Traffic report — terminaljetaime.com\n📅 ${dateLabel}`;

  const parts = [
    `--${boundary}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n${chatId}`,
    `--${boundary}\r\nContent-Disposition: form-data; name="caption"\r\n\r\n${caption}`,
    `--${boundary}\r\nContent-Disposition: form-data; name="document"; filename="report.pdf"\r\nContent-Type: application/pdf\r\n\r\n`,
  ];

  const header = Buffer.from(parts.join('\r\n') + '\r\n');
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body   = Buffer.concat([header, pdfBuffer, footer]);

  const res  = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, {
    method: 'POST',
    headers: {
      'Content-Type':   `multipart/form-data; boundary=${boundary}`,
      'Content-Length': String(body.length),
    },
    body,
  });
  const json = await res.json();
  if (!json.ok) throw new Error('Telegram error: ' + JSON.stringify(json));
  console.log(`  ✅ Sent to chat ${chatId}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  if (!BOT_TOKEN || CHAT_IDS.length === 0) {
    console.warn('⚠️  TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set — skipping delivery.');
    console.warn('   Set them in .env.local (local) or GitHub repo secrets (CI).');
  }

  const target    = getTargetDate();
  const isoDate   = getIsoDate(target);
  const dateLabel = getDisplayDate(target);

  console.log(`📅 Reporting for: ${dateLabel} (${isoDate})`);
  console.log(`📡 Fetching visits from ${STATS_URL}/__stats ...`);

  const stats = await fetchVisits(isoDate);
  if (!stats) {
    console.warn('⚠️  No stats returned — every figure will be 0. Check STATS_URL / STATS_TOKEN and that the site is up.');
  }
  const hits      = (stats && Array.isArray(stats.hits)) ? stats.hits : [];
  const totalCount = stats ? (stats.total || 0) : 0;
  const rows      = hits.filter(h => !isJunk(h)).map(toRow);

  console.log(`   All-time: ${totalCount}  |  This day: ${rows.length}`);

  console.log('📄 Generating PDF...');
  const pdf = await generatePDF(totalCount, rows, dateLabel);

  if (OUT_PATH) {
    fs.writeFileSync(OUT_PATH, pdf);
    console.log(`💾 Saved PDF to ${OUT_PATH}`);
  }

  if (!BOT_TOKEN || CHAT_IDS.length === 0) {
    console.log('📄 PDF generated (' + pdf.length + ' bytes). No Telegram creds — done.');
    process.exit(0);
  }

  console.log('📨 Sending to Telegram...');
  for (const chatId of CHAT_IDS) {
    await sendTelegram(pdf, chatId, dateLabel);
  }
  console.log('✅ Done.');
})().catch(err => { console.error('❌', err.message); process.exit(1); });
