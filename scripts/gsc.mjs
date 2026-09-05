#!/usr/bin/env node

/**
 * SPS SEO — Google Search Console Analytics
 * Version: 1.4.0
 *
 * Zero-dependency GSC reporting (two modes):
 *  1. CSV mode (--csv file.csv): parses a Search Console "Search results"
 *     export (queries/clicks/impressions/ctr/position) into an SEO summary.
 *  2. API mode (--credentials service-account.json [--site https://x/] [--start]
 *     [--end]): full Service Account OAuth2 JWT flow (RS256 via node:crypto)
 *     then queries the Search Console searchAnalytics:query API for page-level
 *     clicks/impressions/ctr/position — no external auth dependencies.
 *
 * Usage:
 *   npm run gsc -- --csv exports/searchconsole.csv
 *   npm run gsc -- --credentials gsc-sa.json --site sc-domain:example.com
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { isMain } from './lib/core.mjs';

function argValue(name, fallback) {
  const idx = process.argv.indexOf(name);
  return idx > -1 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback;
}

function parseCsvLine(line) {
  const cells = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { cells.push(cur); cur = ''; }
    else cur += ch;
  }
  cells.push(cur);
  return cells.map(c => c.trim());
}

function analyzeCsvRows(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { error: 'CSV has no data rows.' };

  const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase());
  const col = {};
  for (const [i, h] of headers.entries()) {
    if (/query|clicks|impressions|ctr|position/.test(h)) col[h] = i;
  }
  if (col.query === undefined || col.clicks === undefined || col.impressions === undefined) {
    return { error: 'CSV must contain columns: Query, Clicks, Impressions, CTR, Position (GSC export).' };
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const c = parseCsvLine(lines[i]);
    if (c.length < headers.length) continue;
    const clicks = parseFloat(c[col.clicks] || '0');
    const impressions = parseFloat(c[col.impressions] || '0');
    const ctr = c[col.ctr] !== undefined ? parseFloat(String(c[col.ctr]).replace('%', '')) : (impressions ? (clicks / impressions) * 100 : 0);
    const position = col.position !== undefined ? parseFloat(c[col.position] || '999') : null;
    rows.push({ query: c[col.query], clicks, impressions, ctr, position });
  }

  const totalClicks = rows.reduce((s, r) => s + r.clicks, 0);
  const totalImpr = rows.reduce((s, r) => s + r.impressions, 0);
  const avgPos = rows.filter(r => r.position).reduce((s, r) => s + r.position, 0) / Math.max(1, rows.filter(r => r.position).length);
  const sortedByClicks = [...rows].sort((a, b) => b.clicks - a.clicks).slice(0, 20);
  const sortedByImpr = [...rows].sort((a, b) => b.impressions - a.impressions).slice(0, 20);
  const zeroClicksImpr = rows.filter(r => r.clicks === 0 && r.impressions > 0).length;

  return {
    source: 'csv',
    totalRows: rows.length,
    totalClicks,
    totalImpressions: totalImpr,
    averageCtrPct: totalImpr ? Math.round((totalClicks / totalImpr) * 10000) / 100 : 0,
    averagePosition: Math.round(avgPos * 100) / 100,
    topByClicks: sortedByClicks,
    topByImpressions: sortedByImpr,
    impressionsWithZeroClicks: { count: zeroClicksImpr, note: 'Impression-rich, click-poor queries = title/description relevance gap.' }
  };
}

function base64Url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

async function getAccessToken(credentials) {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600;
  const header = base64Url({ alg: 'RS256', typ: 'JWT' });
  const claims = base64Url({
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat,
    exp
  });
  const signingInput = `${header}.${claims}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signingInput);
  const signature = signer.sign(credentials.private_key, 'base64url');
  const jwt = `${signingInput}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    }),
    signal: AbortSignal.timeout(30000)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`OAuth token error ${res.status}: ${data.error_description || data.error}`); ;
  return data.access_token;
}

async function querySearchAnalytics(token, site, startDate, endDate) {
  const endpoint = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'authorization': `Bearer ${token}` },
    body: JSON.stringify({ startDate, endDate, dimensions: ['page'], rowLimit: 1000 }),
    signal: AbortSignal.timeout(60000)
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Search Analytics error ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  const rows = (data.rows || []).map(r => ({
    page: r.keys && r.keys[0],
    clicks: r.clicks,
    impressions: r.impressions,
    ctrPct: Math.round(r.ctr * 10000) / 100,
    position: Math.round(r.position * 100) / 100
  }));
  const totalClicks = rows.reduce((s, r) => s + r.clicks, 0);
  const totalImpr = rows.reduce((s, r) => s + r.impressions, 0);
  return {
    source: 'api',
    site,
    period: { startDate, endDate },
    rows,
    totalClicks,
    totalImpressions: totalImpr,
    averageCtrPct: totalImpr ? Math.round((totalClicks / totalImpr) * 10000) / 100 : 0,
    topByClicks: [...rows].sort((a, b) => b.clicks - a.clicks).slice(0, 20)
  };
}

async function runGsc(options = {}) {
  const jsonOutput = options.json || process.argv.includes('--json');
  const csvPath = options.csv || argValue('--csv', null);
  const credsPath = options.credentials || argValue('--credentials', null);

  let report;
  if (csvPath) {
    report = analyzeCsvRows(csvPath);
  } else if (credsPath) {
    let credentials;
    try {
      credentials = JSON.parse(fs.readFileSync(path.resolve(credsPath), 'utf8'));
    } catch (e) {
      report = { error: `Cannot read credentials file: ${e.message}` };
      if (jsonOutput) { console.log(JSON.stringify(report, null, 2)); return report; }
      console.error(`✗ ${report.error}`);
      return report;
    }
    try {
      const site = argValue('--site', options.site) || credentials.site || null;
      const endDate = argValue('--end', options.end) || new Date().toISOString().split('T')[0];
      const startDate = argValue('--start', options.start) || new Date(Date.now() - 28 * 86400000).toISOString().split('T')[0];
      const token = await getAccessToken(credentials);
      report = await querySearchAnalytics(token, site, startDate, endDate);
    } catch (e) {
      report = { error: e.message };
    }
  } else {
    report = { error: 'Specify --csv <file> or --credentials <service-account.json>. See --site/--start/--end for API mode.' };
  }

  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2));
    return report;
  }

  if (report.error) {
    console.error(`✗ ${report.error}`);
    return report;
  }

  console.log('\n====================================================');
  console.log('        SPS SEO GOOGLE SEARCH CONSOLE REPORT        ');
  console.log('====================================================\n');
  if (report.source === 'csv') {
    console.log(`Source: GSC export (${report.totalRows} queries)`);
  } else {
    console.log(`Source: Search Analytics API | ${report.site} | ${report.period.startDate} → ${report.period.endDate}`);
  }
  console.log(`Clicks: ${report.totalClicks} | Impressions: ${report.totalImpressions} | Avg CTR: ${report.averageCtrPct}% | Avg Position: ${report.averagePosition ?? 'n/a'}`);
  console.log(`Top pages/queries by clicks:`);
  for (const row of (report.topByClicks || []).slice(0, 10)) {
    console.log(`  ${row.page || row.query} — ${row.clicks} clicks / ${row.impressions} impr / pos ${row.position ?? '?'}`);
  }
  if (report.impressionsWithZeroClicks?.count) {
    console.log(`\n⚠️  ${report.impressionsWithZeroClicks.count} queries have impressions but 0 clicks — ${report.impressionsWithZeroClicks.note}`);
  }
  console.log('\nPrioritize: fix titles/descriptions for zero-click impression-rich queries, then use `npm run keyword` on the winning queries.\n');
  return report;
}

if (isMain(import.meta.url)) {
  runGsc().catch(err => {
    console.error('GSC analysis error:', err);
    process.exit(1);
  });
}