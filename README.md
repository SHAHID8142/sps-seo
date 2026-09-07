# SPS SEO

> **The Ultimate Framework-Agnostic AI Agent Skill & Autonomous Technical SEO Intelligence System**

[![Version](https://img.shields.io/badge/version-1.5.0-blue.svg)](VERSION)
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
9. [How to Use (Non-Coders Welcome!)](#how-to-use-for-everyone---non-coders-welcome)
   - [What Does It Do?](#what-does-sps-seo-actually-do)
   - [Understanding Your Score](#understanding-your-score)
   - [Audit Output Example](#what-does-the-audit-output-look-like)
   - [Before & After](#before--after-example)
   - [Step-by-Step Guide](#step-by-step-complete-seo-audit-for-beginners)
   - [Understanding Errors](#understanding-error-messages)
   - [Common Tasks](#common-tasks-explained)
   - [All Commands Explained](#understanding-all-commands-plain-english-translation)
   - [Scenario Guides](#scenario-based-guides)
   - [FAQ](#faq-frequently-asked-questions)
10. [License](#license)
11. [Quick Reference Card](#quick-reference-card)

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
- **Security Auditor** (`security-audit.mjs`): Live header probe with value validation (HSTS strength, CSP quality, nosniff), cookie flag audit (Secure/HttpOnly/SameSite), COOP/COEP/CORP, CORS wildcard detection, debug-endpoint probing (`--url https://yoursite.com`), source-map exposure, security.txt, recursive served-dir scanning.
- **Secret Leak Scanner** (`secrets-scan.mjs`): 40+ vendor token families (AWS/Azure/GCP, GitHub, OpenAI, Anthropic, Stripe, Slack, Vercel, Netlify, Telegram, Cloudflare, Firebase, Supabase, DB connection strings, PKCS#8 keys), scans `.env*`, `.npmrc`, `id_rsa`, comments, `public/`.
- **Dependency Vulnerability Audit** (`dep-audit.mjs`): Wraps `npm audit` (pnpm/yarn auto-detected); fails CI on critical/high CVEs.
- **Bundle Analyzer** (`bundle.mjs`): Audits JavaScript bundle weight and third-party scripts.
- **Log Analyzer** (`log-analyzer.mjs`): Crawl-waste detection plus security signals — brute-force suspects, path-traversal/SQLi/XSS probes, per-IP rate anomalies.

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
git clone https://github.com/SHAHID8142/sps-seo.git
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

### Interactive Consultant Mode (Recommended)

```bash
sps-seo
# or: npm run consult
```

This launches an **interactive SEO consultant** that:
1. Runs a silent audit first (shows your score)
2. Asks numbered questions about your project (goals, keywords, audience, competitors, etc.)
3. Presents a unified action plan
4. **Waits for your confirmation** before applying changes
5. Saves all answers to `sps-seo-config.json`

Just reply with numbers (1, 2, 3, etc.) at each prompt.

### Manual Mode — New Project

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

### Manual Mode — Existing Project

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

## How to Use (For Everyone - Non-Coders Welcome!)

Don't worry if you're not a technical person! SPS SEO is designed to be simple. This section explains everything in plain English.

### What Does SPS SEO Actually Do?

Think of SPS SEO as a **doctor for your website**. Just like a doctor checks your health, SPS SEO checks your website's **SEO health** — how well it can be found on Google and other search engines.

Here's what it checks:

| What It Checks | What That Means in Plain English |
|----------------|--------------------------------|
| **Title Tags** | Does each page have a clear, descriptive title? (This is what appears in Google search results) |
| **Meta Descriptions** | Does each page have a short summary that tells people what the page is about? |
| **Headings (H1, H2, etc.)** | Is your content organized with clear headings like a book has chapters? |
| **Image Alt Text** | Do your images have descriptions? (This helps blind people and Google understand your images) |
| **Schema Markup** | Does your website tell search engines specific information (like "this is a product" or "this is a recipe")? |
| **Internal Links** | Are your pages linked to each other so visitors can navigate? |
| **Sitemap** | Do you have a "map" of your website that search engines can read? |
| **Page Speed** | Does your website load quickly? (Slow websites rank lower) |
| **Mobile-Friendly** | Does your website work well on phones? |
| **Security** | Is your website protected with proper security settings? |

### Understanding Your Score

When you run an audit, you get a **score from 0 to 100**:

| Score | Grade | What It Means |
|-------|-------|---------------|
| **90-100** | A (Excellent) | Your website is in great shape! Google will love it. |
| **80-89** | B (Good) | Pretty good, but there are some things to improve. |
| **70-79** | C (Average) | You're missing several important SEO elements. |
| **60-69** | D (Below Average) | Your website needs significant SEO work. |
| **0-59** | F (Failing) | Your website is hard for Google to find. Major improvements needed. |

**Goal: Get to 90+ (Grade A)**

### What Does the Audit Output Look Like?

When you run `node scripts/audit.mjs`, you'll see something like this:

```
SPS SEO AUDIT REPORT
====================

  SCORE: 72/100 (Grade C - Average)

  [PASS] robots.txt found
  [PASS] sitemap.xml found
  [FAIL] 3 images missing alt text
  [FAIL] 2 pages missing meta description
  [WARN] Page title too long (75 chars, max 60)
  [FAIL] No JSON-LD schema found
  [PASS] Heading hierarchy correct
  [WARN] 1 orphan page detected

  Run 'node scripts/fix.mjs --apply' to fix 4 issues
```

**How to read it:**
- **[PASS]** = Good! No action needed
- **[FAIL]** = Problem that hurts your SEO. Fix this!
- **[WARN]** = Not critical, but should be improved

### Before & After Example

**Before SPS SEO:**
```
Score: 35/100 (Grade F)
- No robots.txt
- No sitemap.xml
- 12 images without alt text
- No meta descriptions
- No schema markup
- Page title missing
```

**After running `fix.mjs --apply`:**
```
Score: 89/Grade B
- [PASS] robots.txt created
- [PASS] sitemap.xml created
- [PASS] All images now have alt text
- [PASS] Meta descriptions added
- [PASS] Schema markup injected
- [PASS] Page title optimized
```

**Result: +54 points improvement!**

---

### Step-by-Step: Complete SEO Audit (For Beginners)

#### Step 1: Open Your Computer's Terminal

- **Mac**: Press `Cmd + Space`, type "Terminal", press Enter
- **Windows**: Press `Win + R`, type "cmd", press Enter
- **Linux**: Press `Ctrl + Alt + T`

#### Step 2: Navigate to Your Website's Folder

Type this command and press Enter:
```bash
cd /path/to/your/website
```

(Replace `/path/to/your/website` with the actual location of your website files)

#### Step 3: Configure SPS SEO (One-Time Setup)

Run this command:
```bash
node scripts/init.mjs
```

It will ask you some questions:
- **Brand name**: Your company or website name
- **Description**: What your website is about
- **Keywords**: What people might type into Google to find you
- **Your name**: (For Google's E-E-A-T signals)
- **Website URL**: Your full website address (like `https://yoursite.com`)

This creates a configuration file that SPS SEO uses for all future audits.

#### Step 4: Run Your First Audit

Run this command:
```bash
node scripts/audit.mjs
```

**What happens**: SPS SEO scans all your website files and gives you a detailed report with:
- Your overall score (0-100)
- What's missing or broken
- Specific suggestions to improve

#### Step 5: Fix Problems Automatically

Run this command:
```bash
node scripts/fix.mjs --apply
```

**What happens**: SPS SEO automatically:
- Creates missing `robots.txt` (tells search engines which pages to index)
- Creates missing `sitemap.xml` (lists all your pages for search engines)
- Creates `llms.txt` (helps AI search engines understand your site)
- Adds alt text to images that are missing it
- Adds missing meta descriptions

**Don't worry**: The fix command only ADDS missing files. It won't delete or break anything.

### Understanding Error Messages

If you see an error, don't panic! Here are common ones:

| Error | What It Means | What To Do |
|-------|---------------|------------|
| `command not found: node` | Node.js is not installed | Install Node.js from [nodejs.org](https://nodejs.org/) |
| `No such file or directory` | You're in the wrong folder | Make sure you `cd` into your website's folder |
| `Cannot find module` | Script dependencies missing | Run `npm install` in the sps-seo folder |
| `Permission denied` | Script not executable | Run `chmod +x scripts/*.sh` |
| `Score: 0/100` on empty folder | No website files found | Make sure you're in the right folder |
| `Deprecated entrypoint` warning | You're using an old script name | This is harmless, it still works |

**Tip**: Most errors can be fixed by making sure:
1. You have Node.js installed (run `node --version` to check)
2. You're in your website's folder (run `pwd` to see where you are)
3. You've run `init` before `audit`

### Common Tasks Explained

#### "I want to check if my pages rank well for specific keywords"

```bash
node scripts/keyword.mjs
```

This checks if your target keywords appear in the right places:
- Page title
- First heading (H1)
- First 100 words
- Throughout the content (but not too much!)

#### "I want to see what my site looks like in Google search results"

```bash
node scripts/preview.mjs
```

This creates an HTML file (`public/seo-preview.html`) that shows you:
- How your page appears in Google Desktop
- How it appears in Google Mobile
- How it looks when shared on Twitter/X
- How it appears in Facebook/LinkedIn previews

#### "I want to add structured data so Google shows rich results"

```bash
node scripts/validate-schema.mjs
```

This checks if your Schema.org markup is correct. Schema markup tells Google specific things like:
- "This is a product with a price of $29.99"
- "This is a recipe that takes 30 minutes"
- "This is an event on January 15th"

#### "I want to check if my website is fast enough"

```bash
node scripts/perf.mjs
```

This checks:
- Total page size (should be under 1.5MB)
- Individual image sizes (should be under 200KB each)
- Whether images have dimensions set (prevents layout shifts)
- Font loading behavior

#### "I want to check if my website is secure"

```bash
node scripts/security.mjs
```

### Understanding All Commands (Plain English Translation)

| Command | What It Does in Plain English |
|---------|-------------------------------|
| `init` | First-time setup - answers questions about your website |
| `audit` | Health check - gives you a score and lists problems |
| `fix` | Doctor - automatically fixes common problems |
| `keyword` | Checks if you're using the right words in the right places |
| `tfidf` | Advanced content analysis - finds missing topics |
| `snippet` | Optimizes your content to appear in Google's featured snippets |
| `cannibalization` | Checks if multiple pages compete for the same search terms |
| `links` | Maps your internal links and finds orphan pages |
| `redirect` | Checks for broken redirects and loops |
| `sitemap` | Creates a sitemap file for search engines |
| `sitemap:validate` | Checks if your sitemap is correct |
| `rss` | Creates an RSS feed for your content |
| `video` | Checks video SEO (schema, embeds, video sitemap) |
| `news` | Checks news article SEO (freshness, news sitemap) |
| `ecom` | Checks product page SEO (prices, availability) |
| `local` | Checks local business SEO (address, phone, maps) |
| `dup` | Finds duplicate content across your site |
| `perf` | Checks page speed and performance |
| `bundle` | Analyzes JavaScript file sizes |
| `security` | Checks security settings |
| `secrets` | Scans for accidentally exposed passwords |
| `a11y` | Checks accessibility for disabled users |
| `lighthouse` | Runs Google's Lighthouse performance test |
| `competitor` | Analyzes your competitors' websites |
| `compare` | Compares your site side-by-side with a competitor |
| `ranking` | Calculates how likely you are to rank #1 |
| `preview` | Shows how your site looks in search results |
| `crawl` | Crawls your live website like Google does |
| `pagespeed` | Gets real Google PageSpeed data |
| `gsc` | Imports data from Google Search Console |
| `logs` | Analyzes your server logs for crawl issues |
| `monorepo` | Detects if you have a multi-package project |
| `og` | Creates social media preview images |
| `badge` | Creates a score badge for your README |
| `i18n` | Checks multi-language hreflang tags |
| `sync-config` | Syncs config between files |
| `hook` | Installs a git pre-commit SEO quality gate |
### Scenario-Based Guides

#### Scenario 1: "I just built a website and want to make sure it's SEO-ready"

```bash
# 1. Configure SPS SEO
node scripts/init.mjs

# 2. Run first audit
node scripts/audit.mjs

# 3. Fix all issues
node scripts/fix.mjs --apply

# 4. Create sitemap and social image
node scripts/sitemap.mjs
node scripts/og.mjs

# 5. Verify score is 90+
node scripts/audit.mjs
```

#### Scenario 2: "My website exists but doesn't get traffic"

```bash
# 1. Run comprehensive audit
node scripts/audit.mjs

# 2. Check keywords are properly used
node scripts/keyword.mjs

# 3. Check for duplicate content
node scripts/dup.mjs

# 4. Check internal linking
node scripts/links.mjs

# 5. Check page speed
node scripts/perf.mjs

# 6. Fix everything
node scripts/fix.mjs --apply
```

#### Scenario 3: "I'm launching a blog/news site"

```bash
# 1. Check news-specific SEO
node scripts/news.mjs

# 2. Generate RSS feed
node scripts/rss.mjs

# 3. Validate schemas
node scripts/validate-schema.mjs

# 4. Ping search engines
node scripts/ping-indexnow.mjs
```

#### Scenario 4: "I'm running an online store"

```bash
# 1. Check product page SEO
node scripts/ecom.mjs

# 2. Check for duplicate product descriptions
node scripts/dup.mjs

# 3. Optimize for snippets (price, availability)
node scripts/snippet.mjs

# 4. Validate product schemas
node scripts/validate-schema.mjs
```

#### Scenario 5: "I have a local business"

```bash
# 1. Check local business SEO
node scripts/local.mjs

# 2. Ensure NAP consistency (Name, Address, Phone)
# 3. Check for LocalBusiness schema
# 4. Verify geo coordinates
```

#### Scenario 6: "I want to track my rankings over time"

```bash
# 1. Export data from Google Search Console
# 2. Analyze with SPS SEO
node scripts/gsc.mjs --csv your-export.csv

# 3. Track ranking momentum
node scripts/rank-tracker.mjs
```

### Getting Help

If something doesn't work:

1. **Read the error message** - It usually tells you what's wrong
2. **Check the troubleshooting section** below
3. **Run with `--help`** - Most commands show help when you add `--help`
4. **Check file paths** - Make sure you're in the right directory

### FAQ (Frequently Asked Questions)

**Q: Do I need to know coding?**
A: No! You just need to run commands. The tool does everything for you.

**Q: Will this break my website?**
A: No. The `fix.mjs` command only adds missing files and fixes obvious issues. It won't break existing code.

**Q: How often should I run the audit?**
A: Run it:
- Before launching a new website
- After making major changes
- Monthly for maintenance
- Whenever you notice traffic drops

**Q: What if my score is low?**
A: Don't worry! Run `fix.mjs --apply` to auto-fix common issues, then work through the remaining suggestions.

**Q: Can I undo the fixes?**
A: Yes. The `fix.mjs` command creates new files (like `robots.txt`) but doesn't delete anything. You can manually edit or delete them.

**Q: Does this work with any website?**
A: Yes! It works with:
- Next.js, Astro, Vite, React
- WordPress, Shopify, Webflow
- Static HTML sites
- Any website with files on your computer

**Q: What's the difference between `audit` and `fix`?**
A: `audit` = diagnosis (tells you what's wrong). `fix` = treatment (fixes the problems).

**Q: What does `--json` mean?**
A: It outputs results in a machine-readable format. Useful for developers, but not necessary for beginners.

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
