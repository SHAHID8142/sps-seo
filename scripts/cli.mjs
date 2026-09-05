#!/usr/bin/env node

/**
 * SPS SEO Unified CLI Router
 * Version: 1.4.0
 *
 * Single entrypoint for all SPS SEO tools:
 *   sps-seo audit            deterministic 100-point audit
 *   sps-seo fix              automated remediation
 *   sps-seo links            internal link graph & orphans
 *   sps-seo keyword          keyword placement + density/intent (unified)
 *   sps-seo snippet          snippet eligibility + optimizer (unified)
 *   sps-seo backlink         link equity + digital PR (unified)
 *   sps-seo security         security + best practices (unified)
 *   sps-seo tfidf            TF*IDF + semantic entities (unified)
 *   sps-seo ranking          15-signal SERP probability engine
 *   sps-seo rank-tracker     GSC/CSV ranking momentum tracker
 *   ... (run `sps-seo help` for the full catalog)
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPTS_DIR = path.dirname(fileURLToPath(import.meta.url));

const COMMANDS = {
  'audit': 'audit.mjs',
  'audit:json': 'audit.mjs --json',
  'init': 'init.mjs',
  'fix': 'fix.mjs --apply',
  'fix:dry': 'fix.mjs --dry-run',
  'links': 'internal-links.mjs',
  'cannibalization': 'cannibalization.mjs',
  'tfidf': 'tfidf.mjs',
  'keyword': 'keyword-audit.mjs',
  'snippet': 'snippet-audit.mjs',
  'redirect': 'redirect-audit.mjs',
  'backlink': 'backlink-audit.mjs',
  'competitor': 'competitor-intel.mjs',
  'compare': 'seo-compare.mjs',
  'perf': 'perf-budget.mjs',
  'bundle': 'bundle-audit.mjs',
  'a11y': 'a11y.mjs',
  'security': 'security-audit.mjs',
  'secrets': 'secrets-scan.mjs',
  'lighthouse': 'lighthouse.mjs',
  'ranking': 'ranking-intel.mjs',
  'rank-tracker': 'ranking-tracker.mjs',
  'preview': 'preview-serp.mjs',
  'validate-schema': 'validate-schema.mjs',
  'i18n': 'i18n-seo.mjs',
  'og': 'generate-og.mjs',
  'sitemap': 'generate-sitemap.mjs',
  'sitemap:validate': 'sitemap-validate.mjs',
  'rss': 'generate-rss.mjs',
  'video': 'video-seo.mjs',
  'news': 'news-seo.mjs',
  'ecom': 'ecommerce-seo.mjs',
  'local': 'local-seo.mjs',
  'dup': 'duplicate-content.mjs',
  'badge': 'badge.mjs',
  'sync-config': 'sync-config.mjs',
  'ping-indexnow': 'ping-indexnow.mjs',
};

const HELP = `
SPS SEO v1.4.0 — Framework-Agnostic Technical SEO Intelligence

Usage: sps-seo <command> [options]

Core:
  init              Interactive config wizard
  audit             Deterministic 100-point SEO audit
  fix               1-click automated remediation (use fix:dry to preview)

Content & Keywords:
  keyword           Keyword placement + density/prominence/intent (unified)
  tfidf             TF*IDF & semantic entity scanner (unified)
  cannibalization   Keyword cannibalization & duplicate meta detector
  dup               Near-duplicate content detector (simhash)
  snippet           Featured snippet eligibility + optimizer (unified)
  ranking           15-signal SERP ranking probability engine
  rank-tracker      GSC/CSV ranking momentum tracker

Technical:
  links             Internal link graph & orphan pages
  redirect          Redirects, chains & canonical trailing slashes
  sitemap           Generate sitemap.xml, robots.txt, llms.txt
  sitemap:validate  Validate sitemap URLs, hreflang & index structure
  rss               Generate RSS 2.0 feed from content pages
  i18n              hreflang reciprocity validator
  ping-indexnow     Ping IndexNow-compatible engines

Verticals:
  video             Video SEO (VideoObject, embeds, video sitemap)
  news              News SEO (NewsArticle, news sitemap, freshness)
  ecom              E-commerce SEO (Product schema, pagination, offers)
  local             Local SEO (LocalBusiness, NAP, geo)

Quality:
  perf              Core Web Vitals & asset budget scanner
  a11y              Accessibility scanner
  security          Security headers, secrets & best practices (unified)
  secrets           Dedicated secret/credential leak scanner
  lighthouse        Lighthouse CI runner
  bundle            JS bundle weight auditor

Competitive:
  competitor        Competitor intelligence & content gap matrix
  compare           Side-by-side project benchmark

Assets & Social:
  og                Branded 1200x630 OpenGraph SVG card
  preview           Visual SERP/social/AI citation preview
  badge             Live SVG SEO score badge
  sync-config       Sync sps-seo-config.json <-> .sps/seo.json

Options are forwarded to the underlying tool (e.g. sps-seo audit --json).
Run 'npm run <command>' equivalently in any project with the skill installed.
`.trim();

const cmd = process.argv[2];

if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
  console.log(HELP);
  process.exit(0);
}

const entry = COMMANDS[cmd];
if (!entry) {
  console.error(`✗ Unknown command: "${cmd}"\n\nRun 'sps-seo help' for the command catalog.`);
  process.exit(1);
}

const [script, ...presetArgs] = entry.split(' ');
const forwardArgs = process.argv.slice(3);
const res = spawnSync(process.execPath, [path.join(SCRIPTS_DIR, script), ...presetArgs, ...forwardArgs], {
  stdio: 'inherit'
});
process.exit(res.status ?? 1);
