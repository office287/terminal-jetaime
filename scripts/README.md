# scripts/

## morning-report.js

Generates a dated SEO/AEO audit at `reports/YYYY-MM-DD-morning.md` and
sends it to Telegram.

### Telegram delivery

Set two environment variables:

```bash
export TELEGRAM_BOT_TOKEN="123456:ABC-DEF..."
export TELEGRAM_CHAT_ID="123456789"        # comma-separated for multiple IDs
```

On Railway, add them under **Variables** for the service running the report.

If neither variable is set, the script writes the file locally and skips
Telegram silently — no errors.

### npm scripts

| Command | What it does |
|---------|-------------|
| `npm run report` | Generate today's report (skip if exists) + send to Telegram |
| `npm run report:force` | Regenerate today's report (overwrite) + send to Telegram |
| `npm run report:no-send` | Generate report but skip Telegram |

### Triggers (any of these keep the cadence going)

1. **Manual:** `npm run report`
2. **Claude Code SessionStart hook:** runs automatically every time you open
   this repo in Claude Code (configured in `.claude/settings.json`).
3. **Cron / scheduled job:** add a daily cron entry on the host that runs the
   script. Example for a host with `/etc/cron.d/` access:

   ```cron
   # Run every morning at 07:00 server time
   0 7 * * * cd /path/to/terminal-jetaime && /usr/bin/node scripts/morning-report.js
   ```

   On Railway, schedule it via a Cron Job service that runs:
   `node scripts/morning-report.js && git add reports && git -c user.email=bot@terminaljetaime.com -c user.name=morning-bot commit -m "report: $(date +%F) morning" && git push`.
4. **GitHub Actions** (no extra infra): see `.github/workflows/morning-report.yml`.

### What it audits

- JSON-LD blocks present in `public/index.html` (count + `@type`)
- FAQ Q&A count in schema and in rendered DOM
- Heading hierarchy (h1 / h2 / h3 counts)
- Meta description, canonical, Open Graph, Twitter Card tags
- robots.txt user-agent count (broad AI bot allowlist signal)
- sitemap.xml URL count
- `llms.txt` presence
- Git commits since the previous report

### Output

A markdown file with a snapshot table, the commits in the window, and a
16-point health-check score. Designed to be skim-readable in <30 seconds.
The same content is sent as a Telegram message when credentials are configured.
