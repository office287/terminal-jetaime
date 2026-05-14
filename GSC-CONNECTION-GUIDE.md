# Connecting Google Search Console

A practical, project-specific guide for getting `terminaljetaime.com` into
Google Search Console (GSC) and submitting the sitemap. End-to-end: ~10
minutes of clicking, then 1–3 days waiting for Google to index.

> Why bother: without GSC we can't see real impressions, clicks, average
> position, or which queries actually surface the site. It's the single
> highest-leverage SEO action remaining (see `WorkRdmap.md` Priority 2).

---

## TL;DR

1. Sign in to <https://search.google.com/search-console> with the Google
   account you want to own the property long-term.
2. Add **`https://terminaljetaime.com`** as a **URL prefix** property.
3. Verify with the **HTML tag** method — paste a `<meta name="google-site-verification">`
   tag into `public/index.html`, deploy, click Verify.
4. Submit `https://terminaljetaime.com/sitemap.xml` under **Sitemaps**.
5. Run **URL Inspection → Request Indexing** on the homepage.
6. Wait 1–3 days. Come back to **Performance** for first impressions.

---

## Step 1 — Pick the right Google account

Use an account you control long-term and can share. Recommended:

- A dedicated `ops@` / `seo@` Google Workspace account if one exists, or
- The personal account that owns the domain registration.

Avoid using a throwaway account — losing access means losing historical
search data.

You can add additional users later under **Settings → Users and permissions**
(Owner / Full / Restricted).

## Step 2 — Choose the property type

GSC offers two property types:

| Type           | Covers                                | Verification          |
| -------------- | ------------------------------------- | --------------------- |
| **Domain**     | All subdomains + `http`/`https`       | DNS TXT record        |
| **URL prefix** | One exact origin only                 | HTML tag, file, GA, GTM, DNS |

**Recommended: URL prefix `https://terminaljetaime.com`.**

Reasoning for this project:

- We only serve one origin (single Express app on Railway, no subdomains).
- HTML-tag verification is the fastest path — we already control
  `public/index.html` and deploy on push.
- DNS verification (Domain property) is fine too, but requires registrar
  access and a DNS propagation wait. Skip the friction unless we later add
  `blog.terminaljetaime.com` or similar.

If `www.terminaljetaime.com` is reachable, add it as a **second** URL-prefix
property and 301-redirect it to the apex — GSC treats them as distinct.

## Step 3 — Verify ownership (HTML tag method)

1. In GSC, after entering the URL prefix, choose **HTML tag** under
   "Other verification methods".
2. Copy the tag. It looks like:

   ```html
   <meta name="google-site-verification" content="ABC123...xyz" />
   ```

3. Open `public/index.html` and paste it inside `<head>`, immediately
   after the existing meta tags (around line 8, just after the canonical
   link). Keep the tag — Google rechecks periodically.
4. Commit and push. Railway auto-deploys on push to the main branch.
5. Wait ~30 seconds for the deploy, hit
   <https://terminaljetaime.com> in a private window, view source, and
   confirm the tag is live.
6. Back in GSC, click **Verify**.

If verification fails:

- Make sure the tag is in `<head>`, not `<body>`.
- Confirm Railway actually deployed (check the dashboard).
- Bust any CDN cache; verify with `curl -s https://terminaljetaime.com | grep google-site-verification`.

### Alternative: DNS TXT (only if doing Domain property)

At the domain registrar (e.g. Namecheap, Cloudflare), add a TXT record on
the apex (`@`) with the value GSC provides. Propagation can take from a
minute to a few hours. Check with:

```bash
dig +short TXT terminaljetaime.com
```

## Step 4 — Submit the sitemap

We already serve a sitemap at `public/sitemap.xml`, exposed at
<https://terminaljetaime.com/sitemap.xml>.

1. In GSC, open **Indexing → Sitemaps**.
2. Enter `sitemap.xml` (the field auto-prepends the property URL).
3. Click **Submit**. Status should flip to **Success** within a few
   minutes; "Discovered URLs" updates over the next day or two.

Re-submit whenever the sitemap's URL set changes. The `lastmod` field is
what triggers Google to recrawl an entry, so keep it accurate — the
nightly report pipeline already updates it when content changes.

## Step 5 — Force first-crawl with URL Inspection

Don't wait for organic discovery. For each important URL:

1. Paste the URL into the top search bar in GSC (it's the **URL
   Inspection** tool).
2. If "URL is not on Google", click **Request Indexing**.

Prioritize:

- `https://terminaljetaime.com/`
- Any future deep links once `/tips` and command guides land (see
  `WorkRdmap.md` Priority 3).

Quota is roughly ~10 manual requests per day per property — fine for our
URL count.

## Step 6 — Confirm robots.txt and sitemap aren't blocking anything

Sanity-check that `public/robots.txt` allows Googlebot and references the
sitemap. The current file already does — it has an explicit
`User-agent: *` Allow-all plus the `Sitemap:` line. If you ever tighten
robots.txt, make sure these stay intact:

```
User-agent: Googlebot
Allow: /

Sitemap: https://terminaljetaime.com/sitemap.xml
```

Test in GSC under **Settings → robots.txt** (it shows the parsed version
Google is using).

---

## What to monitor after the first 72 hours

Open these GSC views weekly:

- **Performance → Search results** — impressions, clicks, CTR, average
  position. Filter to queries like _macOS terminal cheat sheet_, _mac
  terminal commands_, _terminal je t'aime_.
- **Indexing → Pages** — confirms the homepage is "Indexed". Investigate
  anything under "Not indexed".
- **Experience → Core Web Vitals** — should be all-green given the static
  single-page build, but watch for regressions after UI changes.
- **Links** — external referring domains. Useful proxy for distribution
  efforts (Product Hunt, Reddit, HN — `WorkRdmap.md` Priority 1).

Tie this back into the morning report: once GSC is live we can pull the
Search Analytics API into `scripts/morning-report.js` and surface
top-impression queries automatically.

---

## Granting access to collaborators

**Settings → Users and permissions → Add user.** Roles:

- **Owner** — can add/remove users and change settings. Reserve for
  one or two people.
- **Full** — can use all data and tools, no permission changes. Default
  for engineers.
- **Restricted** — read-only views. Good for stakeholders.

Verified ownership lives on the verification method, not the account, so
adding users is safe — they inherit access without re-verifying.

---

## Removing the verification later

Don't. Even if GSC says verification has passed, removing the meta tag
will cause Google to un-verify on its next check (typically within a few
days), and you'll silently lose access to data until re-verified. Keep
the tag in `public/index.html` permanently.

---

## Checklist

- [ ] Signed in with the right Google account
- [ ] Added URL prefix property for `https://terminaljetaime.com`
- [ ] Pasted `google-site-verification` meta tag into `public/index.html`
- [ ] Deployed to Railway and confirmed tag is live in production HTML
- [ ] Clicked **Verify** in GSC
- [ ] Submitted `sitemap.xml` under **Indexing → Sitemaps**
- [ ] Requested indexing on the homepage via URL Inspection
- [ ] Added a second collaborator as Owner (bus-factor insurance)
- [ ] Bookmarked **Performance** for the weekly check-in

Once those are ticked, update `WorkRdmap.md` Priority 2 and
`data/action-items.json` to close the GSC items out.
