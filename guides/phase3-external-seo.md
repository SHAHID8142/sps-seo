# Phase 3: External SEO & Manual Operations Guide

Tasks outside the local codebase require specific manual execution in search engine dashboards and webmaster tools. This guide provides exact, step-by-step instructions.

---

## 1. Google Search Console (GSC) Setup & Domain Verification

Google Search Console is the authoritative portal for managing your site's presence in Google Search.

### Step 1: Add Property
1. Navigate to [Google Search Console](https://search.google.com/search-console).
2. Click **Add Property** in the top left dropdown.
3. Select the **Domain** property type (e.g. `example.com`), which covers all subdomains (`www`, `app`, `blog`) and protocols (`http`, `https`).

### Step 2: DNS Verification (Recommended)
1. GSC will display a `TXT` record string (e.g., `google-site-verification=abcdef...`).
2. Log into your DNS provider (Cloudflare, Namecheap, GoDaddy, AWS Route53, Vercel DNS).
3. Add a new record:
   - **Type:** `TXT`
   - **Name / Host:** `@` (or leave blank if root)
   - **Value:** `google-site-verification=abcdef...`
   - **TTL:** Auto or 300s
4. Return to GSC and click **Verify**. (If verification fails immediately, wait 5–15 minutes for DNS propagation).

*Alternative:* If DNS access is restricted, use the **URL prefix** method and place the downloaded HTML verification file into your project's `public/` directory, then re-deploy.

---

## 2. XML Sitemap Submission

Once domain ownership is verified:
1. In the GSC left-hand sidebar, navigate to **Indexing > Sitemaps**.
2. Under **Add a new sitemap**, enter:
   ```text
   sitemap.xml
   ```
3. Click **Submit**.
4. Confirm the status changes to **Success**.
5. Note: If status shows "Couldn't fetch", verify that `https://example.com/sitemap.xml` responds with HTTP 200 and `Content-Type: application/xml` in an incognito browser.

---

## 3. Immediate Priority URL Inspection & Indexing Request

Googlebot can take days or weeks to crawl new pages naturally. To request immediate indexing:
1. Copy your primary landing page or newly published blog URL.
2. Paste it into the top **Inspect any URL in "example.com"** search bar in GSC and press Enter.
3. If the page is not in the index, click **Test Live URL**.
4. Once the live test confirms the URL is fetchable with no indexing blockers, click **Request Indexing**.
5. *Note:* Google enforces daily quotas on indexing requests; reserve this for high-priority pages.

---

## 4. Bing Webmaster Tools & IndexNow Protocol

Do not ignore Bing, as it powers Microsoft Copilot and significant enterprise AI search:
1. Go to [Bing Webmaster Tools](https://www.bing.com/webmasters).
2. Click **Import from Google Search Console** (instant 1-click verification).
3. Enable **IndexNow**:
   - IndexNow automatically alerts Bing and other engines the second you publish or update a page.
   - For Next.js/Astro, integrate an IndexNow API webhook on deploy.

---

## 5. Actionable White-Hat Backlink Outreach Strategies

Backlinks remain the #1 off-page authority signal, directly impacting eligibility for Google AI Overviews and high-intent keyword ranking.

### Strategy 1: The "Original Data & Benchmark" Asset (Highest ROI)
- **Concept:** Create a single page featuring original data, an industry survey, cost calculator, or open-source tool.
- **Why it works:** Journalists, AI assistants, and bloggers cite data points rather than generic marketing claims.
- **Action:**
  1. Compile proprietary or aggregated industry benchmarks.
  2. Publish with clear data tables and downloadable charts.
  3. Pitch relevant newsletter curators and industry bloggers.

### Strategy 2: Competitor Broken & Unlinked Mention Reclamation
- **Tool:** Use Ahrefs / Semrush / Google Alerts.
- **Action:**
  1. Set up an alert for your brand name and founders' names.
  2. When an article mentions your brand without a hyperlink, send a polite email thanking the author and asking if they can turn the mention into a clickable link.
  3. Search for 404 pages on competitor domains that previously had high-quality backlinks; reach out to linking sites offering your up-to-date replacement guide.

### Strategy 3: Digital PR & Expert Commentary
- **Platform:** Use Connectively (formerly HARO), Qwoted, and Featured.com.
- **Action:**
  1. Subscribe to queries in your industry category.
  2. When a journalist asks for insights on your domain, submit a concise, quote-ready 3-paragraph answer with author title and credentials within 2 hours of posting.
  3. High-authority publications regularly award high-DA editorial backlinks for timely commentary.

---

## 6. External SEO Maintenance Checklist (Monthly)

- [ ] Check GSC **Pages** report for 404 errors, redirect loops, or "Discovered - currently not indexed".
- [ ] Review **Core Web Vitals** report in GSC for mobile and desktop issues.
- [ ] Monitor **Performance > Queries** to identify queries ranking on positions 4–15; update existing on-page headings and copy to capture page 1 positions.
- [ ] Audit top search queries in Perplexity and ChatGPT to see if your brand is being cited.
