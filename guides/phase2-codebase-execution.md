# Phase 2: Automated On-Page & Technical Execution Guide

This guide details the exact code modification workflows for Phase 2.

---

## 1. Surgical Modification Rules

1. **Zero Guesswork:** Never assume file paths. Identify the framework via `scripts/audit.mjs` and check root layout files.
2. **Framework Alignment:** Always read the corresponding adapter in `adapters/` before editing.
3. **Preserve Surrounding Code:** Do not overwrite entire components. Use surgical edits to inject metadata, schema, and layout tags.
4. **Idempotency:** Ensure metadata objects or script tags are not duplicated if run multiple times.

---

## 2. Step-by-Step Codebase Remediation

### Step 1: Framework-Specific Metadata Injection
- **Next.js App Router:** Inject or update `export const metadata: Metadata` in `app/layout.tsx`.
- **Next.js Pages Router:** Add or edit `<SEO />` component or `next/head` tags in `pages/_app.tsx` and pages.
- **Astro:** Pass props to `<Layout>` in `src/layouts/Layout.astro`.
- **Vite / React:** Update root `index.html` fallback tags and mount `Helmet` via `react-helmet-async`.
- **Static HTML:** Inject tags into `<head>` block.

### Step 2: Meta Title & Description Crafting Standards
- **Title Tag:**
  - Length: 50–60 characters.
  - Pattern: `[Primary Keyword / Page Topic] - [Unique Benefit] | [Brand Name]`
  - Example: `Autonomous Cloud Orchestration - Zero-Trust Networking | Acme Cloud`
- **Meta Description:**
  - Length: 140–158 characters.
  - Content: State the primary user benefit, include the secondary keyword naturally, and end with an actionable CTA.
  - Example: `Orchestrate multi-cloud Kubernetes clusters with automated policy enforcement. Reduce cloud spend and eliminate downtime. Start free today.`

### Step 3: Schema.org JSON-LD Injection
1. Select appropriate template(s) from `schemas/`:
   - Every site: `organization.json` + `website.json`
   - Blogs / Docs: `article.json` + `breadcrumb.json`
   - SaaS / Web App: `software-app.json` + `faq.json`
   - E-commerce: `product.json` + `breadcrumb.json`
2. Populate placeholders using `sps-seo-config.json` values.
3. Inject natively using framework's idiomatic format (see `adapters/`).

### Step 4: Semantic Hierarchy Repair
1. **Single H1 Rule:** Verify only one `<h1>` exists per page. If multiple exist, convert secondary instances to `<h2>`.
2. **No Skipped Levels:** Fix sequences like `<h1>` followed immediately by `<h3>` (insert an `<h2>` or downgrade the `<h3>` to `<h2>`).
3. **Semantic Landmarks:** Ensure the page contains `<main>`, `<header>`, `<nav>`, and `<footer>` containers.

### Step 5: Image Alt Text Remediation
1. Inspect every `<img alt="Illustration preview">` or framework `<Image alt="Illustration preview" />` flagged by `scripts/audit.mjs`.
2. Write concise, descriptive `alt` text explaining what the image depicts in relation to the section content.
3. *Rule:* Never keyword-stuff `alt` text (e.g. `alt="best cloud software cloud tool"` is prohibited; use `alt="Acme Cloud multi-cluster topology dashboard displaying active pods"`).

### Step 6: Generate Sitemaps, Robots & AI Index
Execute the automated generator:
```bash
node scripts/generate-sitemap.mjs
```
This produces:
- `public/sitemap.xml` (or root `sitemap.xml`)
- `public/robots.txt` (with directives for GoogleBot, GPTBot, ClaudeBot, PerplexityBot)
- `public/llms.txt` (AI search knowledge index)

---

## 3. Verification & Phase 2 Definition of Done (DoD)

Run the deterministic audit script to verify results:
```bash
node scripts/audit.mjs
```

### Exit Criteria:
- [ ] Technical & Crawlability: **25/25 pts**
- [ ] Meta Tags & Social Previews: **25/25 pts**
- [ ] Semantic Hierarchy: **25/25 pts**
- [ ] Schema & AI Search: **>= 20/25 pts**
- [ ] **Overall Score: >= 90/100 (Grade A)**
