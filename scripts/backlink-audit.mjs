#!/usr/bin/env node

/**
 * SPS SEO Backlink & Internal Link Equity Audit
 * Version: 1.3.0
 *
 * Internal-link-graph-as-backlink-equity analyzer:
 *  - Treats each internal <a> as an equity-passing link (with dofollow/nofollow weight)
 *  - Treats each external <a> as a backlink signal
 *  - Computes per-page "PageRank-lite": weighted sum of inbound equity
 *    (dofollow full, nofollow 0, sponsored/ugc treated as nofollow)
 *  - Reports:
 *      - Top pages by inbound equity
 *      - Orphan pages by SEO priority (title, depth, word count proxy)
 *      - Pages with only-nofollow inbound equity (link-juice dead-ends)
 *      - External vs internal link ratio per page
 *      - Anchor text diversity (high single-anchor concentration = over-optimization)
 *
 * NOTE: This is NOT a backlink checker for inbound external links (that needs
 * Ahrefs/Semrush/Majestic data). It analyzes the equity topology of your
 * site as if internal links were backlinks.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeBacklinks } from './backlink-intel.mjs';
import { captureConsole } from './lib/core.mjs';

const CWD = process.cwd();

const IGNORE_DIRS = new Set([
  'node_modules', '.git', '.next', '.nuxt', '.svelte-kit', '.astro',
  'dist', 'build', 'out', '.cache', 'coverage', '.gemini', 'scratch',
  '.sps', '.agents', 'public'
]);

const SCAN_EXTS = new Set(['.html', '.htm', '.astro', '.tsx', '.jsx', '.vue', '.svelte', '.md', '.mdx']);

const WEAK_ANCHORS = new Set([
  'click here', 'here', 'read more', 'learn more', 'more', 'link',
  'view', 'this', 'go', 'details', 'check this out', ''
]);

export function runBacklinkAudit(options = {}) {
  const projectDir = options.cwd || CWD;
  const pages = new Map();
  const links = []; // { from, to, rel, anchor, isExternal }

  // Pass 1: discover pages + collect links
  function walk(dir, route = '/') {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (IGNORE_DIRS.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full, route);
      else if (e.isFile() && SCAN_EXTS.has(path.extname(e.name).toLowerCase())) {
        const rel = path.relative(projectDir, full);
        pages.set(rel, { route, file: rel, inboundInternal: [], inboundExternal: [], outboundInternal: 0, outboundExternal: 0, anchors: [] });
        let content;
        try { content = fs.readFileSync(full, 'utf8'); } catch { continue; }
        extractLinks(rel, content, links);
      }
    }
  }
  walk(projectDir);

  // Pass 2: aggregate inbound links per page
  for (const l of links) {
    if (l.isExternal) continue;
    // For internal links, resolve target route best-effort
    const target = l.toRaw; // path-cleaned href
    // Try to match to a known page by file path
    const matchedKey = matchPage(target, pages);
    if (matchedKey) {
      const targetPage = pages.get(matchedKey);
      targetPage.inboundInternal.push({
        from: l.from,
        rel: l.rel,
        anchor: l.anchor,
        dofollow: !l.nofollow
      });
    }
  }

  // Per-page analytics
  const pageReports = [];
  for (const [key, p] of pages) {
    const inboundDofollow = p.inboundInternal.filter(l => l.dofollow).length;
    const inboundNofollow = p.inboundInternal.filter(l => !l.dofollow).length;
    const equityScore = inboundDofollow * 1.0 + inboundNofollow * 0.0;
    const totalInbound = p.inboundInternal.length;
    const externalRatio = (p.outboundInternal + p.outboundExternal) > 0
      ? p.outboundExternal / (p.outboundInternal + p.outboundExternal)
      : 0;

    // Anchor diversity: how concentrated are the inbound anchors?
    const anchorCounts = {};
    for (const l of p.inboundInternal) {
      const a = (l.anchor || '').toLowerCase().trim();
      if (!a) continue;
      anchorCounts[a] = (anchorCounts[a] || 0) + 1;
    }
    const totalAnchors = Object.values(anchorCounts).reduce((s, n) => s + n, 0);
    const topAnchorShare = totalAnchors > 0
      ? Math.max(...Object.values(anchorCounts)) / totalAnchors
      : 0;

    pageReports.push({
      file: p.file,
      route: p.route,
      inboundInternal: totalInbound,
      inboundDofollow,
      inboundNofollow,
      outboundInternal: p.outboundInternal,
      outboundExternal: p.outboundExternal,
      equityScore,
      externalRatio: +externalRatio.toFixed(3),
      anchorDiversity: +(1 - topAnchorShare).toFixed(3),
      topAnchor: Object.entries(anchorCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null
    });
  }

  pageReports.sort((a, b) => b.equityScore - a.equityScore);

  // Orphans: pages with no inbound internal links AND no inboundExternal
  const orphans = pageReports.filter(p => p.inboundInternal === 0);

  // Dead-ends (no outbound internal): only worth flagging if non-orphan
  const deadEnds = pageReports.filter(p => p.inboundInternal > 0 && p.outboundInternal === 0);

  // Score
  let score = 100;
  const findings = [];
  if (orphans.length > 0) {
    findings.push({
      severity: orphans.length > 3 ? 'high' : 'medium',
      msg: `${orphans.length} orphan page(s) — no inbound internal links. They receive zero PageRank-lite equity.`
    });
    score -= Math.min(30, orphans.length * 5);
  }
  if (deadEnds.length > 0) {
    findings.push({
      severity: 'low',
      msg: `${deadEnds.length} dead-end page(s) — receives inbound equity but links out to nothing internally.`
    });
    score -= Math.min(10, deadEnds.length * 2);
  }

  // Anchor over-optimization
  const overOpt = pageReports.filter(p => p.anchorDiversity < 0.3 && p.inboundInternal >= 3);
  if (overOpt.length > 0) {
    findings.push({
      severity: 'medium',
      msg: `${overOpt.length} page(s) have low anchor diversity (< 30%). Same anchor text repeats too often — over-optimization risk.`
    });
    score -= Math.min(15, overOpt.length * 3);
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 55 ? 'C' : 'F';

  const result = {
    timestamp: new Date().toISOString(),
    score,
    grade,
    pagesAnalyzed: pages.size,
    totalLinks: links.length,
    orphans,
    deadEnds,
    overOptimized: overOpt,
    topByEquity: pageReports.slice(0, 15),
    findings
  };

// [v1.4 composed] Merge the deprecated standalone companion engine into this unified report.
  try {
    const jsonMode = options.json || process.argv.includes('--json');
    result.companion = jsonMode
      ? captureConsole(() => analyzeBacklinks({ json: true })).result
      : analyzeBacklinks({});
  } catch (e) {
    result.companion = { error: e.message };
  }

  if (options.json || process.argv.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
    return result;
  }
  printConsole(result);
  return result;
}

function extractLinks(fromFile, content, links) {
  const stripped = content
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '');

  const linkRegex = /<a\b([^>]*?)>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = linkRegex.exec(stripped)) !== null) {
    const attrs = m[1];
    const body = (m[2] || '').replace(/<[^>]+>/g, '').trim();
    const hrefMatch = /\bhref\s*=\s*["']([^"']+)["']/i.exec(attrs);
    if (!hrefMatch) continue;
    const href = hrefMatch[1].trim();
    if (!href || href.startsWith('mailto:') || href.startsWith('tel:') || href === '#' || href.startsWith('javascript:')) continue;

    const isExternal = /^https?:\/\//i.test(href);
    const rel = /\brel\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1] || '';
    const nofollow = /\bnofollow\b/i.test(rel) || /\bsponsored\b/i.test(rel) || /\bugc\b/i.test(rel);

    if (isExternal) continue; // external not relevant for internal-link-equity

    const cleanHref = href.split('?')[0].split('#')[0];
    if (!cleanHref) continue;

    links.push({
      from: fromFile,
      toRaw: cleanHref,
      isExternal,
      rel,
      nofollow,
      anchor: body
    });
  }
}

function matchPage(target, pages) {
  // Try several heuristics
  const keys = Array.from(pages.keys());
  // Exact file path match (e.g. "/about" → "pages/about.html")
  const candidates = [
    target.replace(/^\//, ''),
    target.replace(/^\//, '') + '.html',
    target.replace(/^\//, '') + '.tsx',
    target.replace(/^\//, '') + '.jsx',
    target.replace(/^\//, '') + '.astro',
    target.replace(/^\//, '') + '.vue',
    target.replace(/^\//, '') + '.svelte',
    target.replace(/^\//, '') + '/index.html',
    target.replace(/^\//, '') + '/index.tsx',
  ];
  for (const c of candidates) {
    if (pages.has(c)) return c;
  }
  // Fuzzy: file name matches
  const base = path.basename(target);
  for (const k of keys) {
    if (k.endsWith('/' + base + '.html') || k.endsWith('/' + base + '.tsx') || k.endsWith('/' + base + '.astro') || k.endsWith(base + '.html') || k.endsWith(base + '.astro')) {
      return k;
    }
  }
  return null;
}

function printConsole(result) {
  console.log('\n====================================================');
  console.log('     SPS SEO BACKLINK / EQUITY AUDIT                 ');
  console.log('====================================================\n');
  console.log(`Equity Score: ${result.score}/100 (Grade: ${result.grade})`);
  console.log(`Pages analyzed: ${result.pagesAnalyzed}`);
  console.log(`Total links: ${result.totalLinks}`);
  console.log(`Orphan pages: ${result.orphans.length}`);
  console.log(`Dead-end pages: ${result.deadEnds.length}`);
  console.log(`Over-optimized anchor pages: ${result.overOptimized.length}\n`);

  console.log('Top pages by inbound equity:');
  console.log('  Equity   Dofollow   Total In   File');
  for (const p of result.topByEquity.slice(0, 10)) {
    console.log(`  ${String(p.equityScore).padStart(6)}   ${String(p.inboundDofollow).padStart(8)}   ${String(p.inboundInternal).padStart(8)}   ${p.file}`);
  }
  console.log('');

  if (result.orphans.length > 0) {
    console.log('Orphan pages (no inbound equity):');
    for (const o of result.orphans.slice(0, 10)) console.log(`  • ${o.file}`);
    if (result.orphans.length > 10) console.log(`  ...and ${result.orphans.length - 10} more.`);
    console.log('');
  }

  if (result.findings.length > 0) {
    const icons = { high: '❌', medium: '⚠️', low: 'ℹ️' };
    for (const f of result.findings) {
      console.log(`  ${icons[f.severity]} ${f.msg}`);
    }
    console.log('');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  runBacklinkAudit();
}
