# terminal je t'aime

A beautifully curated macOS terminal command cheat sheet. 68 essential commands across 11 categories — navigation, file management, Git, search, permissions, networking, and more. Search instantly, copy with one click.

Live site: [terminaljetaime.com](https://terminaljetaime.com)

## Features

- **68 commands, 11 categories** — focused on what macOS developers actually use
- **Real-time search** — press `/` to focus, `Esc` to clear
- **One-click copy** — click any command to copy it to your clipboard
- **Keyboard-first UX** — designed to stay out of your way
- **Responsive** — works on mobile, scales up cleanly on desktop
- **Fast** — single static HTML page, no framework, no tracking scripts

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
│   └── sitemap.xml
├── SEO-PLAN.md        # SEO strategy and roadmap
└── WorkRdmap.md       # Work roadmap and priorities
```

## Deployment

The site is deployed on Railway. Any platform that runs Node.js 18+ works — set `PORT` if your host doesn't inject it automatically, then run `npm start`.

## Contributing

Issues and PRs welcome, especially:
- Missing macOS-specific commands (e.g. `pbcopy`, `mdfind`, `caffeinate`, `defaults`, `launchctl`)
- UX improvements
- Accessibility fixes

## License

MIT
