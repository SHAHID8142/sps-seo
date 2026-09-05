#!/usr/bin/env node

/**
 * SPS SEO Bundle & Render-Blocking Resource Audit
 * Version: 1.2.0
 *
 * Static checks across HTML and template files:
 *  - Render-blocking <script src=...> without async/defer/type=module
 *  - Render-blocking <link rel="stylesheet"> without media hints or preload
 *  - Inline <script> tag size estimation
 *  - Third-party script inventory (gtag, GA, Meta Pixel, Hotjar, Segment, ...)
 *  - Inline event handlers (onclick, onerror, onload) — CSP hygiene
 *  - <script src="http://..."> mixed content
 *  - Preconnect / dns-prefetch hints detection
 *  - Lazy-loading attributes on below-the-fold images (loading="lazy", decoding="async")
 *  - Eager hero image flag (loading="eager" or fetchpriority="high")
 *
 * Outputs a 0-100 Bundle Score + findings.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CWD = process.cwd();

const IGNORE_DIRS = new Set([
  'node_modules', '.git', '.next', '.nuxt', '.svelte-kit', '.astro',
  'dist', 'build', 'out', '.cache', 'coverage', '.gemini', 'scratch',
  '.sps', '.agents', 'public'
]);

const TEMPLATE_EXTS = new Set(['.html', '.htm', '.astro', '.tsx', '.jsx', '.vue', '.svelte', '.md', '.mdx']);

const THIRD_PARTY_DOMAINS = [
  'googletagmanager.com',
  'google-analytics.com',
  'gtag.js',
  'connect.facebook.net',
  'facebook.net',
  'static.hotjar.com',
  'script.hotjar.com',
  'cdn.segment.com',
  'fullstory.com',
  'mixpanel.com',
  'amplitude.com',
  'plausible.io',
  'clarity.ms',
  'mouseflow.com',
  'intercom.io',
  'intercom.com',
  'drift.com',
  'hubspot.com',
  'hs-analytics.net',
  'js.stripe.com',
  'checkout.stripe.com',
  'cdn.jsdelivr.net',
  'unpkg.com',
];

const INLINE_HANDLER_ATTRS = [
  'onclick', 'onerror', 'onload', 'onmouseover', 'onmouseout',
  'onkeydown', 'onkeyup', 'onkeypress', 'onfocus', 'onblur',
  'onsubmit', 'onchange', 'oninput'
];

export function runBundleAudit(options = {}) {
  const projectDir = options.cwd || CWD;
  const findings = [];
  let totalScore = 100;

  function penalize(amount, severity = 'medium') {
    const weights = { critical: 3, high: 2, medium: 1, low: 0.5 };
    totalScore -= amount * (weights[severity] || 1);
  }

  const stats = {
    renderBlockingScripts: 0,
    renderBlockingStylesheets: 0,
    inlineScripts: 0,
    largeInlineScripts: 0,
    thirdPartyScripts: new Set(),
    inlineHandlers: 0,
    mixedContentScripts: 0,
    preconnectHints: 0,
    lazyImagesMissing: 0,
    heroImagesEager: 0,
    filesScanned: 0,
  };

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (IGNORE_DIRS.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.isFile() && TEMPLATE_EXTS.has(path.extname(e.name).toLowerCase())) {
        auditFile(full, stats, findings, penalize);
        stats.filesScanned++;
      }
    }
  }
  walk(projectDir);

  // Aggregate findings
  if (stats.renderBlockingScripts > 0) {
    findings.unshift({
      severity: 'high',
      msg: `${stats.renderBlockingScripts} render-blocking <script src=...> without async/defer/type="module".`,
      fix: 'Add async, defer, or type="module" to every external <script>. Inline critical JS; defer non-critical.'
    });
  }
  if (stats.renderBlockingStylesheets > 0) {
    findings.unshift({
      severity: 'medium',
      msg: `${stats.renderBlockingStylesheets} render-blocking <link rel="stylesheet">.`,
      fix: 'Inline critical CSS; load non-critical CSS with media="print" onload="this.media=\'all\'" or <link rel="preload" as="style" onload="this.rel=\'stylesheet\'">.'
    });
  }
  if (stats.largeInlineScripts > 0) {
    findings.unshift({
      severity: 'medium',
      msg: `${stats.largeInlineScripts} inline <script> block(s) exceed 1 KB.`,
      fix: 'Extract to external file; cache via Service Worker; consider code-splitting.'
    });
  }
  if (stats.thirdPartyScripts.size > 0) {
    findings.unshift({
      severity: 'medium',
      msg: `${stats.thirdPartyScripts.size} third-party script host(s) detected: ${[...stats.thirdPartyScripts].slice(0, 5).join(', ')}${stats.thirdPartyScripts.size > 5 ? '...' : ''}.`,
      fix: 'Audit each for necessity and load timing. Use Partytown, facade patterns, or server-side forwarding for non-critical third parties.'
    });
  }
  if (stats.inlineHandlers > 0) {
    findings.unshift({
      severity: 'low',
      msg: `${stats.inlineHandlers} inline event handler(s) (onclick, onerror, etc.) — weakens CSP.`,
      fix: 'Move handlers to addEventListener in external JS so a strict CSP can forbid \'unsafe-inline\'.'
    });
  }
  if (stats.mixedContentScripts > 0) {
    findings.unshift({
      severity: 'high',
      msg: `${stats.mixedContentScripts} <script src="http://..."> reference(s) — mixed content blocked by browsers.`,
      fix: 'Use https:// or protocol-relative // for all script URLs.'
    });
  }
  if (stats.lazyImagesMissing > 0) {
    findings.unshift({
      severity: 'low',
      msg: `${stats.lazyImagesMissing} <img> tag(s) without loading="lazy" (below-the-fold heuristic).`,
      fix: 'Add loading="lazy" decoding="async" to below-the-fold images. Mark hero/LCP image loading="eager" fetchpriority="high".'
    });
  }
  if (stats.heroImagesEager > 0) {
    findings.unshift({
      severity: 'info',
      msg: `${stats.heroImagesEager} <img> tag(s) flagged as eager/priority (verify these are LCP candidates).`,
      fix: 'Only the largest above-the-fold image should be eager + fetchpriority="high".'
    });
  }
  if (stats.preconnectHints === 0) {
    findings.unshift({
      severity: 'low',
      msg: 'No <link rel="preconnect"> or dns-prefetch hints detected.',
      fix: 'Add preconnect for critical third-party origins (your CDN, font host, analytics).'
    });
  }

  totalScore = Math.max(0, Math.min(100, Math.round(totalScore)));
  const grade = totalScore >= 90 ? 'A' : totalScore >= 75 ? 'B' : totalScore >= 55 ? 'C' : 'F';

  const result = {
    timestamp: new Date().toISOString(),
    score: totalScore,
    grade,
    stats: { ...stats, thirdPartyScripts: [...stats.thirdPartyScripts] },
    findings
  };

  if (options.json || process.argv.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
    return result;
  }
  printConsole(result);
  return result;
}

function auditFile(fullPath, stats, findings, penalize) {
  let content;
  try { content = fs.readFileSync(fullPath, 'utf8'); } catch { return; }
  const stripped = content
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '');

  // Render-blocking scripts
  const scriptSrcRegex = /<script\b([^>]*\bsrc\s*=\s*["'][^"']+["'][^>]*)>/gi;
  let m;
  while ((m = scriptSrcRegex.exec(stripped)) !== null) {
    const attrs = m[1];
    const srcMatch = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(attrs);
    if (!srcMatch) continue;
    const src = srcMatch[1];

    // Skip framework module scripts (type="module" is async by default)
    if (/\btype\s*=\s*["']module["']/i.test(attrs)) continue;
    // Skip async/defer
    if (/\basync\b/i.test(attrs) || /\bdefer\b/i.test(attrs)) continue;

    stats.renderBlockingScripts++;
    penalize(2, 'high');
  }

  // Mixed-content scripts
  const httpScriptRegex = /<script\b[^>]*\bsrc\s*=\s*["']http:\/\/[^"']+["']/gi;
  const httpScripts = stripped.match(httpScriptRegex);
  if (httpScripts) {
    stats.mixedContentScripts += httpScripts.length;
    penalize(httpScripts.length * 5, 'high');
  }

  // Render-blocking stylesheets (no media, no preload, no disabled)
  const cssLinkRegex = /<link\b([^>]*\brel\s*=\s*["']stylesheet["'][^>]*?)>/gi;
  while ((m = cssLinkRegex.exec(stripped)) !== null) {
    const attrs = m[1];
    if (/\bmedia\s*=\s*["'](?:print|all)["']/i.test(attrs)) continue;
    if (/\bdisabled\b/i.test(attrs)) continue;
    if (/\bonload\s*=/i.test(attrs)) continue; // pattern that swaps rel on load
    stats.renderBlockingStylesheets++;
    penalize(2, 'medium');
  }

  // Inline scripts
  const inlineScriptRegex = /<script(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi;
  while ((m = inlineScriptRegex.exec(stripped)) !== null) {
    stats.inlineScripts++;
    const len = (m[1] || '').trim().length;
    if (len > 1024) {
      stats.largeInlineScripts++;
      penalize(3, 'medium');
    }
  }

  // Third-party scripts
  const anyScriptSrc = /\bsrc\s*=\s*["'](https?:\/\/[^"']+)["']/gi;
  while ((m = anyScriptSrc.exec(stripped)) !== null) {
    try {
      const host = new URL(m[1]).host;
      for (const d of THIRD_PARTY_DOMAINS) {
        if (host.includes(d)) {
          stats.thirdPartyScripts.add(host);
          break;
        }
      }
    } catch {}
  }
  if (stats.thirdPartyScripts.size > 0) penalize(stats.thirdPartyScripts.size, 'medium');

  // Inline event handlers
  let inlineHandlerCount = 0;
  for (const attr of INLINE_HANDLER_ATTRS) {
    const re = new RegExp(`\\b${attr}\\s*=\\s*["'][^"']+["']`, 'gi');
    const matches = stripped.match(re);
    if (matches) inlineHandlerCount += matches.length;
  }
  if (inlineHandlerCount > 0) {
    stats.inlineHandlers += inlineHandlerCount;
    penalize(Math.min(inlineHandlerCount, 10) * 0.5, 'low');
  }

  // Preconnect hints
  const preconnect = /<link\b[^>]*\brel\s*=\s*["'](?:preconnect|dns-prefetch)["']/i.test(stripped);
  if (preconnect) stats.preconnectHints++;

  // Image lazy/eager heuristic
  const imgRegex = /<img\b([^>]*?)(?:\/?>|>)/gi;
  while ((m = imgRegex.exec(stripped)) !== null) {
    const attrs = m[1];
    if (/\bloading\s*=\s*["']eager["']/i.test(attrs) || /\bfetchpriority\s*=\s*["']high["']/i.test(attrs)) {
      stats.heroImagesEager++;
    } else if (!/\bloading\s*=\s*["']lazy["']/i.test(attrs)) {
      // Heuristic: only flag if no loading attribute at all on non-framework images
      stats.lazyImagesMissing++;
    }
  }
  if (stats.lazyImagesMissing > 0) penalize(Math.min(stats.lazyImagesMissing, 20), 'low');
}

function printConsole(result) {
  console.log('\n====================================================');
  console.log('     SPS SEO BUNDLE & RESOURCE AUDIT                ');
  console.log('====================================================\n');
  console.log(`Bundle Score: ${result.score}/100 (Grade: ${result.grade})`);
  console.log(`Files scanned: ${result.stats.filesScanned}\n`);
  console.log(`Stats:`);
  console.log(`  Render-blocking scripts:    ${result.stats.renderBlockingScripts}`);
  console.log(`  Render-blocking CSS:        ${result.stats.renderBlockingStylesheets}`);
  console.log(`  Inline scripts (total):     ${result.stats.inlineScripts}`);
  console.log(`  Inline scripts >1 KB:       ${result.stats.largeInlineScripts}`);
  console.log(`  Third-party hosts:          ${result.stats.thirdPartyScripts.length}`);
  console.log(`  Inline event handlers:      ${result.stats.inlineHandlers}`);
  console.log(`  Mixed-content scripts:      ${result.stats.mixedContentScripts}`);
  console.log(`  Lazy-loading missing:       ${result.stats.lazyImagesMissing}`);
  console.log(`  Hero/eager images:          ${result.stats.heroImagesEager}`);
  console.log(`  Preconnect/dns-prefetch:    ${result.stats.preconnectHints}\n`);

  if (result.findings.length === 0) {
    console.log('  ✓ No bundle or render-blocking issues detected.\n');
    return;
  }

  const order = ['high', 'medium', 'low', 'info'];
  const icons = { high: '❌', medium: '⚠️', low: 'ℹ️', info: 'ℹ️' };
  for (const sev of order) {
    const items = result.findings.filter(f => f.severity === sev);
    for (const f of items) {
      console.log(`  ${icons[sev]} [${sev.toUpperCase()}] ${f.msg}`);
      if (f.fix) console.log(`     └─ Fix: ${f.fix}`);
    }
  }
  console.log('');
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  runBundleAudit();
}
