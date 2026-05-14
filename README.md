# terminal je t'aime

A beautifully curated macOS terminal command cheat sheet. 88 essential commands across 12 categories — navigation, file management, Git, search, permissions, networking, JavaScript/Node, macOS-specific tools, and more. Search instantly, copy with one click.

Live site: [terminaljetaime.com](https://terminaljetaime.com)

## Features

- **88 commands, 12 categories** — focused on what macOS developers actually use
- **Real-time search** — press `/` to focus, `Esc` to clear
- **One-click copy** — click any command to copy it to your clipboard
- **Keyboard-first UX** — designed to stay out of your way
- **Responsive** — works on mobile, scales up cleanly on desktop
- **Fast** — single static HTML page, no framework, no tracking scripts
- **AEO-ready** — FAQPage / HowTo / Speakable JSON-LD, `llms.txt`, 29-bot allowlist

## Stack

- **Backend:** Node.js + Express
- **Frontend:** Vanilla HTML, CSS, JS (single `public/index.html`)
- **Logging:** Morgan with geoip-lite for geolocation tagging
- **Hosting:** Railway

## Getting started

Requirements: Node.js 18+

```bash
git clone https://github.com/office287/terminal-jetaime.git
cd terminal-jetaime
npm install
npm start
```

The server listens on `http://localhost:3000` by default. Override with the `PORT` env var.

## Project layout

```
.
├── server.js          # Express server + request logging
├── package.json
├── public/
│   ├── index.html     # The entire UI (HTML + CSS + JS in one file)
│   ├── favicon.svg
│   ├── robots.txt
│   ├── sitemap.xml
│   └── llms.txt       # LLM index per llmstxt.org (AEO standard)
├── scripts/
│   └── morning-report.js  # Daily SEO/AEO audit + report generator
├── reports/           # Dated daily SEO/AEO progress reports
├── .claude/
│   └── settings.json  # SessionStart hook that auto-runs the daily report
├── SEO-PLAN.md        # SEO strategy and roadmap
└── WorkRdmap.md       # Work roadmap and priorities
```

## Daily SEO/AEO reports

Every morning a fresh audit is written to `reports/YYYY-MM-DD-morning.md`. The
report includes a live audit of structured data, FAQ counts, heading
hierarchy, meta tags, robots.txt coverage, sitemap state, `llms.txt`
presence, the commits in the window since the previous report, and a 16-point
health-check score.

Run manually:

```bash
npm run report          # write today's report (no-op if it already exists)
npm run report:force    # overwrite today's report
```

It also runs automatically at the start of every Claude Code session in this
repo via `.claude/settings.json` (SessionStart hook), so simply opening the
repo in Claude Code keeps the cadence going.

## Deployment

The site is deployed on Railway. Any platform that runs Node.js 18+ works — set `PORT` if your host doesn't inject it automatically, then run `npm start`.

## Contributing

Issues and PRs welcome, especially:
- Missing macOS-specific commands (e.g. `pbcopy`, `mdfind`, `caffeinate`, `defaults`, `launchctl`)
- UX improvements
- Accessibility fixes

## License

MIT
