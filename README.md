# SPS SEO

> **The Ultimate Framework-Agnostic AI Agent Skill & Autonomous Technical SEO Intelligence System**

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](VERSION)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Architecture](https://img.shields.io/badge/architecture-hybrid%20cli%20%2B%20agent-purple.svg)](METHOD-CARD.md)
[![SEO & AEO](https://img.shields.io/badge/search-Google%20%2B%20AI%20Overviews-orange.svg)](guides/aeo-geo-optimization.md)
[![CI Quality Gate](https://img.shields.io/badge/CI%20Gate-Score%20%E2%89%A5%2090-brightgreen.svg)](.github/workflows/seo-check.yml)

`sps-seo` is a production-grade, zero-hallucination AI Agent Skill designed to automate and orchestrate technical SEO, on-page optimization, Schema.org rich snippets, internal link graph analysis, Core Web Vitals performance, and modern Generative Engine Optimization (GEO/AEO).

Compatible with **Claude**, **Cursor**, **Codex**, **Antigravity (Gemini)**, **OpenCode**, and **Windsurf**.

---

## 🌟 Key Features

- 🎯 **Deterministic 100-Point Audit Engine (`npm run audit`):** Zero external dependencies. Evaluates AST/DOM structure, heading hierarchy, image `alt` coverage, canonicals, and robots/sitemaps.
- 🛠️ **1-Click Automated Remediation (`npm run fix`):** Automatically scaffolds missing `robots.txt`, `sitemap.xml`, and `llms.txt`, and patches unannotated image `alt` attributes.
- 🧙 **Interactive CLI Wizard (`npm run init`):** Prompts for brand, keywords, author (E-E-A-T), and domain parameters, generating a clean `sps-seo-config.json`.
- 🔍 **Competitor Intelligence & Content Gap Matrix (`npm run competitor`):** Scrapes rival sites, extracts heading trees and schemas, and produces a topic gap matrix.
- ⚡ **Core Web Vitals & Asset Budget Scanner (`npm run perf`):** Enforces 1.5MB low-end mobile payload limits, flags >200KB images, checks `font-display: swap`, and catches missing dimensions (CLS guard).
- 👁️ **Visual SERP, Social & AI Citation Previewer (`npm run preview`):** Generates an interactive HTML preview (`public/seo-preview.html`) simulating Google Desktop/Mobile SERPs, Twitter/X cards, and AI Overview citations.
- 🔗 **Internal Link & Orphan Page Graph (`npm run links`):** Maps internal crawl equity, identifies orphan pages, and flags weak anchor texts (`click here`, `more`).
- ⚔️ **Keyword Cannibalization Detector (`npm run cannibalization`):** Flags duplicate titles, duplicate descriptions, and competing target keywords across pages.
- 🧩 **Schema.org Syntax & Spec Validator (`npm run validate-schema`):** Strict verification of JSON-LD scripts against Schema.org and Google Rich Results guidelines.
- 🌐 **Multilingual i18n & `hreflang` Reciprocity Engine (`npm run i18n`):** Validates bidirectional alternate link reciprocity, checks for `x-default`, and verifies ISO codes.
- 🎨 **Branded OpenGraph Card Generator (`npm run og`):** Generates crisp 1200x630 branded SVG social preview cards using brand theme colors and metadata.
- 🏷️ **Dynamic SVG Score Badge Generator (`npm run badge`):** Generates a live vector badge for `README.md` reflecting your deterministic audit score.
- ⚡ **Instant IndexNow API Ping (`npm run ping-indexnow`):** Directly notifies Bing, Yandex, and IndexNow crawlers upon page and route updates.
- 🛡️ **GitHub Actions CI Quality Gate (`.github/workflows/seo-check.yml`):** Automatically blocks pull requests if the SEO audit score drops below **90/100 (Grade A)**.
- 💯 **Lighthouse 100/100 Playbook & Master Optimization Guides:** Detailed blueprints for 100/100 across Performance, Accessibility, Best Practices, and SEO ([guides/lighthouse-100-playbook.md](guides/lighthouse-100-playbook.md), [guides/asset-optimization-master.md](guides/asset-optimization-master.md)).
- 🤖 **2026 AI Search & Citation Bot Policy:** Compliant with OpenAI, Anthropic, and Perplexity citation crawlers (`OAI-SearchBot`, `ClaudeBot`, `PerplexityBot`), dual `llms.txt` + `llms-full.txt` generation, and training-bot opt-out controls.
- 🚀 **Third-Party Script Isolation & Edge Caching:** Web Worker offloading via Partytown, interaction-deferred script facades, and immutable CDN caching recipes ([guides/third-party-scripts-strategy.md](guides/third-party-scripts-strategy.md), [guides/caching-and-headers-guide.md](guides/caching-and-headers-guide.md)).
- 🛡️ **Enterprise Security & Best Practices Scanner (`npm run security`):** Static analyzer auditing HTTP security headers (HSTS, CSP, X-Frame-Options, nosniff, Referrer-Policy), public folder leaks (`.env`, `.git`), hardcoded API keys/secrets, mixed content (`http://`), un-sanitized DOM injections, and viewport zoom accessibility.
- 📊 **Unified Search Disciplines (SEO, AEO, GEO, AIO, SXO):** Exhaustive architectural coverage uniting traditional crawl/rank (SEO), direct question answering (AEO), generative LLM citations (GEO), Google AI Overviews (AIO), and Core Web Vitals UX (SXO) ([guides/modern-search-disciplines-seo-aeo-geo-aio-sxo.md](guides/modern-search-disciplines-seo-aeo-geo-aio-sxo.md)).
- 🔤 **Keyword Prominence, Density & Intent Engine (`npm run keyword`):** Audits exact/secondary keyword density, checks prominence across Title, H1, first 100 words, slug, and meta description, with stuffing guard (>3%).
- 🧮 **Algorithmic TF*IDF & Semantic Entity Scanner (`npm run tfidf`):** Computes mathematical TF, IDF, and TF*IDF across unigrams and bigrams, mapping topical authority and identifying semantic content gaps.
- 🎯 **15-Signal SERP Ranking Probability Engine (`npm run ranking`):** Computes a 0–100 probability score across search intent, content depth, E-E-A-T credentials, and rich formatting.
- 💬 **Featured Snippets & Answer Capsule Optimizer (`npm run snippet`):** Identifies and optimizes 40–60 word answer capsules, procedural step lists (`<ol>`), and comparison tables (`<table>`).
- 🔀 **Redirects, Chains & Canonical Auditor (`npm run redirect`):** Audits 301 vs 302 rules across Next.js, Vercel, and Netlify, flags link equity leaks, redirect loops, and trailing slash discrepancies.
- 🔗 **Backlink Equity & Digital PR Engine (`npm run backlink`):** Outbound link equity scanner, unlinked brand mention query generator, and data-driven digital PR outreach pitches.
- ⚖️ **Side-by-Side Competitive Benchmark (`npm run compare`):** Compares your site directly against competitor checkouts across 26 technical and content dimensions.
- 🔄 **SPS Ecosystem Native & Dual-Memory:** Bidirectional synchronization between `sps-seo-config.json` and `./.sps/seo.json`.
- 📋 **Zero-Install Portability:** Includes a standalone monolithic [SYSTEM-PROMPT.md](SYSTEM-PROMPT.md) for direct copy-pasting or GitHub raw retrieval.

---

## 🏗️ Repository Architecture

```text
sps-seo/
├── SKILL.md                          # Main agent skill specification & prompt entrypoint
├── METHOD-CARD.md                    # Core inlined hard laws, anti-hallucination rules, DoD
├── SYSTEM-PROMPT.md                  # Portable monolithic system prompt for zero-install setups
├── sps-seo-config.example.json       # Project configuration template
├── package.json                      # NPM scripts and project metadata
├── README.md                         # Documentation & installation manual
├── VERSION                           # Current skill version stamp (1.0.0)
├── .github/
│   └── workflows/
│       └── seo-check.yml             # Automated CI quality gate enforcing score >= 90
├── scripts/
│   ├── init.mjs                      # Interactive CLI setup wizard
│   ├── audit.mjs                     # Zero-dependency deterministic audit scanner (100-pt score)
│   ├── fix.mjs                       # 1-click automated remediation engine (--dry-run / --apply)
│   ├── competitor-intel.mjs          # Competitor intelligence & Content Gap Matrix generator
│   ├── perf-budget.mjs               # Core Web Vitals & asset weight budget scanner
│   ├── security-check.mjs            # Enterprise security headers, secret leaks & best practices scanner
│   ├── keyword-check.mjs             # Keyword density, prominence & search intent analyzer
│   ├── tfidf-analyzer.mjs            # Algorithmic TF*IDF & semantic entity co-occurrence calculator
│   ├── ranking-intel.mjs             # 15-signal SERP ranking probability engine
│   ├── snippet-optimizer.mjs         # Featured snippet, answer capsule & FAQ schema generator
│   ├── redirect-audit.mjs            # 301/302 redirects, chains & canonical trailing slash auditor
│   ├── backlink-intel.mjs            # Backlink equity, unlinked brand mentions & digital PR engine
│   ├── seo-compare.mjs               # Side-by-side competitive benchmark matrix generator
│   ├── preview-serp.mjs              # Visual SERP, Social, and AI Citation previewer
│   ├── internal-links.mjs            # Internal link graph analyzer & orphan page detector
│   ├── cannibalization.mjs           # Keyword cannibalization & duplicate meta checker
│   ├── validate-schema.mjs           # Schema.org syntax & Google Rich Results validator
│   ├── i18n-seo.mjs                  # Multilingual i18n & hreflang reciprocity validator
│   ├── generate-og.mjs               # Branded 1200x630 vector OpenGraph card generator
│   ├── generate-sitemap.mjs          # Route discovery, sitemap.xml, robots.txt, llms.txt generator
│   ├── badge.mjs                     # Live SVG SEO score badge generator
│   ├── ping-indexnow.mjs             # Direct IndexNow API search engine ping utility
│   ├── sync-config.mjs               # Dual config synchronizer (.sps/seo.json <-> sps-seo-config.json)
│   └── install.sh                    # 1-click global or local installer
├── adapters/
│   ├── nextjs-app.md                 # Next.js App Router (layout metadata, generateMetadata)
│   ├── nextjs-pages.md               # Next.js Pages Router (next/head, _app, SEO component)
│   ├── astro.md                      # Astro (<Layout />, props, @astrojs/sitemap)
│   ├── vite-react.md                 # Vite/React SPA (react-helmet-async + index.html fallback)
│   ├── static-html.md                # Raw HTML, semantic landmarks, inline JSON-LD
│   └── universal-fallback.md         # Nuxt 3, SvelteKit, Laravel Blade, Django
├── schemas/
│   ├── organization.json             # Organization & Brand schema
│   ├── website.json                  # WebSite & Sitelinks SearchBox schema
│   ├── local-business.json           # LocalBusiness with Geo & opening hours schema
│   ├── article.json                  # Article & BlogPosting with E-E-A-T author
│   ├── product.json                  # Product & AggregateOffer schema
│   ├── software-app.json             # SoftwareApplication & ratings schema
│   ├── faq.json                      # FAQPage schema
│   └── breadcrumb.json               # BreadcrumbList schema
└── guides/
    ├── modern-search-disciplines-seo-aeo-geo-aio-sxo.md # Unified SEO, AEO, GEO, AIO & SXO playbook
    ├── phase1-discovery-audit.md        # Discovery intake questions & scoring guidelines
    ├── phase2-codebase-execution.md     # Surgical codebase modification playbook
    ├── phase3-external-seo.md           # GSC setup, DNS verification, indexing requests, backlinks
    ├── aeo-geo-optimization.md          # AI Overviews, answer capsules, citation triggers, llms.txt
    ├── core-web-vitals-checklist.md     # LCP, INP (<200ms), CLS optimization checklist
    ├── lighthouse-100-playbook.md       # 100/100 across Perf, a11y, best-practices & SEO
    ├── asset-optimization-master.md     # AVIF/WebP, WOFF2 subsetting, zero-CLS font metrics
    ├── third-party-scripts-strategy.md  # Partytown web workers, deferred facades, GTM/analytics
    └── caching-and-headers-guide.md     # Immutable caching, Brotli, CDN edge rules, security headers
```

---

## ⚡ Complete CLI Command Catalog

```bash
# 1. Setup & Configuration
npm run init                # Interactive setup wizard
npm run sync-config         # Syncs sps-seo-config.json <-> .sps/seo.json

# 2. Auditing & Technical Diagnostics
npm run audit               # Deterministic 100-pt audit scanner
npm run audit:json          # Output audit in pure JSON
npm run keyword             # Keyword density, prominence & intent analyzer
npm run tfidf               # Algorithmic TF*IDF & semantic entity scanner
npm run ranking             # 15-signal SERP ranking probability engine
npm run snippet             # Featured snippet & 40-60w answer capsule optimizer
npm run redirect            # 301/302 redirects, chains & trailing slash audit
npm run backlink            # Backlink equity & digital PR outreach generator
npm run links               # Internal link graph & orphan page analyzer
npm run cannibalization     # Keyword cannibalization & duplicate meta detector
npm run validate-schema     # Schema.org JSON-LD validator
npm run perf                # Core Web Vitals & asset budget scanner
npm run security            # Enterprise security headers & best practices scanner
npm run security:json       # Output security scan in pure JSON
npm run i18n                # Multilingual hreflang reciprocity check

# 3. Competitor Intelligence & Benchmarks
npm run competitor          # Scrapes competitor URLs & generates Topic Gap Matrix
npm run compare             # Side-by-side technical & content comparison
npm run preview             # Generates interactive HTML SERP & social preview dashboard
npm run badge               # Generates live SVG SEO score badge

# 4. Automated Remediation & Asset Compilation
npm run fix:dry             # Preview 1-click automatic fixes
npm run fix                 # Apply automatic fixes (robots, sitemaps, alts)
npm run sitemap             # Compile sitemap.xml, robots.txt, llms.txt & llms-full.txt
npm run og                  # Generate branded 1200x630 og-image.svg

# 5. Search Engine Indexing & CI Tests
npm run ping-indexnow       # Alert IndexNow (Bing/Yandex) with updated routes
npm test                    # Run comprehensive automated test suite (75 assertions)
```

---

## 🚀 Quick Installation

### 1-Click Global Install (Recommended)
Installs into your global skill stack (`~/.agents/skills/sps-seo`):

```bash
git clone https://github.com/your-username/sps-seo.git
cd sps-seo
./scripts/install.sh --global
```

### Local Project Install
Installs into a specific project's `./.agents/skills/sps-seo`:

```bash
./scripts/install.sh --local
```

---

## 📄 License

MIT License © 2026 Shahid
