# Phase 1: Discovery & Deterministic Audit Guide

This guide establishes the mandatory Phase 1 workflow for any project using the **SPS SEO** skill.

---

## 1. Discovery Interview Protocol

Before touching any code or making assertions, the AI agent must gather project context. If `sps-seo-config.json` or `.sps/seo.json` already exists, read it first. Otherwise, prompt the user for:

### A. Business & Audience Context
1. **Primary & Secondary Keywords:** What are the exact high-intent search phrases your target users query?
2. **Target Geography & Language:** Are you targeting a specific locale (e.g., US, UK, Global, multilingual)?
3. **Core Value Proposition & Differentiator:** What unique solution or first-hand experience (E-E-A-T) does this site offer?
4. **Competitors:** Who currently ranks on page 1 or gets cited in AI Overviews for your target keywords?

### B. Brand & Technical Entities
1. **Canonical Site URL:** Exact production domain (e.g., `https://example.com` - verify `https` and `www` vs non-`www`).
2. **Brand / Legal Name & Logo:** Official name and public logo URL for Schema.org `Organization`.
3. **Author Credentials (E-E-A-T):** Name, title, social links, and expertise of primary content creators.

---

## 2. Real-Time Knowledge Verification Protocol

Before executing on-page strategies, run a real-time web search for current search engine conditions:
- Check for recent **Google Core Updates** or **Spam Updates** (2025/2026).
- Verify indexing rules for your target content format (e.g., programmatic pages, AI-generated text, product reviews).
- Check AI Overviews citation patterns for the target niche.

```bash
# Example query pattern for agents:
search_web("Google Core Update latest 2026 indexing guidelines AI Overviews")
```

---

## 3. Running the Deterministic Audit Scanner

Execute the zero-dependency Node.js audit script directly in the target project root:

```bash
node scripts/audit.mjs
```

Or for JSON output:
```bash
node scripts/audit.mjs --json
```

### Deterministic 100-Point Scoring Breakdown:

| Category | Max Points | Evaluation Criteria |
| :--- | :--- | :--- |
| **Technical & Crawlability** | 25 | `robots.txt` present (8pts), `sitemap.xml` present (8pts), framework config detected (5pts), `sps-seo-config.json` present (4pts). |
| **Meta Tags & Social Previews** | 25 | `<title>` tag optimal (8pts), `<meta description>` optimal (8pts), canonical tag (4pts), Open Graph tags (3pts), Twitter card (2pts). |
| **Semantic Structure (H1-H6)** | 25 | Exactly one `<h1>` per page (10pts), no skipped heading levels (8pts), semantic landmarks (`<main>`, `<header>`, `<footer>`) (7pts). |
| **Schema & AI Search (AEO)** | 25 | Image alt text ratio (10pts), Schema.org JSON-LD (8pts), `llms.txt` knowledge file (7pts). |

### Output Artifacts:
The scanner automatically generates:
1. Colorized console summary.
2. `sps-seo-audit-report.md` at root.
3. `.sps/seo-audit.md` (if `.sps/` directory exists).

---

## 4. Phase 1 Exit Gate
Do not proceed to code modification (Phase 2) until:
- [ ] User has confirmed target keywords, domain URL, and brand metadata.
- [ ] Deterministic audit script has run and logged the baseline score.
- [ ] Specific remediation priorities have been confirmed with the user.
