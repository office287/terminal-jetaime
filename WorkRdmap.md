# Work Roadmap — terminal je t'aime

**Site:** terminaljetaime.com
**Stack:** Node.js / Express / Vanilla HTML+CSS+JS / Railway
**Purpose:** Free macOS terminal cheat sheet — 88 commands, 12 categories, instant copy

---

## What's Built

### Core Product
- [x] Single-page app — 88 commands across 12 categories
- [x] Dedicated macOS-specific section (pbcopy, pbpaste, open -a, mdfind, caffeinate, say, defaults, launchctl, softwareupdate, networksetup)
- [x] JavaScript / Node section (node, npm install, npm run, npx, npx expo, etc.)
- [x] Real-time search (press `/` to focus, `Esc` to clear)
- [x] One-click copy to clipboard with flash animation
- [x] Keyboard-first UX design
- [x] Responsive grid layout (mobile-friendly)
- [x] Dark terminal aesthetic (Playfair Display + DM Mono + DM Sans)
- [x] Grain texture, hover states, smooth animations
- [x] Favicon (SVG, "tj" logomark)

### Backend & Infrastructure
- [x] Express server with Morgan request logging
- [x] Geolocation tagging on every request (geoip-lite — country/region/city)
- [x] Deployed on Railway
- [x] Static file serving + SPA catch-all

### Analytics & Reporting
- [x] Daily traffic report script (`scripts/daily-report.js`)
- [x] PDF generation with PDFKit (traffic stats, device breakdown, geo data)
- [x] Bot/crawler classification and filtering
- [x] Telegram delivery to 2 chat IDs every day

### SEO — Phase 1: Technical (Complete)
- [x] Page title optimized: `terminal je t'aime — macOS Terminal Command Cheat Sheet`
- [x] Meta description
- [x] Canonical URL
- [x] Open Graph tags (og:title, og:description, og:image, og:type, og:url)
- [x] Twitter Card tags
- [x] OG image — 1200×630px, matches site aesthetic
- [x] JSON-LD structured data (WebApplication schema)
- [x] robots.txt — explicit allowlist for AI bots (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, anthropic-ai)
- [x] sitemap.xml

### SEO — Phase 2: AI SEO (Complete)
- [x] Semantic `<section>` tags with descriptive `id` attributes per category
- [x] Intro paragraph for AI extractability (definitional, citable)
- [x] Stats visible: "88 commands / 12 categories"
- [x] "Last updated: <Month YYYY>" in footer (auto-bumped nightly by `scripts/nightly-improve.js`)
- [x] Source citations for complex commands (man pages / Apple docs links)
- [x] Dedicated "About" section establishing credibility (with stat cards)
- [x] Every category title promoted from `<span>` to `<h2>` for crawler hierarchy
- [ ] Developer testimonial or quote (would lift AI citation by ~30% per Princeton GEO research)

### SEO — Phase 2.5: AEO foundation (Complete)
- [x] **FAQPage JSON-LD** — 10 Q&As targeting Google AI Overviews and Perplexity
- [x] **Visible FAQ block** with microdata (`itemscope` / `itemprop`) for redundancy
- [x] **HowTo JSON-LD** — covers the search-and-copy flow
- [x] **BreadcrumbList JSON-LD**
- [x] **Speakable schema** — voice-assistant ready
- [x] Extended `WebApplication` schema (featureList, screenshot, publisher Organization, inLanguage, isAccessibleForFree, datePublished)
- [x] **`llms.txt`** at site root per llmstxt.org spec
- [x] **robots.txt expanded to 24+ explicit user-agents** — all major AI crawlers (OAI-SearchBot, Applebot-Extended, Meta-ExternalAgent, Amazonbot, Bytespider, CCBot, Diffbot, MistralAI-User, etc.)
- [x] sitemap.xml lists FAQ + About + category anchor URLs

### Nightly Automation Pipeline (Complete)
- [x] **`scripts/nightly-improve.js`** — deterministic SEO/AEO refresh (sitemap `<lastmod>`, JSON-LD `dateModified`, visible "Last updated" stamp, llms.txt date)
- [x] **`scripts/morning-report.js`** — site audit + 16-point health check + commits-in-window + "What was done tonight" + "Your action items" → Markdown file at `reports/YYYY-MM-DD-morning.md`
- [x] **Telegram delivery** — auto-sends each report to chat IDs in `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` (reads `.env.local` locally; uses GitHub repo secrets in CI)
- [x] **`.github/workflows/nightly-seo.yml`** — cron at `0 4 * * *` UTC; runs improve → report → push back to main
- [x] **`data/action-items.json`** — tracked human TODOs surfaced in every report (top 5)
- [x] **Claude Code SessionStart hook** — `.claude/settings.json` regenerates the report whenever the repo is opened in Claude Code
- [x] **npm scripts:** `npm run nightly`, `npm run improve`, `npm run report`, `npm run report:force`, `npm run report:no-send`
- [x] **`.env.local` auto-loader** in the report script (no `dotenv` dep)
- [x] **Verified end-to-end** — Telegram messages confirmed delivered

---

## What's Missing (Prioritized)

### Priority 1 — Distribution (Highest ROI, costs only time)

The product is built. Nobody knows it exists. This is the biggest gap.

- [ ] **Make GitHub repo public** — add README with project description, setup instructions, screenshot. Indexes on Google, gets linked from Awesome lists, gives social proof.
- [ ] **Submit to Product Hunt** — free developer tools do well. Schedule for a Tuesday/Wednesday morning ET. Write a proper tagline and first comment.
- [ ] **Post on Reddit** — r/commandline, r/macOS, r/webdev, r/programming. Each sub needs a tailored post (not cross-post spam). Lead with the value, not the link.
- [ ] **Hacker News "Show HN"** — format: `Show HN: Terminal Je T'aime – macOS terminal cheat sheet with instant copy`. Post ~9am ET on a weekday.
- [ ] **Add to developer directories** — DevHunt, free-for.dev, Awesome Terminal, Awesome macOS.
- [ ] **Twitter/X + Bluesky** — post short demos (screen recording of copy-to-clipboard UX). Target developer accounts.

### Priority 2 — Google Search Console

Currently flying blind on search impressions. _Tracked as open items in `data/action-items.json` so they surface in every nightly Telegram report._

- [ ] Register terminaljetaime.com on Google Search Console
- [ ] Submit sitemap.xml via GSC
- [ ] Set up Google Alerts for "terminal je t'aime" brand mentions
- [ ] Monitor: impressions, clicks, average position for "macOS terminal cheat sheet", "mac terminal commands"

### Priority 3 — Content Pages (Phase 3 SEO)

Adds long-tail search traffic. Each page targets a specific developer query.

- [ ] `/commands/grep` — "how to use grep on mac". Definitive guide with real examples.
- [ ] `/commands/chmod` — "chmod permissions explained". Visual reference table + examples.
- [ ] `/commands/ssh` — "ssh commands cheat sheet mac". Step-by-step common scenarios.
- [ ] `/tips` — "macOS terminal tips and tricks". Top 10 productivity tips format.

**Required before building content pages:**
- [ ] Add actual route handling in `server.js` (currently sends index.html for all routes — SPA mode won't support distinct page content for crawlers)
- [ ] Or switch to SSR / static HTML generation per page

**Content format for AI citation:**
- Lead with one-sentence direct answer to the query
- Use comparison tables, numbered steps, real examples with output
- Keep under 1,500 words per page
- Internal links back to main cheat sheet

### Priority 4 — Feature Improvements

- [ ] **Most-copied tracking** — which commands get copied most? Log copy events server-side (or use a lightweight analytics event). Informs future content.
- [ ] **Category filter** — let users filter by category without searching. Tab bar or sidebar nav.
- [ ] **"Recently copied"** — floating list or session history of last 5 commands copied. Useful for workflows.
- [x] **Expand command coverage** — added a dedicated macOS section with 10 commands:
  - [x] `launchctl list` — list background services
  - [x] `softwareupdate -l` — macOS updates from CLI
  - [x] `pbcopy` / `pbpaste` — clipboard from terminal
  - [x] `open -a` — open apps from terminal
  - [x] `mdfind` — Spotlight from CLI
  - [x] `defaults read` — read macOS preference keys
  - [x] `caffeinate` and `caffeinate -t` — prevent sleep
  - [x] `say` — text-to-speech from terminal
  - [x] `networksetup -listallhardwareports` — list Wi-Fi & network interfaces
- [x] **Expo/React Native section** — renamed to "JavaScript / Node"; expanded from 1 to 10 commands (node, npm install, npm run, npx, npm outdated, etc.)

### Priority 5 — Analytics & Monitoring

- [x] **Daily SEO/AEO health-check report** — `scripts/morning-report.js` audits 16 signals nightly and DMs them to Telegram (see Nightly Automation Pipeline above).
- [ ] **Click/copy event tracking** — log which command was copied (anonymized). Store in server logs or a lightweight DB. Lets you see what's actually useful.
- [ ] **Search term logging** — what are people searching for that returns no results? Fill those gaps with new commands.
- [ ] **Plausible or Umami** — privacy-respecting web analytics dashboard (vs. current Telegram PDFs which are useful but manual to query).
- [ ] **AI citation monitoring** — monthly manual check: search "macOS terminal cheat sheet" on ChatGPT, Perplexity, Google AI Overviews. Track if the site appears.

### Priority 6 — Technical Cleanup

- [x] **`morning-report.js` secrets via env vars** — reads `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` from `.env.local` (gitignored) or GitHub repo secrets. Old `daily-report.js` traffic script still has hardcoded creds — needs migrating.
- [ ] **Move legacy `scripts/daily-report.js` secrets to env vars** — Telegram bot token and chat IDs are still hardcoded there.
- [x] **README.md** — added at repo root. Documents project, stack, local setup, layout, deployment, contributing.
- [ ] **Error handling in daily-report.js** — script fails silently if Railway API is down or Telegram delivery fails. Add try/catch + fallback logging.
- [x] **sitemap.xml auto-update** — `<lastmod>` is now bumped to today every night by `scripts/nightly-improve.js`.
- [ ] **Multi-page routing** — before building content pages, `server.js` needs to serve different HTML per route (or use static generation). Current catch-all blocks this.

---

## Suggested 4-Week Sprint

| Week | Focus | Goal |
|------|-------|------|
| **1** | Distribution | GitHub public + README, Product Hunt draft ready, Reddit posts written |
| **2** | Monitoring | Google Search Console set up, sitemap submitted, Alerts configured |
| **3** | Distribution launch | Product Hunt live, Reddit posts, HN Show HN |
| **4** | Content pages | Build `/tips` and one command guide (grep), set up multi-page routing |

---

## Target Keywords

| Type | Keyword |
|------|---------|
| Primary | macOS terminal cheat sheet |
| Primary | terminal commands mac |
| Primary | mac terminal commands list |
| Brand | terminal je t'aime |
| Secondary | command line cheat sheet macOS |
| Secondary | essential terminal commands mac |
| Long-tail | how to use grep on mac |
| Long-tail | chmod permissions explained |
| Long-tail | macOS terminal tips and tricks |

---

## Status Summary

| Area | Status | Notes |
|------|--------|-------|
| Core product | Done | Solid, polished, fast |
| SEO technical (Phase 1) | Done | All meta, OG, schema basics complete |
| SEO AI structure (Phase 2) | Done | Semantic h2s, intro, About + stats, source citations |
| AEO foundation (Phase 2.5) | Done | FAQ + HowTo + BreadcrumbList + Speakable schema, llms.txt, broad AI-bot allowlist |
| SEO content pages (Phase 3) | Not started | Needs multi-page routing first |
| Distribution | Not started | Biggest gap — nobody knows this exists. Tracked in `data/action-items.json`. |
| Analytics | Partial | Nightly Telegram audit + traffic PDF; no GSC, Plausible, or click tracking |
| Nightly automation pipeline | Done | GitHub Actions cron, deterministic refresh, audit + Telegram report. Verified working. |
| GitHub presence | Private | Blocks Awesome-list submissions. Tracked as open action item. |
| Secrets management | Partial | New scripts use env vars + .env.local; legacy `daily-report.js` still hardcoded |
| Documentation | Done | README.md + `scripts/README.md` cover the pipeline end-to-end |
