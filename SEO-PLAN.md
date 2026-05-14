# SEO Plan: Terminal Je T'aime

**Site:** [terminaljetaime.com](https://terminaljetaime.com/)
**Goal:** Brand awareness — get more developers discovering and using the cheat sheet
**Approach:** Quick wins first, with lightweight content expansion over time
**Framework:** AI SEO (Structure, Authority, Presence) + Traditional SEO fundamentals

---

## Current State Assessment

### What's Working
- Beautiful, fast single-page app with strong UX
- Focused, curated content (68 commands across 11 categories)
- Keyboard-first design that developers love
- Memorable, distinctive brand name ("terminal je t'aime")
- Lightweight tech stack (fast load times)

### What's Missing
- No meta description
- No Open Graph / Twitter Card tags
- No robots.txt
- No sitemap.xml
- No schema.org structured data
- No canonical URL
- No content beyond the single page
- No AI bot accessibility configuration
- No analytics or tracking

---

## Phase 1: Technical Quick Wins (Week 1)

These changes require minimal effort and have immediate impact.

### 1.1 Meta Tags & Social Sharing

Add to `<head>` in `index.html`:

```html
<!-- Primary Meta -->
<meta name="description" content="A beautifully curated macOS terminal command cheat sheet. 68 essential commands you actually need — search, copy, and use instantly.">
<link rel="canonical" href="https://terminaljetaime.com/">

<!-- Open Graph -->
<meta property="og:type" content="website">
<meta property="og:url" content="https://terminaljetaime.com/">
<meta property="og:title" content="terminal je t'aime — every command you actually need">
<meta property="og:description" content="A beautifully curated macOS terminal command cheat sheet. 68 essential commands organized in 11 categories with instant copy.">
<meta property="og:image" content="https://terminaljetaime.com/og-image.png">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="terminal je t'aime — every command you actually need">
<meta name="twitter:description" content="A beautifully curated macOS terminal command cheat sheet. 68 essential commands organized in 11 categories with instant copy.">
<meta name="twitter:image" content="https://terminaljetaime.com/og-image.png">
```

**Action:** Create an OG image (1200x630px) showcasing the terminal aesthetic and brand.

### 1.2 Structured Data (Schema.org)

Add JSON-LD schema to make the site citable by AI systems:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "terminal je t'aime",
  "url": "https://terminaljetaime.com",
  "description": "A beautifully curated macOS terminal command cheat sheet with 68 essential commands.",
  "applicationCategory": "DeveloperApplication",
  "operatingSystem": "macOS",
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
  "dateModified": "2026-04-03"
}
</script>
```

### 1.3 robots.txt

Create `public/robots.txt`:

```
User-agent: *
Allow: /

# AI Bots — explicitly allowed for AI SEO citation
User-agent: GPTBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: Bingbot
Allow: /

Sitemap: https://terminaljetaime.com/sitemap.xml
```

### 1.4 sitemap.xml

Create `public/sitemap.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://terminaljetaime.com/</loc>
    <lastmod>2026-04-03</lastmod>
    <priority>1.0</priority>
  </url>
</urlset>
```

*Update this as you add pages.*

### 1.5 Improve Page Title

Update `<title>` for better search visibility:

```html
<title>terminal je t'aime — macOS Terminal Command Cheat Sheet</title>
```

---

## Phase 2: AI SEO Optimization (Week 2)

Based on the AI SEO framework's three pillars: **Structure, Authority, Presence**.

### 2.1 Structure — Make Content Extractable

AI systems cite content they can cleanly extract. Current HTML uses custom classes but lacks semantic hierarchy.

**Actions:**
- Wrap each command category in `<section>` tags with descriptive `id` attributes (e.g., `<section id="git-essentials">`)
- Add an introductory `<p>` paragraph at the top answering: *"What is terminal je t'aime?"* — AI systems cite clear definitional content
- Add a brief description paragraph under each category heading explaining when you'd use those commands
- Use `<code>` and `<pre>` tags consistently for all command snippets

**Example intro paragraph:**
> "terminal je t'aime is a free, curated macOS terminal command reference featuring 68 essential commands across 11 categories including navigation, file management, Git, networking, and system administration. Designed for developers who want fast, keyboard-driven access to the commands they actually use."

### 2.2 Authority — Build Citation-Worthiness

Per Princeton GEO research, these signals boost AI citation rates significantly:

| Signal | Impact | Action |
|--------|--------|--------|
| Citing sources | +40% | Add "Source: man page" or Apple docs links for complex commands |
| Adding statistics | +37% | Add stats like "68 commands across 11 categories" prominently |
| Quotations | +30% | Add a developer testimonial or notable quote about terminal usage |
| Authoritative tone | +25% | Write confident, definitive descriptions |
| Freshness | High | Add a visible "Last updated: [date]" to the page |

**Actions:**
- Add a "Last updated" date in the footer
- Add a brief "About" section establishing credibility
- Include a visible stat summary: "68 commands / 11 categories / macOS"

### 2.3 Presence — Appear Where AI Systems Look

AI models train on and search across multiple platforms. Being present on these increases citation probability.

**Actions (prioritized):**
- [ ] Submit to **Product Hunt** as a free developer tool
- [ ] Post to **Reddit** (r/commandline, r/macOS, r/webdev, r/programming)
- [ ] Share on **Hacker News** (Show HN format)
- [ ] Create a **GitHub Pages** or make the repo public with a good README
- [ ] Add to developer tool directories (Free for Dev, Awesome lists)
- [ ] Post on **Twitter/X** and **Bluesky** targeting dev audiences

---

## Phase 3: Lightweight Content Expansion (Weeks 3-4)

Add a few high-value pages that target search queries developers actually make.

### 3.1 Recommended Pages (3-5 total)

| Page | Target Query | Format |
|------|-------------|--------|
| `/commands/grep` | "how to use grep macOS" | Definitive guide with examples |
| `/commands/chmod` | "chmod permissions explained" | Visual reference + examples |
| `/commands/ssh` | "ssh commands cheat sheet" | Step-by-step with common scenarios |
| `/tips` | "macOS terminal tips" | Top 10 productivity tips |

**Content format for AI citation (per framework):**
- Start with a clear, one-sentence answer to the query
- Use comparison tables where applicable
- Include step-by-step numbered lists
- Add real-world examples with expected output
- Keep each page under 1,500 words (focused and extractable)

### 3.2 Internal Linking

- Link from main cheat sheet command cards to their detailed pages
- Add breadcrumb navigation for content pages
- Cross-link between related command pages

### 3.3 URL Structure

Use clean, descriptive URLs:
```
terminaljetaime.com/commands/grep
terminaljetaime.com/commands/chmod
terminaljetaime.com/tips
```

---

## Phase 4: Monitoring & Iteration (Ongoing)

### 4.1 Set Up Analytics
- Add a privacy-respecting analytics tool (Plausible, Umami, or SimpleAnalytics)
- Track: page views, search referrals, copy-button clicks

### 4.2 AI Citation Monitoring
- Monthly: Search for "terminal cheat sheet" and "macOS commands" on ChatGPT, Perplexity, Google AI Overview
- Track whether terminal je t'aime gets cited
- Monitor brand mentions via Google Alerts for "terminal je t'aime"

### 4.3 Search Console
- Register with Google Search Console
- Submit sitemap
- Monitor impressions, clicks, and average position for target queries

### 4.4 Key Metrics to Track

| Metric | Tool | Frequency |
|--------|------|-----------|
| Organic search traffic | Analytics | Weekly |
| Google Search impressions | Search Console | Weekly |
| AI Overview citations | Manual search | Monthly |
| Brand mentions | Google Alerts | Ongoing |
| Core Web Vitals | PageSpeed Insights | Monthly |

---

## Target Keywords

### Primary
- macOS terminal cheat sheet
- terminal commands mac
- mac terminal commands list

### Secondary
- terminal je t'aime
- essential terminal commands
- command line cheat sheet macOS
- developer terminal reference

### Long-tail (for content pages)
- how to use grep on mac
- chmod permissions explained
- ssh into server from mac terminal
- macOS terminal tips and tricks

---

## Quick Win Checklist

- [ ] Add meta description and title update
- [ ] Add Open Graph and Twitter Card tags
- [x] Create OG image (1200x630)
- [ ] Add JSON-LD structured data
- [ ] Create robots.txt (with AI bot access)
- [ ] Create sitemap.xml
- [ ] Add intro paragraph for AI extractability
- [ ] Add "Last updated" date to footer
- [ ] Register Google Search Console
- [ ] Submit sitemap to Google
- [ ] Add analytics

---

*Plan created using the [AI SEO Framework](https://github.com/coreyhaines31/marketingskills/tree/main/skills/ai-seo) — optimized for both traditional search engines and AI citation systems.*
