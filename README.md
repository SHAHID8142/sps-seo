# SPS SEO

> **The Ultimate Framework-Agnostic AI Agent Skill & Autonomous Technical SEO Intelligence System**

[![Version](https://img.shields.io/badge/version-1.4.0-blue.svg)](VERSION)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Architecture](https://img.shields.io/badge/architecture-hybrid%20cli%20%2B%20agent-purple.svg)](METHOD-CARD.md)
[![SEO & AEO](https://img.shields.io/badge/search-Google%20%2B%20AI%20Overviews-orange.svg)](guides/aeo-geo-optimization.md)
[![CI Quality Gate](https://img.shields.io/badge/CI%20Gate-Score%20%E2%89%A5%2090-brightgreen.svg)](.github/workflows/seo-check.yml)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](package.json)
[![Tests](https://img.shields.io/badge/tests-147%20passing-success.svg)](tests/)

`sps-seo` is a production-grade, zero-hallucination AI Agent Skill designed to automate and orchestrate technical SEO, on-page optimization, Schema.org rich snippets, internal link graph analysis, Core Web Vitals performance, and modern Generative Engine Optimization (GEO/AEO).

Compatible with **Claude**, **Cursor**, **Codex**, **Antigravity (Gemini)**, **OpenCode**, and **Windsurf**.

---

## Table of Contents

1. [What is SPS SEO?](#what-is-sps-seo)
2. [Who is it For?](#who-is-it-for)
3. [Key Features](#key-features)
4. [System Requirements](#system-requirements)
5. [Installation](#installation)
6. [Updating](#updating)
7. [Uninstalling](#uninstalling)
8. [Quick Start](#quick-start)
9. [Complete Command Reference](#complete-command-reference)
10. [Workflow Guides](#workflow-guides)
11. [Agent Integration](#agent-integration)
12. [Configuration](#configuration)
13. [CI/CD Integration](#cicd-integration)
14. [Testing](#testing)
15. [Architecture](#architecture)
16. [Troubleshooting](#troubleshooting)
17. [Contributing](#contributing)
18. [License](#license)

---

## What is SPS SEO?

SPS SEO is a **deterministic SEO audit engine** combined with an **AI agent skill** that enables any AI coding assistant to autonomously audit, optimize, and fix the SEO of any web project.

Unlike subjective SEO checklists, SPS SEO uses a **100-point deterministic scoring system** that produces the same result every time — zero hallucination, zero guesswork.

### How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                        SPS SEO WORKFLOW                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. INSTALL          Install skill to agent directory           │
│           │                                                     │
│           ▼                                                     │
│  2. CONFIGURE        Run init.mjs → sps-seo-config.json         │
│           │                                                     │
│           ▼                                                     │
│  3. AUDIT            Run audit.mjs → Score 0-100                │
│           │                                                     │
│           ▼                                                     │
│  4. FIX              Run fix.mjs → Auto-remediate issues        │
│           │                                                     │
│           ▼                                                     │
│  5. VERIFY           Run audit.mjs → Confirm score ≥ 90         │
│           │                                                     │
│           ▼                                                     │
│  6. DEPLOY           Generate assets, ping search engines       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Who is it For?

- **Web Developers** who want automated SEO audits without manual checklists
- **SEO Specialists** who need deterministic, reproducible scoring
- **AI Agent Users** who want their coding assistant to handle SEO automatically
- **Agencies** who manage multiple client websites
- **Content Creators** who optimize for AI search engines (Google AI Overviews, Perplexity, ChatGPT Search)

---

## Key Features

### Core SEO Engine
- **Deterministic 100-Point Audit Engine** (`audit.mjs`): Zero external dependencies. Evaluates AST/DOM structure, heading hierarchy, image `alt` coverage, canonicals, and robots/sitemaps.
- **1-Click Automated Remediation** (`fix.mjs`): Automatically scaffolds missing `robots.txt`, `sitemap.xml`, and `llms.txt`, and patches unannotated image `alt` attributes.
- **Interactive CLI Wizard** (`init.mjs`): Prompts for brand, keywords, author (E-E-A-T), and domain parameters, generating a clean `sps-seo-config.json`.

### On-Page Optimization
- **Keyword Density & Prominence Analyzer** (`keyword.mjs`): Checks keyword placement in Title, H1, first 100 words, and overall density (target 1.0%-2.5%).
- **TF*IDF Semantic Entity Scanner** (`tfidf.mjs`): Algorithmic content optimization using term frequency-inverse document frequency.
- **Featured Snippet Optimizer** (`snippet.mjs`): Optimizes content for Google featured snippets and 40-60 word answer capsules.
- **Keyword Cannibalization Detector** (`cannibalization.mjs`): Flags duplicate titles, duplicate descriptions, and competing target keywords across pages.

### Technical SEO
- **Internal Link & Orphan Page Graph** (`links.mjs`): Maps internal crawl equity, identifies orphan pages, and flags weak anchor texts.
- **Redirect Chain Auditor** (`redirect.mjs`): Detects 301/302 redirect chains, loops, and trailing slash inconsistencies.
- **Sitemap Generator** (`sitemap.mjs`): Compiles `sitemap.xml`, `robots.txt`, `llms.txt` and `llms-full.txt`.
- **Sitemap Validator** (`sitemap:validate.mjs`): Validates URL resolution, lastmod dates, 50k/50MB limits, and hreflang x-default.

### Schema.org & Structured Data
- **Schema Validator** (`validate-schema.mjs`): Strict verification of JSON-LD scripts against Schema.org and Google Rich Results guidelines.
- **17 Ready-Made Schema Templates**: Article, Product, FAQ, HowTo, LocalBusiness, Video, NewsArticle, Event, JobPosting, Recipe, Course, Speakable, Dataset, SoftwareApp, Breadcrumb, Organization, Website.

### Vertical SEO
- **Video SEO** (`video.mjs`): Validates VideoObject schema, detects embeds, enforces privacy-enhanced embeds.
- **News SEO** (`news.mjs`): Validates NewsArticle schema, checks freshness, news sitemap, paywall flags.
- **E-commerce SEO** (`ecom.mjs`): Validates Product/Offer schema, pagination canonicals, ItemList.
- **Local SEO** (`local.mjs`): Validates LocalBusiness schema, NAP consistency, geo coordinates.

### Performance & Security
- **Core Web Vitals Scanner** (`perf.mjs`): Enforces 1.5MB payload limits, flags >200KB images, checks `font-display: swap`, catches missing dimensions (CLS guard).
- **Security Headers Auditor** (`security.mjs`): Checks HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy.
- **Secret Leak Scanner** (`secrets.mjs`): Scans for hardcoded credentials, API keys, and exposed `.env` files.
- **Bundle Analyzer** (`bundle.mjs`): Audits JavaScript bundle weight and third-party scripts.

### AI Search Optimization (AEO/GEO)
- **AI Search Optimizer**: Generates `llms.txt` for LLM citations, FAQ schema for answer capsules, speakable schema for voice search.
- **Modern Search Disciplines**: Covers SEO, AEO, GEO, AIO, and SXO optimization strategies.

### Intelligence & Preview
- **Competitor Intelligence** (`competitor.mjs`): Scrapes rival sites, extracts heading trees and schemas, produces topic gap matrix.
- **SEO Comparison** (`compare.mjs`): Side-by-side technical & content comparison.
- **SERP & Social Previewer** (`preview.mjs`): Generates interactive HTML preview simulating Google Desktop/Mobile SERPs, Twitter/X cards, and AI Overview citations.
- **Live Crawler** (`crawler.mjs`): Polite robots-aware live crawler with TTFB, soft-404, and SPA detection.
- **PageSpeed Insights** (`pagespeed.mjs`): Fetches PageSpeed Insights v5 + CrUX field data.
- **Google Search Console** (`gsc.mjs`): Analyzes GSC data via CSV or Service Account API.
- **Access Log Analyzer** (`logs.mjs`): Analyzes server access logs for crawl budget and 404 hotspots.

### Asset Generation
- **OpenGraph Card Generator** (`og.mjs`): Generates crisp 1200x630 branded SVG social preview cards.
- **Score Badge Generator** (`badge.mjs`): Generates live vector badge for README.md reflecting your deterministic audit score.
- **RSS Feed Generator** (`rss.mjs`): Generates RSS 2.0 feed from content pages.
- **IndexNow Pinger** (`ping-indexnow.mjs`): Notifies Bing/Yandex of updated routes.

---

## System Requirements

- **Node.js**: >= 18.0.0
- **Operating System**: macOS, Linux, Windows (WSL recommended)
- **Git**: For installation and updates
- **curl**: For update checking

---

## Installation

### Method 1: Global Install (Recommended)

Installs into all detected agent directories so any AI coding assistant can use SPS SEO:

```bash
git clone https://github.com/shahid/sps-seo.git
cd sps-seo
./scripts/install.sh --global
```

**Installs to:**
- `~/.agents/skills/sps-seo` (Claude Code, OpenCode)
- `~/.gemini/config/skills/sps-seo` (Gemini, Antigravity)
- `~/.cursor/skills/sps-seo` (Cursor)
- `~/.windsurf/skills/sps-seo` (Windsurf)

### Method 2: Local Project Install

Installs into a specific project's `.agents/skills/sps-seo`:

```bash
./scripts/install.sh --local
```

### Method 3: Copy Mode (Standalone)

Creates a full copy instead of a symlink (no link to source repository):

```bash
./scripts/install.sh --copy
```

### Method 4: Force Overwrite

Overwrite existing installations without prompting:

```bash
./scripts/install.sh --force
```

### Method 5: Dry Run

Preview what would happen without executing:

```bash
./scripts/install.sh --dry-run
```

### Method 6: Remote Pull (No Clone)

Pull directly from GitHub without cloning:

```bash
curl -sSL https://raw.githubusercontent.com/shahid/sps-seo/main/scripts/pull-skill.sh | bash
```

Or with custom repo URL:

```bash
SPS_SEO_REPO_URL=https://github.com/user/repo.git ./scripts/pull-skill.sh
```

---

## Updating

### Check for Updates

```bash
./scripts/update.sh --check
```

### Update to Latest Version

```bash
./scripts/update.sh
```

### Force Reinstall

```bash
./scripts/update.sh --force
```

### How Updates Work

| Install Type | Update Method |
|--------------|---------------|
| Git clone | `git pull` latest changes |
| Symlink | Updates the source repository |
| Copy | Reinstalls from GitHub |

### Custom Repository URL

```bash
SPS_SEO_REPO_URL=https://github.com/user/repo.git ./scripts/update.sh
```

---

## Uninstalling

### Interactive Uninstall (prompts for each installation)

```bash
./scripts/uninstall.sh
```

### Force Uninstall (no prompts)

```bash
./scripts/uninstall.sh --force
```

### Preview What Would Be Removed

```bash
./scripts/uninstall.sh --dry-run
```

### What Gets Removed

- `~/.agents/skills/sps-seo` (Claude, OpenCode)
- `~/.gemini/config/skills/sps-seo` (Gemini, Antigravity)
- `~/.cursor/skills/sps-seo` (Cursor)
- `~/.windsurf/skills/sps-seo` (Windsurf)
- `./.agents/skills/sps-seo` (Local)

### What Gets Preserved

- Your project's `sps-seo-config.json`
- Generated files (`sitemap.xml`, `robots.txt`, etc.)
- Any edits made to your project files

---

## Quick Start

### For a New Project

```bash
# 1. Configure your project
node scripts/init.mjs

# 2. Run baseline audit
node scripts/audit.mjs --json

# 3. Fix all issues
node scripts/fix.mjs --dry-run    # Preview first
node scripts/fix.mjs --apply      # Apply fixes

# 4. Verify improvement
node scripts/audit.mjs

# 5. Generate assets
node scripts/sitemap.mjs
node scripts/og.mjs
node scripts/badge.mjs

# 6. Notify search engines
node scripts/ping-indexnow.mjs
```

### For an Existing Project

```bash
# 1. Run comprehensive audit
node scripts/audit.mjs --json

# 2. Check internal links
node scripts/links.mjs

# 3. Check keyword conflicts
node scripts/cannibalization.mjs

# 4. Check security
node scripts/security.mjs

# 5. Check performance
node scripts/perf.mjs

# 6. Fix everything
node scripts/fix.mjs --apply

# 7. Verify final score >= 90
node scripts/audit.mjs
```

---

## Complete Command Reference

### 1. Core Commands

| Command | Description |
|---------|-------------|
| `npm run init` | Interactive setup wizard for `sps-seo-config.json` |
| `npm run audit` | Deterministic 100-point audit scanner |
| `npm run audit:json` | Output audit in pure JSON |
| `npm run fix` | Apply automatic fixes |
| `npm run fix:dry` | Preview automatic fixes |

### 2. On-Page SEO

| Command | Description |
|---------|-------------|
| `npm run keyword` | Keyword density, prominence & intent analyzer |
| `npm run tfidf` | TF*IDF & semantic entity scanner |
| `npm run snippet` | Featured snippet & 40-60w answer capsule optimizer |
| `npm run cannibalization` | Keyword cannibalization & duplicate meta detector |

### 3. Technical SEO

| Command | Description |
|---------|-------------|
| `npm run links` | Internal link graph & orphan page analyzer |
| `npm run redirect` | 301/302 redirects, chains & trailing slash audit |
| `npm run sitemap` | Compile sitemap.xml, robots.txt, llms.txt & llms-full.txt |
| `npm run sitemap:validate` | Sitemap URL resolution, lastmod, index & hreflang checks |
| `npm run rss` | Generate RSS 2.0 feed from content pages |

### 4. Vertical SEO

| Command | Description |
|---------|-------------|
| `npm run video` | Video SEO (VideoObject schema, embeds, video sitemap) |
| `npm run news` | News SEO (NewsArticle schema, freshness, news sitemap) |
| `npm run ecom` | E-commerce SEO (Product/Offer schema, pagination canonicals) |
| `npm run local` | Local SEO (LocalBusiness schema, NAP consistency) |
| `npm run dup` | Near-duplicate content & duplicate-title detector |

### 5. Performance & Security

| Command | Description |
|---------|-------------|
| `npm run perf` | Core Web Vitals & asset budget scanner |
| `npm run bundle` | JavaScript bundle weight & third-party scripts |
| `npm run security` | Enterprise security headers & best practices scanner |
| `npm run security:json` | Output security scan in pure JSON |
| `npm run secrets` | Hardcoded secrets & credential leak scanner |
| `npm run a11y` | Accessibility (WCAG) scanner |
| `npm run lighthouse` | Lighthouse CI performance audit |

### 6. Intelligence & Preview

| Command | Description |
|---------|-------------|
| `npm run competitor` | Scrapes competitor URLs & generates Topic Gap Matrix |
| `npm run compare` | Side-by-side technical & content comparison |
| `npm run ranking` | 15-signal SERP ranking probability engine |
| `npm run rank-tracker` | Track ranking momentum from GSC/CSV data |
| `npm run preview` | Generates interactive HTML SERP & social preview dashboard |
| `npm run crawl` | Polite robots-aware live crawler |
| `npm run pagespeed` | PageSpeed Insights & CrUX field data |
| `npm run gsc` | Google Search Console data analyzer |
| `npm run logs` | Server access log analyzer |
| `npm run monorepo` | Monorepo structure detector |

### 7. Asset Generation

| Command | Description |
|---------|-------------|
| `npm run og` | Generate branded 1200x630 og-image.svg |
| `npm run badge` | Generate live SVG SEO score badge |
| `npm run validate-schema` | Schema.org JSON-LD validator |
| `npm run i18n` | Multilingual hreflang reciprocity check |

### 8. Indexing & CI

| Command | Description |
|---------|-------------|
| `npm run ping-indexnow` | Alert IndexNow (Bing/Yandex) with updated routes |
| `npm test` | Run comprehensive automated test suite (core + verticals) |
| `npm run test:core` | Run core test suite only |
| `npm run test:phase2` | Run vertical/expansion test suite only |

### 9. Unified CLI

```bash
# Use the unified CLI for any command
npx sps-seo <command>

# Examples
npx sps-seo audit --json
npx sps-seo fix --apply
npx sps-seo security --json
```

---

## Workflow Guides

### Full SEO Overhaul

```
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
1. node scripts/audit.mjs (score >= 90)
2. node scripts/lighthouse.mjs (performance)
3. node scripts/security.mjs (no secret leaks)
4. node scripts/sitemap:validate.mjs (valid sitemap)
5. node scripts/redirect.mjs (no broken redirects)
6. node scripts/dup.mjs (no duplicate content)
```

### Single-Task Prompts

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

## Agent Integration

### Claude Code

**Installation:** `./scripts/install.sh --global` installs to `~/.agents/skills/sps-seo`

**Usage:**
```
Run: node scripts/audit.mjs --json
Run: node scripts/fix.mjs --apply
```

See [hosts/claude.md](hosts/claude.md) for details.

### Cursor

**Installation:** `./scripts/install.sh --global` installs to `~/.cursor/skills/sps-seo`

**Usage:**
- Mirror `SYSTEM-PROMPT.md` core directives into `.cursorrules` or `.cursor/rules/seo.mdc`
- Run commands in Cursor terminal

See [hosts/cursor.md](hosts/cursor.md) for details.

### OpenAI Codex

**Usage:**
- In web UI: Load instructions from `SYSTEM-PROMPT.md`
- In sandbox: Run `node scripts/audit.mjs` directly

See [hosts/codex.md](hosts/codex.md) for details.

### Windsurf (Cascade)

**Installation:** `./scripts/install.sh --global` installs to `~/.windsurf/skills/sps-seo`

**Usage:**
- Store brand/keyword/domain facts from `sps-seo-config.json` as Cascade Memories
- Run commands via Cascade's command tool

See [hosts/windsurf.md](hosts/windsurf.md) for details.

### Antigravity / Gemini

**Installation:** `./scripts/install.sh --global` installs to `~/.gemini/config/skills/sps-seo`

**Usage:**
- Use `run_command` to execute `npm run audit` and `npm run fix`
- Write audit findings to `sps-seo-audit-report.md`

See [hosts/antigravity.md](hosts/antigravity.md) for details.

### OpenCode

**Installation:** `./scripts/install.sh --global` installs to `~/.agents/skills/sps-seo`

**Usage:**
- Execute commands using native bash tools
- Reference `sps-seo-config.json` before proposing metadata changes

See [hosts/opencode.md](hosts/opencode.md) for details.

### MCP Server

SPS SEO includes a full MCP (Model Context Protocol) server for integration with MCP-compatible agents:

```bash
npm run mcp
```

Exposes all 40+ tools via MCP 2024-11-05 protocol over stdio.

---

## Configuration

### Initial Setup

Run the interactive wizard:

```bash
node scripts/init.mjs
```

This creates `sps-seo-config.json` with:
- Brand name and description
- Target keywords
- Author information (E-E-A-T)
- Domain URL
- Social media handles
- Theme colors

### Configuration File Format

```json
{
  "brand": "Your Brand",
  "description": "Your brand description",
  "keywords": ["keyword1", "keyword2"],
  "author": "Author Name",
  "domain": "https://example.com",
  "social": {
    "twitter": "@handle",
    "github": "username"
  },
  "colors": {
    "primary": "#3b82f6",
    "secondary": "#10b981"
  }
}
```

### Dual Memory Synchronization

If your project uses the SPS workflow (`.sps/` directory), run:

```bash
node scripts/sync-config.mjs
```

This maintains bidirectional synchronization between `sps-seo-config.json` and `.sps/seo.json`.

---

## CI/CD Integration

### GitHub Actions Quality Gate

SPS SEO includes a GitHub Actions workflow that blocks PRs if the SEO score drops below 90/100:

```yaml
# .github/workflows/seo-check.yml
name: SPS SEO Quality Gate
on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]

jobs:
  seo-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm test
      - run: node scripts/audit.mjs --json
      - run: node tests/test-phase2.mjs
      - run: node scripts/validate-schema.mjs
      - run: node scripts/internal-links.mjs
      - name: Enforce SEO Quality Gate (Score >= 90)
        run: |
          if [ "$AUDIT_SCORE" -lt 90 ]; then
            echo "SEO Quality Gate FAILED"
            exit 1
          fi
```

### Cross-Version CI Matrix

```yaml
# .github/workflows/ci-matrix.yml
name: SPS SEO Cross-Version CI
on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]
  schedule:
    - cron: '0 6 * * 1'  # Weekly regression

jobs:
  cross-version:
    strategy:
      matrix:
        node-version: [18, 20, 22, 24]
        os: [ubuntu-latest, macos-latest, windows-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: node --check scripts/*.mjs
      - run: node tests/test-audit.mjs
      - run: node tests/test-phase2.mjs
```

### Pre-Commit Hook

Install a pre-commit hook that runs audit before each commit:

```bash
./scripts/setup-git-hook.sh
```

---

## Testing

### Run All Tests

```bash
npm test
```

### Run Core Tests Only

```bash
npm run test:core
```

### Run Phase 2 Tests Only

```bash
npm run test:phase2
```

### Test Results

- **118 core assertions** — audit engine, scoring, parsing
- **29 phase 2 assertions** — vertical SEO tools
- **147 total assertions** — all passing

---

## Architecture

### Directory Structure

```
sps-seo/
├── scripts/                  # 47 CLI tools (zero dependencies)
│   ├── audit.mjs            # Deterministic 100-point audit engine
│   ├── fix.mjs              # Automated remediation
│   ├── init.mjs             # Interactive config wizard
│   ├── lib/
│   │   └── core.mjs         # Shared utilities (VERSION, walkFiles, etc.)
│   ├── install.sh           # Multi-agent installer
│   ├── uninstall.sh         # Complete uninstaller
│   ├── update.sh            # Auto-update from GitHub
│   └── ...                  # 40+ specialized SEO tools
├── hosts/                   # Agent-specific integration guides
│   ├── claude.md
│   ├── cursor.md
│   ├── codex.md
│   ├── windsurf.md
│   ├── antigravity.md
│   └── opencode.md
├── adapters/                # Framework-specific playbooks
│   ├── nextjs-app.md
│   ├── nextjs-pages.md
│   ├── astro.md
│   ├── vite-react.md
│   ├── static-html.md
│   ├── wordpress.md
│   ├── shopify.md
│   ├── webflow.md
│   ├── headless-cms.md
│   └── universal-fallback.md
├── schemas/                 # 17 JSON-LD schema templates
│   ├── article.json
│   ├── product.json
│   ├── faq.json
│   ├── local-business.json
│   └── ...
├── guides/                  # Deep-dive playbooks
│   ├── aeo-geo-optimization.md
│   ├── lighthouse-100-playbook.md
│   ├── core-web-vitals-checklist.md
│   └── ...
├── tests/                   # Automated test suites
│   ├── test-audit.mjs       # 118 core assertions
│   └── test-phase2.mjs      # 29 vertical assertions
├── .github/workflows/       # CI/CD workflows
│   ├── seo-check.yml        # Quality gate (score >= 90)
│   └── ci-matrix.yml        # Cross-version testing
├── SKILL.md                 # AI agent skill definition
├── SYSTEM-PROMPT.md         # Master system prompt
├── METHOD-CARD.md           # 10 hard laws of SPS SEO
├── PROMPTS.md               # Master prompts for every SEO task
├── README.md                # This file
├── VERSION                  # Current version (1.4.0)
├── package.json             # npm scripts and bin
└── LICENSE                  # MIT License
```

### Supported Frameworks

| Framework | Detection | Adapter |
|-----------|-----------|---------|
| Next.js App Router | `app/layout.tsx`, `export const metadata` | [adapters/nextjs-app.md](adapters/nextjs-app.md) |
| Next.js Pages Router | `pages/_app.tsx`, `next/head` | [adapters/nextjs-pages.md](adapters/nextjs-pages.md) |
| Astro | `src/layouts/Layout.astro`, frontmatter | [adapters/astro.md](adapters/astro.md) |
| Vite/React SPA | `index.html`, `react-helmet-async` | [adapters/vite-react.md](adapters/vite-react.md) |
| Static HTML | Direct semantic `<head>` | [adapters/static-html.md](adapters/static-html.md) |
| WordPress | `wp-content/` | [adapters/wordpress.md](adapters/wordpress.md) |
| Shopify | `shopify.theme` | [adapters/shopify.md](adapters/shopify.md) |
| Webflow | `webflow.css` | [adapters/webflow.md](adapters/webflow.md) |
| Headless CMS | Sanity/Contentful/Strapi | [adapters/headless-cms.md](adapters/headless-cms.md) |
| Universal Fallback | Any other project | [adapters/universal-fallback.md](adapters/universal-fallback.md) |

---

## Troubleshooting

### Common Issues

#### "Command not found: node"
Install Node.js >= 18.0.0 from [nodejs.org](https://nodejs.org/)

#### "Permission denied: ./scripts/install.sh"
Make scripts executable:
```bash
chmod +x scripts/*.sh
```

#### "Could not check for updates"
Check your internet connection or verify the repository URL:
```bash
SPS_SEO_REPO_URL=https://github.com/user/repo.git ./scripts/update.sh --check
```

#### "Score is 0/100 on empty project"
This is correct behavior. An empty project has no SEO signals. Add content and run `fix.mjs` to scaffold missing files.

#### "Deprecated entrypoint" warning
Some old script names (like `keyword-check.mjs`) now forward to their canonical versions. This is expected and harmless.

### Getting Help

1. Check [PROMPTS.md](PROMPTS.md) for task-specific prompts
2. Check [guides/](guides/) for deep-dive playbooks
3. Check [hosts/](hosts/) for agent-specific instructions
4. Run `node scripts/audit.mjs --help` for command options

---

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Run `npm test` to ensure all 147 assertions pass
4. Submit a pull request

---

## License

MIT License © 2026 Shahid

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────────────┐
│                     SPS SEO QUICK REFERENCE                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  INSTALL:                                                       │
│    ./scripts/install.sh --global                                │
│                                                                 │
│  CONFIGURE:                                                     │
│    node scripts/init.mjs                                        │
│                                                                 │
│  AUDIT:                                                         │
│    node scripts/audit.mjs --json                                │
│                                                                 │
│  FIX:                                                           │
│    node scripts/fix.mjs --apply                                 │
│                                                                 │
│  VERIFY:                                                        │
│    node scripts/audit.mjs                                       │
│                                                                 │
│  UPDATE:                                                        │
│    ./scripts/update.sh                                          │
│                                                                 │
│  UNINSTALL:                                                     │
│    ./scripts/uninstall.sh                                       │
│                                                                 │
│  HELP:                                                          │
│    node scripts/cli.mjs help                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```
