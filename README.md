# SPS SEO

> **The Ultimate Framework-Agnostic AI Agent Skill & Autonomous Technical SEO Intelligence System**

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](VERSION)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Architecture](https://img.shields.io/badge/architecture-hybrid%20cli%20%2B%20agent-purple.svg)](METHOD-CARD.md)
[![SEO & AEO](https://img.shields.io/badge/search-Google%20%2B%20AI%20Overviews-orange.svg)](guides/aeo-geo-optimization.md)
[![CI Quality Gate](https://img.shields.io/badge/CI%20Gate-Score%20%E2%89%A5%2090-brightgreen.svg)](.github/workflows/seo-check.yml)

`sps-seo` is a production-grade, zero-hallucination AI Agent Skill designed to automate and orchestrate technical SEO, on-page optimization, Schema.org rich snippets, internal link graph analysis, and modern Generative Engine Optimization (GEO/AEO).

Compatible with **Claude**, **Cursor**, **Codex**, **Antigravity (Gemini)**, **OpenCode**, and **Windsurf**.

---

## 🌟 Key Features

- 🎯 **Deterministic 100-Point Audit Engine (`npm run audit`):** Zero external dependencies. Evaluates AST/DOM structure, heading hierarchy, image `alt` coverage, canonicals, and robots/sitemaps.
- 🛠️ **1-Click Automated Remediation (`npm run fix`):** Automatically scaffolds missing `robots.txt`, `sitemap.xml`, and `llms.txt`, and patches unannotated image `alt` attributes.
- 🧙 **Interactive CLI Wizard (`npm run init`):** Prompts for brand, keywords, author (E-E-A-T), and domain parameters, generating a clean `sps-seo-config.json`.
- 🔗 **Internal Link & Orphan Page Graph (`npm run links`):** Maps internal crawl equity, identifies orphan pages, and flags weak anchor texts (`click here`, `more`).
- ⚔️ **Keyword Cannibalization Detector (`npm run cannibalization`):** Flags duplicate titles, duplicate descriptions, and competing target keywords across pages.
- 🧩 **Schema.org Syntax & Spec Validator (`npm run validate-schema`):** Strict verification of JSON-LD scripts against Schema.org and Google Rich Results guidelines.
- 🎨 **Branded OpenGraph Card Generator (`npm run og`):** Generates crisp 1200x630 branded SVG social preview cards using brand theme colors and metadata.
- ⚡ **Instant IndexNow API Ping (`npm run ping-indexnow`):** Directly notifies Bing, Yandex, and IndexNow crawlers upon page and route updates.
- 🛡️ **GitHub Actions CI Quality Gate (`.github/workflows/seo-check.yml`):** Automatically blocks pull requests if the SEO audit score drops below **90/100 (Grade A)**.
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
│   ├── internal-links.mjs            # Internal link graph analyzer & orphan page detector
│   ├── cannibalization.mjs           # Keyword cannibalization & duplicate meta checker
│   ├── validate-schema.mjs           # Schema.org syntax & Google Rich Results validator
│   ├── generate-og.mjs               # Branded 1200x630 vector OpenGraph card generator
│   ├── generate-sitemap.mjs          # Route discovery, sitemap.xml, robots.txt, llms.txt generator
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
    ├── phase1-discovery-audit.md     # Discovery intake questions & scoring guidelines
    ├── phase2-codebase-execution.md  # Surgical codebase modification playbook
    ├── phase3-external-seo.md        # GSC setup, DNS verification, indexing requests, backlinks
    ├── aeo-geo-optimization.md       # AI Overviews, answer capsules, citation triggers, llms.txt
    └── core-web-vitals-checklist.md  # LCP, INP (<200ms), CLS optimization checklist
```

---

## ⚡ CLI Command Suite

```bash
# 1. Setup & Configuration
npm run init                # Interactive setup wizard
npm run sync-config         # Syncs sps-seo-config.json <-> .sps/seo.json

# 2. Auditing & Health Checks
npm run audit               # Deterministic 100-pt audit scanner
npm run audit:json          # Output audit in pure JSON
npm run links               # Internal link graph & orphan page analyzer
npm run cannibalization     # Keyword cannibalization & duplicate meta detector
npm run validate-schema     # Schema.org JSON-LD validator

# 3. Automated Remediation & Compilation
npm run fix:dry             # Preview 1-click automatic fixes
npm run fix                 # Apply automatic fixes (robots, sitemaps, alts)
npm run sitemap             # Compile sitemap.xml, robots.txt, and llms.txt
npm run og                  # Generate branded 1200x630 og-image.svg

# 4. Search Engine Indexing & Tests
npm run ping-indexnow       # Alert IndexNow (Bing/Yandex) with updated routes
npm test                    # Run automated test suite
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
