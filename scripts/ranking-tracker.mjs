#!/usr/bin/env node

/**
 * SPS SEO Ranking Tracker (Search Console + Provider Adapters)
 * Version: 1.3.0
 *
 * Three modes:
 *  1. GSC API mode — uses Google Search Console API. Requires:
 *       GOOGLE_APPLICATION_CREDENTIALS env var pointing to a service-account JSON
 *       OR GSC_API_KEY (limited; for legacy endpoints only)
 *     siteUrl from sps-seo-config.json's site.url
 *
 *  2. Manual CSV mode — `npm run ranking -- --csv` reads `ranking-input.csv`
 *     with columns: query, url, position, impressions, clicks, date
 *
 *  3. Provider stub mode — placeholder for Ahrefs / Semrush / Serpapi
 *     adapters (not implemented by default; user fills in their API key)
 *
 * Output: 0-100 ranking momentum score + distribution view.
 */

import fs from 'node:fs';
import path from 'node:path';

const CWD = process.cwd();

export async function runRankingTracker(options = {}) {
  const csvMode = options.csv || process.argv.includes('--csv');
  const gscMode = !!process.env.GOOGLE_APPLICATION_CREDENTIALS || !!process.env.GSC_API_KEY;

  if (csvMode) {
    return await runFromCsv(options);
  }
  if (gscMode) {
    return await runFromGsc(options);
  }

  // Default: provider stub
  return runStubMode(options);
}

async function runFromCsv(options) {
  const csvPath = path.join(CWD, 'ranking-input.csv');
  if (!fs.existsSync(csvPath)) {
    console.log('\n====================================================');
    console.log('     SPS SEO RANKING TRACKER (CSV mode)             ');
    console.log('====================================================\n');
    console.log(`  No CSV found at ${csvPath}.`);
    console.log('  Expected format (header row required):');
    console.log('    query,url,position,impressions,clicks,date');
    console.log('  Example:');
    console.log('    "best cloud platform",https://acme.com/,4.2,1240,38,2026-08-15');
    console.log('\n  Alternatively, set GOOGLE_APPLICATION_CREDENTIALS to use the GSC API,');
    console.log('  or implement a provider adapter for Ahrefs/Semrush/Serpapi.\n');
    const result = { mode: 'skipped', reason: 'No CSV or GSC credentials configured.' };
    if (options.json || process.argv.includes('--json')) {
      console.log(JSON.stringify(result, null, 2));
      return result;
    }
    return result;
  }

  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    if (cells.length < headers.length) continue;
    const rec = {};
    headers.forEach((h, idx) => rec[h.trim()] = cells[idx]);
    rec.position = parseFloat(rec.position);
    rec.impressions = parseInt(rec.impressions, 10) || 0;
    rec.clicks = parseInt(rec.clicks, 10) || 0;
    rows.push(rec);
  }

  const summary = aggregateRows(rows);
  printSummary(summary, 'csv');
  if (options.json || process.argv.includes('--json')) {
    console.log(JSON.stringify(summary, null, 2));
  }
  return summary;
}

async function runFromGsc(options) {
  // Placeholder: real implementation would call
  // searchconsole.googleapis.com/webmasters/v3/sites/{siteUrl}/searchAnalytics/query
  // with OAuth2 service-account auth.
  console.log('\n====================================================');
  console.log('     SPS SEO RANKING TRACKER (GSC mode)             ');
  console.log('====================================================\n');
  console.log('  GSC API mode is scaffolded but requires per-project OAuth setup.');
  console.log('  Use CSV mode (npm run ranking -- --csv) for an immediate workflow,');
  console.log('  or implement the GSC adapter for your service-account credentials.\n');

  const result = {
    mode: 'gsc-stub',
    reason: 'GSC adapter not implemented in this release. Use --csv mode or wire up your service account.',
    nextSteps: [
      '1. Create a Google Cloud service account with Search Console API access.',
      '2. Share your GSC property with the service-account email.',
      '3. Set GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json',
      '4. Implement the searchAnalytics.query call (see references/gsc-api.md).'
    ]
  };
  if (options.json || process.argv.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
    return result;
  }
  for (const s of result.nextSteps) console.log(`  ${s}`);
  console.log('');
  return result;
}

function runStubMode(options) {
  const result = {
    mode: 'skipped',
    reason: 'No data source configured. Use --csv or set GSC credentials.'
  };
  console.log('\n====================================================');
  console.log('     SPS SEO RANKING TRACKER                         ');
  console.log('====================================================\n');
  console.log('  No data source configured.\n');
  console.log('  Options:');
  console.log('    --csv                  Read from ./ranking-input.csv (immediate)');
  console.log('    GOOGLE_APPLICATION_CREDENTIALS=...   Use Search Console API');
  console.log('    Implement provider adapter (Ahrefs, Semrush, Serpapi)');
  console.log('\n  See guides/ranking-guide.md for the full workflow.\n');
  return result;
}

function parseCsvLine(line) {
  // Minimal CSV parser supporting quoted fields with embedded commas
  const out = [];
  let buf = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"' && line[i + 1] === '"' && inQuote) {
      buf += '"'; i++;
    } else if (c === '"') {
      inQuote = !inQuote;
    } else if (c === ',' && !inQuote) {
      out.push(buf); buf = '';
    } else {
      buf += c;
    }
  }
  out.push(buf);
  return out;
}

function aggregateRows(rows) {
  // Group by query, take latest
  const byQuery = new Map();
  for (const r of rows) {
    const key = `${r.query}|${r.url}`;
    const existing = byQuery.get(key);
    if (!existing || (r.date && existing.date && r.date > existing.date)) {
      byQuery.set(key, r);
    }
  }
  const latest = Array.from(byQuery.values());

  // Distribution buckets
  const dist = { top3: 0, top10: 0, top20: 0, top50: 0, beyond50: 0, noRank: 0 };
  for (const r of latest) {
    if (r.position > 50 || r.position === 0) dist.beyond50++;
    else if (r.position > 20) dist.top50++;
    else if (r.position > 10) dist.top20++;
    else if (r.position > 3) dist.top10++;
    else dist.top3++;
  }

  // Momentum: compare latest snapshot to the median of the prior 3 (if available)
  // Simplified here — if user provides multiple dates per query, we can compute trend.
  let momentum = 'unknown';
  const trendable = rows.length > latest.length; // multiple dates exist
  if (trendable) {
    // For each query, split into latest vs prior
    const prior = [];
    for (const r of rows) {
      const key = `${r.query}|${r.url}`;
      const cur = byQuery.get(key);
      if (cur && r !== cur) prior.push(r);
    }
    // Average position latest vs prior
    const avgPos = arr => arr.reduce((s, r) => s + r.position, 0) / (arr.length || 1);
    const delta = avgPos(latest) - avgPos(prior);
    momentum = delta < -0.5 ? 'improving' : delta > 0.5 ? 'declining' : 'stable';
  }

  // Score: weighted by visibility
  // Simple: top3 weight 100, top10 weight 70, top20 weight 40, top50 weight 20, beyond50 weight 0
  const totalWeight = dist.top3 * 100 + dist.top10 * 70 + dist.top20 * 40 + dist.top50 * 20;
  const score = latest.length > 0 ? Math.round(totalWeight / latest.length) : 0;

  return {
    mode: 'csv',
    queriesTracked: new Set(latest.map(r => r.query)).size,
    urlsTracked: new Set(latest.map(r => r.url)).size,
    rowsAnalyzed: rows.length,
    distribution: dist,
    momentum,
    score,
    topQueries: latest
      .sort((a, b) => a.position - b.position)
      .slice(0, 10)
      .map(r => ({ query: r.query, url: r.url, position: r.position, clicks: r.clicks, impressions: r.impressions }))
  };
}

function printSummary(summary, mode) {
  console.log('\n====================================================');
  console.log(`     SPS SEO RANKING TRACKER (${mode} mode)             `);
  console.log('====================================================\n');
  console.log(`Queries tracked: ${summary.queriesTracked}`);
  console.log(`URLs tracked:    ${summary.urlsTracked}`);
  console.log(`Rows analyzed:   ${summary.rowsAnalyzed}`);
  console.log(`Momentum:        ${summary.momentum}`);
  console.log(`Visibility score: ${summary.score}/100\n`);

  console.log('SERP position distribution:');
  console.log(`  Top 3:    ${summary.distribution.top3}`);
  console.log(`  Top 10:   ${summary.distribution.top10}`);
  console.log(`  Top 20:   ${summary.distribution.top20}`);
  console.log(`  Top 50:   ${summary.distribution.top50}`);
  console.log(`  Beyond 50: ${summary.distribution.beyond50}\n`);

  if (summary.topQueries && summary.topQueries.length > 0) {
    console.log('Top queries:');
    console.log('  Pos   Clicks   Impressions   Query   URL');
    for (const q of summary.topQueries) {
      console.log(`  ${String(q.position).padStart(3)}   ${String(q.clicks).padStart(6)}   ${String(q.impressions).padStart(8)}     ${q.query}   ${q.url}`);
    }
    console.log('');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  runRankingTracker().catch(err => {
    console.error('Ranking tracker error:', err);
    process.exit(1);
  });
}
