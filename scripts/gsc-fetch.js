#!/usr/bin/env node
/**
 * scripts/gsc-fetch.js
 *
 * Fetches the last 28 days of search analytics from Google Search Console
 * and saves the result to data/gsc-latest.json for gsc-improve.js to consume.
 *
 * Auth: uses Application Default Credentials — no JSON key file needed.
 * In GitHub Actions, google-github-actions/auth sets these automatically via
 * Workload Identity Federation.
 * Locally, run: gcloud auth application-default login
 *
 * Required env vars / GitHub secrets:
 *   GSC_SITE_URL  — GSC property URL, e.g. sc-domain:terminaljetaime.com
 *
 * Setup (one-time):
 *   1. Google Cloud Console → project terminaljetaime → enable "Google Search Console API"
 *   2. Create service account gsc-reader@terminaljetaime.iam.gserviceaccount.com
 *   3. Workload Identity Federation → pool github-pool / provider github-provider
 *   4. Search Console → Settings → Users & permissions → Add user →
 *      gsc-reader@terminaljetaime.iam.gserviceaccount.com → Full permission
 *   5. GitHub secrets: GCP_WORKLOAD_IDENTITY_PROVIDER, GCP_SERVICE_ACCOUNT, GSC_SITE_URL
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const rawLine of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val[0] === '"' && val.at(-1) === '"') || (val[0] === "'" && val.at(-1) === "'")) val = val.slice(1, -1);
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnvFile(path.join(ROOT, '.env.local'));
loadEnvFile(path.join(ROOT, '.env'));

const SITE_URL = process.env.GSC_SITE_URL;

if (!SITE_URL) {
  console.log('GSC_SITE_URL not set — skipping GSC fetch.');
  process.exit(0);
}

function fmt(d) { return d.toISOString().slice(0, 10); }

function toRow(r, keyNames) {
  const obj = {};
  keyNames.forEach((k, i) => { obj[k] = r.keys[i]; });
  return {
    ...obj,
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: +(r.ctr * 100).toFixed(2),
    position: +r.position.toFixed(1),
  };
}

async function main() {
  // Application Default Credentials — set automatically by google-github-actions/auth
  // or locally via: gcloud auth application-default login
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  });

  const sc = google.searchconsole({ version: 'v1', auth });

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 28);

  console.log(`Fetching GSC data for ${SITE_URL} (${fmt(startDate)} → ${fmt(endDate)})...`);

  const [queryRes, pageRes, deviceRes] = await Promise.all([
    sc.searchanalytics.query({
      siteUrl: SITE_URL,
      requestBody: {
        startDate: fmt(startDate),
        endDate: fmt(endDate),
        dimensions: ['query'],
        rowLimit: 100,
      },
    }),
    sc.searchanalytics.query({
      siteUrl: SITE_URL,
      requestBody: {
        startDate: fmt(startDate),
        endDate: fmt(endDate),
        dimensions: ['page'],
        rowLimit: 25,
      },
    }),
    sc.searchanalytics.query({
      siteUrl: SITE_URL,
      requestBody: {
        startDate: fmt(startDate),
        endDate: fmt(endDate),
        dimensions: ['device'],
        rowLimit: 5,
      },
    }),
  ]);

  const queries = (queryRes.data.rows || []).map(r => toRow(r, ['query']));
  const pages = (pageRes.data.rows || []).map(r => toRow(r, ['page']));
  const devices = (deviceRes.data.rows || []).map(r => toRow(r, ['device']));

  const totalClicks = queries.reduce((s, q) => s + q.clicks, 0);
  const totalImpressions = queries.reduce((s, q) => s + q.impressions, 0);
  const weightedPositionSum = queries.reduce((s, q) => s + q.position * q.impressions, 0);
  const avgPosition = totalImpressions > 0
    ? +(weightedPositionSum / totalImpressions).toFixed(1)
    : null;

  const result = {
    fetchedAt: new Date().toISOString(),
    siteUrl: SITE_URL,
    window: { startDate: fmt(startDate), endDate: fmt(endDate), days: 28 },
    summary: {
      totalClicks,
      totalImpressions,
      avgPosition,
      queryCount: queries.length,
      avgCTR: totalImpressions > 0 ? +((totalClicks / totalImpressions) * 100).toFixed(2) : 0,
    },
    queries,
    pages,
    devices,
    insights: {
      topByClicks: [...queries].sort((a, b) => b.clicks - a.clicks).slice(0, 20),
      nearMiss: queries
        .filter(q => q.position >= 8 && q.position <= 20 && q.impressions >= 5)
        .sort((a, b) => b.impressions - a.impressions)
        .slice(0, 20),
      highImpressionsLowCTR: queries
        .filter(q => q.impressions >= 10 && q.ctr < 3)
        .sort((a, b) => b.impressions - a.impressions)
        .slice(0, 20),
      zeroClicks: queries
        .filter(q => q.impressions >= 10 && q.clicks === 0)
        .sort((a, b) => b.impressions - a.impressions)
        .slice(0, 15),
    },
  };

  fs.mkdirSync(DATA_DIR, { recursive: true });
  const outPath = path.join(DATA_DIR, 'gsc-latest.json');
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8');

  console.log(`GSC fetch complete:`);
  console.log(`  Queries: ${queries.length}`);
  console.log(`  Clicks: ${totalClicks.toLocaleString()} | Impressions: ${totalImpressions.toLocaleString()}`);
  console.log(`  Avg position: ${avgPosition ?? 'n/a'}`);
  console.log(`  Near-miss queries: ${result.insights.nearMiss.length}`);
  console.log(`  Saved → ${path.relative(ROOT, outPath)}`);
}

main().catch(err => {
  console.error('gsc-fetch failed:', err.message);
  process.exit(1);
});
