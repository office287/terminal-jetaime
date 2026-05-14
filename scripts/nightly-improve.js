#!/usr/bin/env node
/**
 * scripts/nightly-improve.js
 *
 * Deterministic nightly SEO/AEO refresh. Designed to run unattended.
 * Returns an array of actions taken (printed as JSON) so the report
 * script can include "what was done tonight" in the Telegram message.
 *
 * Improvements applied:
 *   1. Update <lastmod> in public/sitemap.xml to today
 *   2. Update "dateModified" in JSON-LD WebApplication schema to today
 *   3. Update <time datetime="..."> "Last updated" tag in index.html
 *   4. Update the "Last updated: Month YYYY" copy in the visible intro paragraph
 *   5. Refresh llms.txt "Last updated" line
 *
 * Why freshness matters: Google, Perplexity, ChatGPT, and Claude all weight
 * recency. A site that visibly updates beats a static one for the same query.
 *
 * Usage:
 *   node scripts/nightly-improve.js            # apply + print actions JSON
 *   node scripts/nightly-improve.js --dry-run  # show what would change
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');

const ARGS = new Set(process.argv.slice(2));
const DRY_RUN = ARGS.has('--dry-run');

const today = new Date().toISOString().slice(0, 10);
const monthYear = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });

const actions = [];

function readFile(p) {
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
}

function writeFile(p, text, label) {
  if (DRY_RUN) {
    actions.push({ file: path.relative(ROOT, p), action: 'would update', detail: label });
    return;
  }
  fs.writeFileSync(p, text, 'utf8');
  actions.push({ file: path.relative(ROOT, p), action: 'updated', detail: label });
}

function applySitemapRefresh() {
  const file = path.join(PUBLIC_DIR, 'sitemap.xml');
  const orig = readFile(file);
  if (!orig) return;
  const updated = orig.replace(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/g, `<lastmod>${today}</lastmod>`);
  if (updated !== orig) writeFile(file, updated, `sitemap lastmod -> ${today}`);
}

function applyIndexRefresh() {
  const file = path.join(PUBLIC_DIR, 'index.html');
  const orig = readFile(file);
  if (!orig) return;
  let updated = orig;

  // 1. JSON-LD dateModified (top WebApplication block)
  updated = updated.replace(/"dateModified"\s*:\s*"\d{4}-\d{2}-\d{2}"/g, `"dateModified": "${today}"`);

  // 2. <time datetime="..."> Last updated Month YYYY
  updated = updated.replace(
    /<time datetime="\d{4}-\d{2}-\d{2}">Last updated [^<]+<\/time>/g,
    `<time datetime="${today}">Last updated ${monthYear}</time>`
  );

  // 3. Intro paragraph "Last updated: Month YYYY."
  updated = updated.replace(
    /Last updated:\s*[A-Za-z]+\s+\d{4}\./g,
    `Last updated: ${monthYear}.`
  );

  if (updated !== orig) writeFile(file, updated, `dateModified + last-updated -> ${today}`);
}

function applyLlmsTxtRefresh() {
  const file = path.join(PUBLIC_DIR, 'llms.txt');
  const orig = readFile(file);
  if (!orig) return;
  const updated = orig.replace(
    /Last updated:\s*[A-Za-z]+\s+\d{4}/g,
    `Last updated: ${monthYear}`
  );
  if (updated !== orig) writeFile(file, updated, `llms.txt last-updated -> ${monthYear}`);
}

function main() {
  applySitemapRefresh();
  applyIndexRefresh();
  applyLlmsTxtRefresh();

  const summary = {
    date: today,
    dryRun: DRY_RUN,
    actions,
    actionCount: actions.length,
  };

  // Persist for the report script to read.
  const outFile = path.join(ROOT, 'reports', '.last-nightly.json');
  if (!DRY_RUN) {
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, JSON.stringify(summary, null, 2), 'utf8');
  }

  console.log(JSON.stringify(summary, null, 2));
}

main();
