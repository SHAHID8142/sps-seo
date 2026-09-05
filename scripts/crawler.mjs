#!/usr/bin/env node

/**
 * SPS SEO — Polite Live-Site Crawler
 * Version: 1.4.0
 *
 * Zero-dependency live crawler for deployed sites:
 *  1. robots.txt-aware (fetches and honors Disallow rules for *)
 *  2. Rate-limited & concurrent-capped (polite crawling)
 *  3. Per-URL: HTTP status, TTFB, content-type, title/canonical/meta,
 *     redirect chain, and soft-404 detection
 *  4. Client-side rendering heuristic (SPA risk score)
 *
 * Usage:
 *   npm run crawl -- --url https://example.com [--depth 2] [--limit 200]
 *                  [--delay 300] [--concurrency 4] [--json]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMain, loadConfig } from './lib/core.mjs';

const CWD = process.cwd();
const UA = 'SPS-SEO-Bot/1.4 (+https://github.com/sps-seo; polite crawler)';

function argValue(name, fallback) {
  const idx = process.argv.indexOf(name);
  return idx > -1 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback;
}

function normalizeUrl(raw, base) {
  try {
    return base ? new URL(raw, base).toString() : new URL(raw).toString();
  } catch {
    return null;
  }
}

function looksIndexable(pathname) {
  if (/\.(png|jpe?g|gif|svg|webp|ico|css|js|woff2?|ttf|mp4|webm|pdf|zip|gz)$/i.test(pathname)) return false;
  return true;
}

function parseRobotsDisallow(raw, baseUrl) {
  const disallowed = [];
  const blocks = raw.split(/User-agent\s*:\s*/i).slice(1);
  for (const block of blocks) {
    const lines = block.split(/\r?\n/);
    const token = lines.shift().trim();
    if (token !== '*') continue;
    for (const line of lines) {
      const m = /^Disallow\s*:\s*(\S*)\s*$/i.exec(line);
      if (m && m[1]) disallowed.push(m[1]);
    }
    break; // only the universal block governs our default bot
  }
  return disallowed;
}

function isAllowedByRobots(pathname, disallowed) {
  return !disallowed.some(pattern => {
    if (pattern.endsWith('*')) return pathname.startsWith(pattern.slice(0, -1));
    return pathname.startsWith(pattern);
  });
}

export async function runCrawler(options = {}) {
  const jsonOutput = options.json || process.argv.includes('--json');
  const { config } = loadConfig(CWD);
  const baseUrl = normalizeUrl(options.url || argValue('--url', null) || config?.site?.url, null);

  if (!baseUrl) {
    const err = 'No URL provided. Pass --url https://example.com or set site.url in sps-seo-config.json.';
    if (jsonOutput) console.log(JSON.stringify({ success: false, error: err }, null, 2));
    else console.error(`✗ ${err}`);
    return { success: false, error: err };
  }

  const maxDepth = parseInt(argValue('--depth', options.depth || '2'), 10);
  const limit = parseInt(argValue('--limit', options.limit || '200'), 10);
  const delayMs = parseInt(argValue('--delay', options.delay || '300'), 10);
  const concurrency = parseInt(argValue('--concurrency', options.concurrency || '4'), 10);
  const origin = new URL(baseUrl).origin;

  let disallowed = [];
  try {
    const robotsRes = await fetch(new URL('/robots.txt', baseUrl), { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(10000) });
    if (robotsRes.ok) disallowed = parseRobotsDisallow(await robotsRes.text(), baseUrl);
  } catch { /* no robots.txt */ }

  const visited = new Set();
  const queue = [{ url: baseUrl, depth: 0 }];
  const results = [];
  const redirectChains = [];
  let active = 0;
  let hardErrors = 0;

async function processPage({ url, depth }) {
    const record = { url, depth, status: null, ttfbMs: null, contentType: null, title: null, canonical: null, metaDescription: null, redirectChain: [], spaRisk: false, soft404: false };
    const pathname = new URL(url).pathname;
    if (!isAllowedByRobots(pathname, disallowed)) {
      record.status = 'robots-disallowed';
      results.push(record);
      return;
    }
    if (!looksIndexable(pathname)) { record.status = 'skipped-asset'; results.push(record); return; }

    const started = Date.now();
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': UA, 'accept': 'text/html,application/xhtml+xml' },
        redirect: 'manual',
        signal: AbortSignal.timeout(15000)
      });
      record.ttfbMs = Date.now() - started;
      record.status = res.status;
      record.contentType = res.headers.get('content-type') || '';

      let hop = res;
      let hops = 0;
      while (hop.status >= 300 && hop.status < 400 && hop.headers.get('location')) {
        hops++;
        if (hops > 5) break;
        const next = normalizeUrl(hop.headers.get('location'), url);
        record.redirectChain.push({ from: url, to: next, status: hop.status });
        if (next && !visited.has(next)) { url = next; visited.add(next); }
        else break;
        hop = await fetch(url, { headers: { 'user-agent': UA }, redirect: 'manual', signal: AbortSignal.timeout(15000) });
        record.status = hop.status;
      }
      if (hop.status >= 300 && hop.status < 400 && hops <= 5) {
        redirectChains.push({ url, chain: record.redirectChain });
        results.push(record);
        return;
      }

      const ctype = (hop.headers.get('content-type') || '').toLowerCase();
      record.contentType = ctype;
      if (!ctype.includes('html') || hop.status > 399) {
        record.status = hop.status;
        results.push(record);
        return;
      }

      const html = await hop.text();
      record.title = (/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html) || [])[1]?.trim?.() || null;
      record.canonical = (/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i.exec(html) || [])[1] ||
                         (/<link\s+href=["']([^"']+)["']\s+rel=["']canonical["']/i.exec(html) || [])[1] || null;
      record.metaDescription = (/<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']/i.exec(html) || [])[1] || null;

      const bodyText = html.replace(/<script\b[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').toLowerCase();
      const notFoundSignals = ['page not found', '404', 'does not exist', 'no longer available', 'error 404', 'not found'];
      const signalHits = notFoundSignals.filter(s => bodyText.includes(s));
      const titleHits = /404|not found/i.test(record.title || '');
      if ((signalHits.length >= 2 || titleHits) && record.status === 200) {
        record.soft404 = true;
        record.notFoundSignals = signalHits.slice(0, 5);
      }

      const rootDivs = (html.match(/<div\b[^>]*id=["'](?:root|app|__next)["']/gi) || []).length;
      const scripts = (html.match(/<script\b/gi) || []).length;
      const textLen = bodyText.replace(/\s+/g, ' ').trim().length;
      if (rootDivs >= 1 && scripts >= 2 && textLen < 300) {
        record.spaRisk = true;
      }

      if (depth < maxDepth) {
        const linkRegex = /<a\b[^>]*href=["']([^"']+)["']/gi;
        let m;
        const outbound = [];
        while ((m = linkRegex.exec(html)) !== null) {
          const href = m[1];
          if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) continue;
          const abs = normalizeUrl(href, url);
          if (!abs || new URL(abs).origin !== origin) continue;
          if (visited.has(abs)) continue;
          outbound.push(abs);
        }
        for (const u of [...new Set(outbound)].slice(0, 50)) {
          visited.add(u);
          queue.push({ url: u, depth: depth + 1 });
        }
      }

      results.push(record);
    } catch {
      record.status = 'error';
      hardErrors++;
      results.push(record);
    }
  }

visited.add(baseUrl);
  while (queue.length > 0 && results.length < limit) {
    while (active < concurrency && queue.length > 0) {
      const item = queue.shift();
      active++;
      processPage(item).finally(() => { active--; });
    }
    await new Promise(r => setTimeout(r, delayMs));
  }
  // Drain in-flight requests before aggregating
  while (active > 0) {
    await new Promise(r => setTimeout(r, 50));
  }

  const statusCounts = {};
  for (const r of results) statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
  const soft404s = results.filter(r => r.soft404);
  const spaRisks = results.filter(r => r.spaRisk);
  const titleMissing = results.filter(r => r.status === 200 && !r.title);
  const measured = results.filter(r => typeof r.ttfbMs === 'number');
  const avgTtfb = measured.reduce((s, r) => s + r.ttfbMs, 0) / Math.max(1, measured.length);

  const report = {
    timestamp: new Date().toISOString(),
    baseUrl,
    crawled: results.length,
    hardErrors,
    robotsRules: disallowed,
    statusCounts,
    avgTtfbMs: Math.round(avgTtfb),
    soft404Pages: soft404s.map(r => ({ url: r.url, signals: r.notFoundSignals })),
    spaRiskPages: spaRisks.map(r => r.url),
    missingTitlePages: titleMissing.map(r => r.url),
    redirectChains,
    pages: results
  };

  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2));
    return report;
  }

  console.log('\n====================================================');
  console.log('          SPS SEO LIVE CRAWL REPORT                 ');
  console.log('====================================================\n');
  console.log(`Base URL:      ${baseUrl}`);
  console.log(`Crawled:       ${report.crawled} URLs (errors: ${hardErrors}) | Avg TTFB: ${report.avgTtfbMs}ms`);
  console.log(`Status codes:  ${JSON.stringify(statusCounts)}`);
  if (soft404s.length) console.log(`⚠️  Soft 404s (${soft404s.length}):`, soft404s.map(r => r.url).join(', '));
  if (spaRisks.length) console.log(`⚠️  SPA risk (${spaRisks.length}):`, spaRisks.map(r => r.url).join(', '));
  if (titleMissing.length) console.log(`✗ Pages without <title> (${titleMissing.length}):`, titleMissing.map(r => r.url).join(', '));
  if (redirectChains.length) console.log(`Redirect chains (${redirectChains.length}) — inspect via 'npm run redirect'.`);
  if (hardErrors === 0 && soft404s.length === 0 && spaRisks.length === 0) console.log('  ✓ No critical live-site issues detected.');
  console.log('');
  return report;
}

if (isMain(import.meta.url)) {
  runCrawler().catch(err => {
    console.error('Crawler error:', err);
    process.exit(1);
  });
}