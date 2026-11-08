# SEO operations

Prepared 2026-11-08. Local repository: /Users/office/terminal-jetaime.

## Activation

The weekly workflow runs Mondays at 07:00 UTC (09:00 Israel winter time, 10:00 summer time), after it is pushed to the GitHub default branch and Actions is enabled. The workflow is also triggered when its own file or report script changes on main, providing an initial delivery check. The GitHub connector is used for activation because shell network access is unavailable. Check the latest Actions run for delivery and Search Console status.

Configure GitHub Actions secrets TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID for the intended recipient. Existing code refers to these secrets, but their existence and recipients have not been verified. The owner has confirmed use of the existing Telegram setup.

For measured Google rankings, supply GSC_SERVICE_ACCOUNT_JSON (base64 service-account JSON), enable Search Console API, and grant the service-account email read access to the verified property. Set repository variable GSC_SITE_URL to the exact property, e.g. sc-domain:terminaljetaime.com or https://terminaljetaime.com/. Never put credentials in this repository or chat. The existing data/action-items.json marks Search Console registration complete; this is not proof API access is configured.

Run the workflow manually once after activation and verify the report artifact and Telegram receipt. Missing delivery configuration fails visibly; the report is still uploaded as an Actions artifact. Artifacts are retained for 90 days. Each run fetches its comparison from Search Console rather than treating retained reports as the source of truth.

## First priorities

1. Verify Search Console access and baseline. Total page views require a separate analytics integration; raw Railway request logs are not a reliable count of human visitors.
2. Deploy the prepared sitemap cleanup: section fragments are not independent documents. Keep one canonical homepage entry; add future guide URLs when published.
3. Deploy the date-refresh guard. Google documents lastmod as the last significant page change: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
4. Correct and verify macOS examples; the current homepage includes free -h, which needs a macOS-appropriate replacement and corresponding explanatory copy.
5. Develop original guides around pbcopy/pbpaste, caffeinate and finding files, choosing the first from actual query evidence. Add examples, limitations and internal links. Avoid thin near-duplicate keyword pages.
6. Draft relevant directory/community submissions for review. Outreach is not automated by the reporting workflow.

## Scope and limits

AGENTS.md provides the ongoing SEO agent instructions. The weekly workflow monitors and reports; it does not call an AI model, autonomously write content or deploy the site. No AI runtime or budget has been assumed. Site changes prepared locally are not live until deployed. Existing daily jobs and their current enabled/disabled schedules remain in place; the date-only updater now does nothing unless explicitly invoked with --content-updated after substantive editing.

Weekly report: completed repository commits (not deployment proof), finalized weekly search comparisons, query/page ranking movements, technical availability and next actions. A decrease in average position is an improvement. Missing rows are not zeros; query data can omit anonymized searches. Improvements may take time and cannot be guaranteed.
