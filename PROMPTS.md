# SPS SEO: Master Prompts & Workflows

This document provides copy-paste prompts for every SEO task. Use these with any AI agent (Claude, Cursor, Codex, Windsurf, etc.) after installing SPS SEO.

---

## Interactive Consultant Mode (Recommended)

```bash
sps-seo
# or: npm run consult
```

The consultant asks numbered questions and builds a complete action plan. Just reply with numbers at each prompt. No coding knowledge needed.

---

## Quick Start Prompts

### New Project (Blank/Empty)
```
Install SPS SEO and run a complete SEO setup on this blank project:
1. Run: ./scripts/install.sh --global
2. Run: node scripts/consultant.mjs (interactive — will ask you questions)
3. Or: node scripts/init.mjs (manual config)
4. Run: node scripts/audit.mjs (get baseline score)
5. Run: node scripts/fix.mjs --apply (auto-fix all issues)
6. Run: node scripts/audit.mjs (verify score improved)
7. Generate all assets: sitemap, robots.txt, og-image, schema, badge
```

### Existing Project (SEO Audit & Fix)
```
Run a comprehensive SEO audit on this project and fix all issues:
1. Run: node scripts/audit.mjs --json (baseline score)
2. Run: node scripts/links.mjs (find orphan pages)
3. Run: node scripts/cannibalization.mjs (check keyword conflicts)
4. Run: node scripts/security.mjs (check headers & secrets)
5. Run: node scripts/perf.mjs (Core Web Vitals check)
6. Run: node scripts/fix.mjs --apply (auto-fix everything)
7. Run: node scripts/audit.mjs (verify final score >= 90)
```

---

## Category-Specific Prompts

### 1. Technical SEO & Crawlability
```
Audit and fix technical SEO:
- Run: node scripts/audit.mjs (technical category)
- Run: node scripts/redirect.mjs (fix redirect chains)
- Run: node scripts/sitemap.mjs (generate sitemap.xml)
- Run: node scripts/sitemap:validate.mjs (validate URLs)
- Run: node scripts/lighthouse.mjs (performance audit)
```

### 2. Meta Tags & Social Previews
```
Optimize meta tags and social previews:
- Run: node scripts/audit.mjs (meta category)
- Run: node scripts/og.mjs (generate og-image.svg)
- Run: node scripts/preview.mjs (SERP/social preview)
- Run: node scripts/snippet.mjs (featured snippet optimization)
```

### 3. Heading Structure (H1-H6)
```
Fix heading hierarchy and semantic structure:
- Run: node scripts/audit.mjs (heading category)
- Check: Exactly one H1 per page
- Check: No skipped heading levels (H2 -> H4)
- Fix: All headings are descriptive and keyword-rich
```

### 4. Schema.org JSON-LD
```
Generate and validate Schema.org markup:
- Run: node scripts/audit.mjs (schema category)
- Choose schema type: Article, Product, FAQ, HowTo, LocalBusiness, etc.
- Run: node scripts/validate-schema.mjs (validate JSON-LD)
- Inject: Add schema to page head
```

### 5. Keyword Optimization
```
Analyze and optimize keyword usage:
- Run: node scripts/keyword.mjs (density & prominence)
- Run: node scripts/tfidf.mjs (semantic entities)
- Run: node scripts/cannibalization.mjs (avoid conflicts)
- Target: 1.0%-2.5% density, prominent in Title/H1/first 100 words
```

### 6. Internal Linking
```
Optimize internal link architecture:
- Run: node scripts/links.mjs (link graph & orphans)
- Fix: Zero orphan pages
- Fix: Descriptive anchor texts (no "click here")
- Add: Contextual links between related content
```

### 7. Security & Performance
```
Audit security headers and performance:
- Run: node scripts/security.mjs (headers & secrets)
- Run: node scripts/secrets.mjs (credential scan)
- Run: node scripts/perf.mjs (Core Web Vitals)
- Run: node scripts/bundle.mjs (JS bundle analysis)
```

### 8. Competitor Intelligence
```
Analyze competitors and find gaps:
- Run: node scripts/competitor.mjs <url1> <url2> ...
- Run: node scripts/compare.mjs <url1> <url2>
- Run: node scripts/ranking.mjs (ranking probability)
```

### 9. Vertical SEO (Video, News, E-commerce, Local)
```
Run vertical SEO audits:
- Video: node scripts/video.mjs
- News: node scripts/news.mjs
- E-commerce: node scripts/ecom.mjs
- Local: node scripts/local.mjs
```

### 10. AI Search Optimization (AEO/GEO)
```
Optimize for AI search engines:
- Add FAQ schema for answer capsules
- Add speakable schema for voice search
- Generate llms.txt for LLM citations
- Add empirical data citations
- Follow: guides/aeo-geo-optimization.md
```

---

## Complete Workflow Prompts

### Full SEO Overhaul
```
Perform a complete SEO overhaul on this project:

PHASE 1: DISCOVERY
1. Run: node scripts/init.mjs (if not configured)
2. Run: node scripts/audit.mjs --json (baseline score)
3. Run: node scripts/links.mjs (internal links)
4. Run: node scripts/cannibalization.mjs (keyword conflicts)
5. Run: node scripts/security.mjs (security audit)
6. Run: node scripts/perf.mjs (performance)

PHASE 2: EXECUTION
7. Run: node scripts/fix.mjs --dry-run (preview fixes)
8. Run: node scripts/fix.mjs --apply (apply fixes)
9. Run: node scripts/sitemap.mjs (generate sitemaps)
10. Run: node scripts/og.mjs (generate social image)
11. Run: node scripts/validate-schema.mjs (validate schemas)

PHASE 3: VERIFICATION
12. Run: node scripts/audit.mjs (final score >= 90)
13. Run: node scripts/preview.mjs (visual preview)
14. Run: node scripts/badge.mjs (README badge)
15. Run: node scripts/ping-indexnow.mjs (notify search engines)
```

### Pre-Deploy Checklist
```
Run pre-deploy SEO checklist:
1. node scripts/audit.mjs (score >= 90)
2. node scripts/lighthouse.mjs (performance)
3. node scripts/security.mjs (no secret leaks)
4. node scripts/sitemap:validate.mjs (valid sitemap)
5. node scripts/redirect.mjs (no broken redirects)
6. node scripts/dup.mjs (no duplicate content)
```

---

## Single-Task Prompts

| Task | Prompt |
|------|--------|
| **Fix meta tags** | "Run `node scripts/audit.mjs` and fix all missing/duplicate meta tags" |
| **Generate schema** | "Generate JSON-LD schema for this page type and validate with `node scripts/validate-schema.mjs`" |
| **Fix images** | "Audit all images: missing alt tags, oversized files, missing dimensions" |
| **Internal links** | "Run `node scripts/links.mjs` and fix all orphan pages" |
| **Keyword check** | "Run `node scripts/keyword.mjs` and optimize keyword density to 1-2.5%" |
| **Performance** | "Run `node scripts/perf.mjs` and fix Core Web Vitals issues" |
| **Security** | "Run `node scripts/security.mjs` and add missing security headers" |
| **Competitor gap** | "Run `node scripts/competitor.mjs <url>` and list content gaps" |
| **Local SEO** | "Run `node scripts/local.mjs` and fix NAP consistency" |
| **Video SEO** | "Run `node scripts/video.mjs` and add VideoObject schema" |

---

## Tips

1. **Always run `audit.mjs` before and after** -- the deterministic score proves improvement
2. **Use `--json` flag** for programmatic parsing in scripts
3. **Run `fix.mjs --dry-run` first** to preview changes before applying
4. **Check `sps-seo-audit-report.md`** for detailed findings after each audit
5. **Configure `sps-seo-config.json`** via `init.mjs` for personalized recommendations