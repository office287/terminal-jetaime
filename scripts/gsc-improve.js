#!/usr/bin/env node
/**
 * scripts/gsc-improve.js
 *
 * Reads data/gsc-latest.json, sends the data + current site content to Claude,
 * and applies the suggested improvements to public/index.html:
 *   - New FAQ entries for near-miss / high-impression queries
 *   - Meta description update when CTR improvement is likely
 *
 * Also saves a JSON report to reports/YYYY-MM-DD-gsc.json so the morning
 * report can include an AI analysis section.
 *
 * Required env vars (set in .env.local or as GitHub secrets):
 *   ANTHROPIC_API_KEY  — Claude API key (console.anthropic.com/settings/keys)
 *
 * Usage:
 *   node scripts/gsc-improve.js            # apply improvements
 *   node scripts/gsc-improve.js --dry-run  # analyze but don't write files
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const REPORTS_DIR = path.join(ROOT, 'reports');
const HTML_PATH = path.join(ROOT, 'public', 'index.html');
const GSC_PATH = path.join(ROOT, 'data', 'gsc-latest.json');

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

const API_KEY = process.env.ANTHROPIC_API_KEY;
const DRY_RUN = process.argv.includes('--dry-run');

if (!API_KEY) {
  console.log('ANTHROPIC_API_KEY not set — skipping AI analysis.');
  process.exit(0);
}

if (!fs.existsSync(GSC_PATH)) {
  console.log('No GSC data at data/gsc-latest.json — run gsc-fetch.js first.');
  process.exit(0);
}

// ── Claude API ────────────────────────────────────────────────────────────────

function callClaude(userMessage) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: userMessage }],
    });
    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          return reject(new Error(`Claude API ${res.statusCode}: ${data.slice(0, 400)}`));
        }
        resolve(JSON.parse(data).content[0].text);
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── HTML helpers ──────────────────────────────────────────────────────────────

function extractFaqQuestions(html) {
  return [...html.matchAll(/<h3 itemprop="name">([^<]+)<\/h3>/g)].map(m => m[1]);
}

function extractMetaDescription(html) {
  const m = html.match(/<meta name="description" content="([^"]+)"/);
  return m ? m[1] : '';
}

function injectDomFaqs(html, newFaqs) {
  const faqSectionStart = html.indexOf('id="faq"');
  if (faqSectionStart === -1) return { html, count: 0 };

  const sectionClose = html.indexOf('</section>', faqSectionStart);
  if (sectionClose === -1) return { html, count: 0 };

  // Insert after the last </article> inside the faq section
  const lastArticleEnd = html.lastIndexOf('</article>', sectionClose);
  if (lastArticleEnd === -1) return { html, count: 0 };

  const insertAt = lastArticleEnd + '</article>'.length;
  let injected = '\n';
  for (const { question, answer } of newFaqs) {
    injected += `    <article class="faq-item" itemscope itemtype="https://schema.org/Question">
      <h3 itemprop="name">${escHtml(question)}</h3>
      <div itemprop="acceptedAnswer" itemscope itemtype="https://schema.org/Answer">
        <p itemprop="text">${escHtml(answer)}</p>
      </div>
    </article>\n`;
  }

  return {
    html: html.slice(0, insertAt) + injected + html.slice(insertAt),
    count: newFaqs.length,
  };
}

function injectJsonLdFaqs(html, newFaqs) {
  const faqTypeMarker = '"@type": "FAQPage"';
  const faqTypePos = html.indexOf(faqTypeMarker);
  if (faqTypePos === -1) return html;

  const scriptOpen = '<script type="application/ld+json">';
  // Find the last <script type="application/ld+json"> before the FAQPage marker
  let blockStart = -1;
  let pos = 0;
  while (pos < faqTypePos) {
    const found = html.indexOf(scriptOpen, pos);
    if (found === -1 || found > faqTypePos) break;
    blockStart = found;
    pos = found + 1;
  }
  if (blockStart === -1) return html;

  const jsonStart = blockStart + scriptOpen.length;
  const jsonEnd = html.indexOf('</script>', jsonStart);
  if (jsonEnd === -1) return html;

  let schema;
  try {
    schema = JSON.parse(html.slice(jsonStart, jsonEnd).trim());
  } catch (e) {
    console.warn('Could not parse FAQPage JSON-LD — skipping schema update:', e.message);
    return html;
  }

  if (!Array.isArray(schema.mainEntity)) schema.mainEntity = [];
  for (const { question, answer } of newFaqs) {
    schema.mainEntity.push({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    });
  }

  return (
    html.slice(0, jsonStart) +
    '\n' + JSON.stringify(schema, null, 2) + '\n' +
    html.slice(jsonEnd)
  );
}

function updateMetaDescription(html, newDesc) {
  const truncated = newDesc.slice(0, 155);
  return html.replace(
    /<meta name="description" content="[^"]*"/,
    `<meta name="description" content="${escAttr(truncated)}"`
  );
}

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function dedupeFaqs(proposed, currentQuestions) {
  const normalized = new Set(currentQuestions.map(q => q.toLowerCase().trim()));
  return proposed.filter(f => !normalized.has(f.question.toLowerCase().trim()));
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const today = new Date().toISOString().slice(0, 10);

  const gsc = JSON.parse(fs.readFileSync(GSC_PATH, 'utf8'));
  const html = fs.readFileSync(HTML_PATH, 'utf8');

  const currentFaqs = extractFaqQuestions(html);
  const currentMeta = extractMetaDescription(html);

  // Compact GSC summary to control token cost
  const gscSummary = {
    window: gsc.window,
    summary: gsc.summary,
    topByClicks: gsc.insights?.topByClicks?.slice(0, 15) || [],
    nearMiss: gsc.insights?.nearMiss?.slice(0, 15) || [],
    highImpressionsLowCTR: gsc.insights?.highImpressionsLowCTR?.slice(0, 15) || [],
    zeroClicks: gsc.insights?.zeroClicks?.slice(0, 10) || [],
  };

  const prompt = `You are an SEO specialist reviewing terminaljetaime.com — a free macOS terminal command cheat sheet (88 commands, 12 categories, instant search, one-click copy).

CURRENT META DESCRIPTION (${currentMeta.length} chars):
${currentMeta}

CURRENT FAQ QUESTIONS — do NOT duplicate these:
${currentFaqs.map((q, i) => `${i + 1}. ${q}`).join('\n')}

GOOGLE SEARCH CONSOLE DATA — last ${gsc.window?.days || 28} days:
${JSON.stringify(gscSummary, null, 2)}

Analyze the data and return improvements as a JSON object with these exact keys:

{
  "analysis": "2-3 sentence diagnosis: what is working, what is underperforming, what is the biggest opportunity",
  "metaDescriptionUpdate": null,
  "newFAQs": [
    { "question": "...", "answer": "..." }
  ],
  "suggestions": ["...", "..."]
}

Rules:
- newFAQs: max 3. Only include questions that directly match real queries in the GSC data (prefer near-miss and high-impression ones). Answers must be accurate, factual, ≤2 sentences, and relevant to macOS terminal use. Do not duplicate existing FAQ questions.
- metaDescriptionUpdate: set to null unless CTR is noticeably low AND you can write a clearly better description (max 155 chars) that matches top queries. If you do update it, make it specific and compelling.
- suggestions: 3-5 concrete, actionable improvement ideas for the human (e.g. "add a section on X commands", "target the query Y with a dedicated how-to").
- Output ONLY valid JSON. No markdown fences, no extra text outside the JSON object.`;

  console.log('Calling Claude for GSC analysis...');
  let rawResponse;
  try {
    rawResponse = await callClaude(prompt);
  } catch (err) {
    console.error('Claude API error:', err.message);
    process.exit(1);
  }

  let improvements;
  try {
    const match = rawResponse.match(/\{[\s\S]*\}/);
    improvements = JSON.parse(match ? match[0] : rawResponse);
  } catch {
    console.error('Failed to parse Claude response as JSON.\nRaw:\n', rawResponse.slice(0, 600));
    process.exit(1);
  }

  console.log('Analysis:', improvements.analysis);

  const actions = [];
  let updated = html;

  // 1. New FAQs
  const proposed = (improvements.newFAQs || []).slice(0, 3);
  const newFaqs = dedupeFaqs(proposed, currentFaqs);

  if (newFaqs.length > 0) {
    const domResult = injectDomFaqs(updated, newFaqs);
    if (domResult.count > 0) {
      updated = injectJsonLdFaqs(domResult.html, newFaqs);
      for (const f of newFaqs) {
        actions.push({ type: 'faq', question: f.question });
        console.log(`  + FAQ: "${f.question}"`);
      }
    }
  }

  // 2. Meta description
  if (improvements.metaDescriptionUpdate) {
    updated = updateMetaDescription(updated, improvements.metaDescriptionUpdate);
    actions.push({ type: 'meta_description', value: improvements.metaDescriptionUpdate.slice(0, 155) });
    console.log('  + Updated meta description.');
  }

  if (!DRY_RUN && updated !== html) {
    fs.writeFileSync(HTML_PATH, updated, 'utf8');
    console.log(`Wrote index.html (${actions.length} change(s) applied).`);
  } else if (DRY_RUN) {
    console.log(`Dry run — ${actions.length} change(s) would be applied.`);
  } else {
    console.log('No changes needed.');
  }

  const report = {
    date: today,
    dryRun: DRY_RUN,
    gscWindow: gsc.window,
    gscSummary: gsc.summary,
    analysis: improvements.analysis,
    actions,
    suggestions: improvements.suggestions || [],
    newFAQsProposed: newFaqs,
  };

  const reportPath = path.join(REPORTS_DIR, `${today}-gsc.json`);
  if (!DRY_RUN) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`Saved GSC report → ${path.relative(ROOT, reportPath)}`);
  }

  if (DRY_RUN) console.log(JSON.stringify(report, null, 2));
}

main().catch(err => { console.error(err); process.exit(1); });
