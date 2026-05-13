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

### SEO — Phase 2: AI SEO (Partial)
- [x] Semantic `<section>` tags with descriptive `id` attributes per category
- [x] Intro paragraph for AI extractability (definitional, citable)
- [x] Stats visible: "68 commands / 11 categories"
- [x] "Last updated: May 2026" in footer (auto-bumped on content changes)
- [ ] Source citations for complex commands (man pages / Apple docs links)
- [ ] Developer testimonial or quote
- [ ] Dedicated "About" section establishing credibility

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

Currently flying blind on search impressions.

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

- [ ] **Click/copy event tracking** — log which command was copied (anonymized). Store in server logs or a lightweight DB. Lets you see what's actually useful.
- [ ] **Search term logging** — what are people searching for that returns no results? Fill those gaps with new commands.
- [ ] **Plausible or Umami** — privacy-respecting web analytics dashboard (vs. current Telegram PDFs which are useful but manual to query).
- [ ] **AI citation monitoring** — monthly manual check: search "macOS terminal cheat sheet" on ChatGPT, Perplexity, Google AI Overviews. Track if the site appears.

### Priority 6 — Technical Cleanup

- [ ] **Move secrets out of code** — Telegram bot token and chat IDs are hardcoded in `scripts/daily-report.js`. Move to environment variables.
- [x] **README.md** — added at repo root. Documents project, stack, local setup, layout, deployment, contributing.
- [ ] **Error handling in daily-report.js** — script fails silently if Railway API is down or Telegram delivery fails. Add try/catch + fallback logging.
- [ ] **sitemap.xml auto-update** — `lastmod` date is hardcoded. Should update automatically when content changes or at deploy time.
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
| SEO technical | Done | All Phase 1 complete |
| SEO AI structure | Partial | Structure done, citations/testimonials missing |
| SEO content pages | Not started | Needs multi-page routing first |
| Distribution | Not started | Biggest gap — nobody knows this exists |
| Analytics | Partial | Custom logging + Telegram reports; no GSC or click tracking |
| GitHub presence | Not public | Blocks discoverability and Awesome list submissions |
| Secrets management | Issue | Bot token hardcoded in script |
| Documentation | Done | README.md added |
