# scripts/

Three scripts:

1. **`nightly-improve.js`** — applies deterministic site improvements
2. **`morning-report.js`** — audits the site and sends the SEO/AEO Telegram report
3. **`daily-report.js`** — daily traffic PDF (visits, geo, device, bots) sent via Telegram

(1) + (2) run nightly via `.github/workflows/nightly-seo.yml`.
(3) runs every morning at 07:00 UTC via `.github/workflows/daily-traffic.yml`.

---

## daily-report.js (traffic report)

Reads real visit data from the live site's token-protected `/__stats` endpoint
(served by `server.js`) over HTTPS, builds a PDF, and sends it via Telegram. No
Railway CLI involved — it works from any GitHub Actions runner.

Env vars (`process.env`, set in `.env.local` locally or repo secrets in CI):

- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` — Telegram delivery (no hardcoded creds).
- `STATS_TOKEN` — shared secret; **must match** the `STATS_TOKEN` set on the server.
- `STATS_URL` — live site base URL (default `https://terminaljetaime.com`).

PDF delivery uses the Telegram `sendDocument` endpoint with a multipart upload;
PDFKit is already in `dependencies`.

> **Persistence:** the server writes visits to `data/hits.jsonl`. Railway's
> filesystem is ephemeral, so point `STATS_DATA_DIR` at a mounted Railway
> volume — otherwise the store resets on every redeploy (including the nightly
> push to `main`) and the report only sees traffic since the last deploy.

### Run it locally

```bash
# 1. start the server with a token
STATS_TOKEN=devsecret npm start
# 2. in another shell, point the report at it
STATS_URL=http://localhost:3000 STATS_TOKEN=devsecret npm run traffic
# add `-- 2026-05-15` for a specific date, or `-- --out report.pdf` to save the PDF
```

Reports **yesterday** (a complete UTC day) by default. Also needs `.env.local`
to have `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` for delivery.

---

## nightly-improve.js

Runs unattended. Refreshes the site's "last updated" signals so search and
answer engines see ongoing activity:

- Updates `<lastmod>` dates in `public/sitemap.xml` to today
- Updates `dateModified` in JSON-LD `WebApplication` schema to today
- Updates the visible `<time>` "Last updated Month YYYY" stamp
- Updates the "Last updated:" line in the intro paragraph
- Refreshes `llms.txt` last-updated line

The actions taken are written to `reports/.last-nightly.json` so the report
script can include them in the "What was done tonight" section.

```bash
node scripts/nightly-improve.js             # apply changes
node scripts/nightly-improve.js --dry-run   # preview only
```

---

## morning-report.js

Generates a dated SEO/AEO audit at `reports/YYYY-MM-DD-morning.md` and
sends it to Telegram.

The report contains four sections:

1. **What was done tonight** — populated from `reports/.last-nightly.json`
2. **Your action items** — open items pulled from `data/action-items.json`
3. **Site audit (live snapshot)** — bytes, heading hierarchy, JSON-LD blocks,
   FAQ counts, meta tags, robots/sitemap/llms.txt state
4. **Health checks** — 16 pass/fail signals scored

### Telegram delivery

Two env vars enable delivery:

```bash
export TELEGRAM_BOT_TOKEN="123456:ABC-DEF..."
export TELEGRAM_CHAT_ID="123456789"        # comma-separated for multiple IDs
```

For local runs, put them in `.env.local` at the repo root — the script
auto-loads it. The file is gitignored.

If neither is set, the script writes the markdown file and skips Telegram
silently.

### npm scripts

| Command | What it does |
|---------|-------------|
| `npm run report` | Generate today's report (skip if exists) + send to Telegram |
| `npm run report:force` | Regenerate today's report (overwrite) + send |
| `npm run report:no-send` | Generate report but skip Telegram |

---

## Nightly automation (GitHub Actions)

`.github/workflows/nightly-seo.yml` runs every night at **04:00 UTC**
(adjust the cron expression in that file for your timezone).

It:

1. Checks out main
2. Runs `nightly-improve.js`
3. Runs `morning-report.js --force` (sends Telegram)
4. Commits and pushes any changes back to main

### Required GitHub repo secrets

Set these under **Settings → Secrets and variables → Actions**:

| Secret | Purpose |
|--------|---------|
| `TELEGRAM_BOT_TOKEN` | Telegram bot API token |
| `TELEGRAM_CHAT_ID` | Chat IDs to receive the report (comma-separated) |

Without them, the workflow still runs and commits the report file, but no
Telegram message is sent.

---

## Action items file

Edit `data/action-items.json` to manage the "Your action items" list
shown in each report. Each item has:

```json
{
  "id": "stable-slug",
  "title": "What to do",
  "why": "Why it matters in one line",
  "url": "https://...",
  "status": "open"   // change to "closed" once done
}
```

The top 5 open items appear in each Telegram report.

---

## Other triggers (any of these keep the cadence going)

1. **GitHub Actions cron** (primary) — `.github/workflows/nightly-seo.yml`
2. **Manual:** `npm run report`
3. **Claude Code SessionStart hook** — `.claude/settings.json` regenerates
   the report when you open the repo in a new Claude Code session
4. **Local cron / Railway scheduled job:**

   ```cron
   # Every night at 04:00 server time
   0 4 * * * cd /path/to/terminal-jetaime && /usr/bin/node scripts/nightly-improve.js && /usr/bin/node scripts/morning-report.js --force
   ```
