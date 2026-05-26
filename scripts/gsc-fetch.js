#!/usr/bin/env node
/**
 * scripts/gsc-fetch.js
 * Fetches a 28-day Google Search Console snapshot and writes it to
 * data/gsc-latest.json for morning-report.js to include.
 *
 * Always exits 0 — permission errors or missing config are warnings, not
 * failures, so the nightly workflow never breaks because of GSC.
 *
 * Required secrets (GitHub Actions):
 *   GSC_SERVICE_ACCOUNT_JSON  — base64-encoded service account JSON key
 *   GSC_SITE_URL              — GSC property URL (e.g. https://terminaljetaime.com/)
 *
 * One-time GSC setup (same steps as scripts/stats-daily.js):
 *   1. console.cloud.google.com → enable "Google Search Console API"
 *   2. Credentials → Service account → name "gsc-reader" → Done
 *   3. Keys tab → Add key → JSON → Download
 *   4. base64 -i service-account.json | tr -d '\n'
 *   5. GitHub Secrets → GSC_SERVICE_ACCOUNT_JSON = <base64 string>
 *   6. Search Console → Users & permissions → Add service account email → Restricted
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT     = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const OUT_FILE = path.join(DATA_DIR, 'gsc-latest.json');

function isoDate(d = new Date()) { return d.toISOString().slice(0, 10); }
function offsetDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

async function main() {
  const GSC_JSON_B64 = process.env.GSC_SERVICE_ACCOUNT_JSON || '';
  const GSC_SITE_URL = (process.env.GSC_SITE_URL || 'https://terminaljetaime.com/').replace(/([^/])$/, '$1/');

  const endDate   = offsetDate(-1);
  const startDate = offsetDate(-28);

  console.log(`Fetching GSC data for ${GSC_SITE_URL} (${startDate} → ${endDate})...`);

  if (!GSC_JSON_B64) {
    console.log('gsc-fetch: GSC_SERVICE_ACCOUNT_JSON not set — skipping.');
    return;
  }

  let credentials;
  try {
    credentials = JSON.parse(Buffer.from(GSC_JSON_B64, 'base64').toString('utf8'));
  } catch {
    console.warn('gsc-fetch: failed to parse GSC_SERVICE_ACCOUNT_JSON (expected base64 JSON).');
    return;
  }

  let google;
  try {
    ({ google } = require('googleapis'));
  } catch {
    console.warn('gsc-fetch: googleapis not installed — run npm install.');
    return;
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  });

  const sc = google.searchconsole({ version: 'v1', auth });

  async function query(start, end, dimensions, rowLimit = 20) {
    try {
      const res = await sc.searchanalytics.query({
        siteUrl: GSC_SITE_URL,
        requestBody: {
          startDate: start,
          endDate: end,
          dimensions,
          rowLimit,
          orderBy: [{ fieldName: 'clicks', sortOrder: 'DESCENDING' }],
        },
      });
      return res.data.rows || [];
    } catch (err) {
      const msg = err.message || String(err);
      if (msg.includes('insufficient permission') || msg.includes('403') || msg.includes('does not have')) {
        console.warn(`gsc-fetch: permission denied — ${msg}`);
        console.warn(`  Service account: ${credentials.client_email}`);
        console.warn('  Fix: Search Console → Users & permissions → Add the service account email → Restricted');
      } else {
        console.warn(`gsc-fetch: query(${dimensions}) failed: ${msg}`);
      }
      return null;
    }
  }

  // Use a single probe to check permissions before running all queries.
  const probe = await query(startDate, endDate, ['query'], 50);
  if (probe === null) {
    console.warn('gsc-fetch: skipping — could not fetch data (see warning above).');
    return;
  }

  const yesterday = offsetDate(-1);
  const [queriesYday, pagesYday, countriesYday] = await Promise.all([
    query(yesterday, yesterday, ['query'],   20),
    query(yesterday, yesterday, ['page'],    10),
    query(yesterday, yesterday, ['country'], 10),
  ]);

  const totals28 = probe.reduce((acc, r) => {
    acc.clicks      += r.clicks      || 0;
    acc.impressions += r.impressions || 0;
    return acc;
  }, { clicks: 0, impressions: 0 });

  const almostPage1 = probe
    .filter(r => r.position >= 4 && r.position <= 20 && r.impressions >= 5)
    .sort((a, b) => a.position - b.position)
    .slice(0, 10);

  const data = {
    fetchedAt:     new Date().toISOString(),
    siteUrl:       GSC_SITE_URL,
    date28Start:   startDate,
    date28End:     endDate,
    totals28,
    almostPage1,
    queriesYday:   queriesYday   || [],
    pagesYday:     pagesYday     || [],
    countriesYday: countriesYday || [],
  };

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(data, null, 2), 'utf8');
  console.log(`gsc-fetch: wrote ${path.relative(ROOT, OUT_FILE)} — 28d clicks: ${totals28.clicks}, impressions: ${totals28.impressions}`);
}

main().catch(err => {
  // Unexpected crash — warn and exit 0 so the workflow continues.
  console.warn('gsc-fetch: unexpected error:', err.message || err);
});
