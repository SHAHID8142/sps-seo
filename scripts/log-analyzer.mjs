#!/usr/bin/env node

/**
 * SPS SEO — Server Access-Log Analyzer
 * Version: 1.5.0
 *
 * Zero-dependency Nginx/Common/combined-format access-log analyzer for
 * crawl-budget, indexing health & attack signals:
 *  1. Status-code distribution (4xx/5xx hotspots)
 *  2. Per-URL request frequency — top crawled paths + unexpected robot hits
 *  3. "Crawl waste" heuristics: search-engine bot hits on query params,
 *     session IDs, printer pages, /wp-admin, etc.
 *  4. Unique URL cardinality vs total requests (SEO crawl budget value)
 *  5. Per-bot breakdown (Googlebot/Bingbot/ClaudeBot/OAI-SearchBot/etc.)
 *  6. SECURITY signals: brute-force bursts (401/403 per IP), path-traversal
 *     probes (../, /etc/passwd, %2e%2e), sensitive-file probes (/.env,
 *     /.git, /.aws), injection attempts (SQLi/XSS strings in query), and
 *     per-IP request-rate outliers
 *
 * Usage:
 *   npm run logs -- --file access.log [--bot-limit 20] [--json]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMain } from './lib/core.mjs';

function argValue(name, fallback) {
  const idx = process.argv.indexOf(name);
  return idx > -1 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback;
}

const CRAWL_WASTE_PATTERNS = [
  { re: /(\?|&)(utm_|fbclid|gclid|mc_cid|mc_eid|ref=|source=|si=)/i, label: 'tracking/utm params' },
  { re: /\?.*(s=search|q=|query=)/i, label: 'site-search results' },
  { re: /\/wp-admin(?:$|\/)/i, label: 'wp-admin' },
  { re: /\/cart(?:$|\/)|sessid|sessionid|PHPSESSID/i, label: 'session/cart' },
  { re: /\/print(?:$|\/)|[?]print=1/i, label: 'printer pages' },
  { re: /\/api\//i, label: 'API endpoints' },
  { re: /\/tag\/|\/category\/(?:page\/\d+)?[^/]*\/?$/i, label: 'thin archive/tag' },
  { re: /\/page\/?\d+\//i, label: 'paginated archives' }
];

// Attack-signal patterns (security dimension)
const ATTACK_PATTERNS = [
  { re: /\.\.[\/\\]|%2e%2e(%2f|%5c|\/)|\/etc\/passwd|\/etc\/shadow|win\.ini|boot\.ini/i, label: 'path traversal' },
  { re: /^\/(\/)?\.(env|git|aws|ssh|htaccess|htpasswd|npmrc|svn|hg|DS_Store)|^\/(backup|dump|db)\.(sql|zip|tar|gz)/i, label: 'sensitive file probe' },
  { re: /(\%27|'|\%22|")(\s|,|\d)*(\bunion\b|\bselect\b|\binsert\b|\bdrop\b|--|\/\*)|\bor\b\s+1\s*=\s*1|;--|\bexec\b.*\bxp_/i, label: 'SQL injection attempt' },
  { re: /<script|javascript:|\bonerror\s*=|\bonload\s*=|\balert\s*\(|%3cscript/i, label: 'XSS attempt' },
  { re: /\/wp-login\.php|\/xmlrpc\.php|\/administrator\/index\.php|\/login\.php/i, label: 'auth-endpoint probe' },
  { re: /\bphpunit\b|\b\.well-known\/security\b|\/cgi-bin\/|\bactuator\b|\/graphql\b(?!.*(introspection-off))/i, label: 'debug/service probe' }
];

function parseLine(line) {
  // Combined log format:
  // IP - - [date] "METHOD path HTTP/1.1" status bytes "referer" "user-agent"
  const re = /^(\S+) - (\S+) \[([^\]]+)\] "(\S+) (\S+) [^"]*" (\d{3}) (\S+) "([^"]*)" "([^"]*)"$/;
  const m = re.exec(line);
  if (!m) return null;
  return {
    ip: m[1],
    date: m[3],
    method: m[4],
    path: m[5],
    status: parseInt(m[6], 10),
    referer: m[8],
    userAgent: m[9]
  };
}

function classifyBot(ua) {
  const bots = [
    { name: 'Googlebot', re: /Googlebot|googlebot/i },
    { name: 'Google-Extended', re: /Google-Extended/i },
    { name: 'Bingbot/copilot', re: /bingbot|BingPreview|Microsoft-IIS\/Microsoft-AI/i },
    { name: 'ClaudeBot', re: /ClaudeBot/i },
    { name: 'anthropic-ai', re: /anthropic-ai/i },
    { name: 'OAI-SearchBot', re: /OAI-SearchBot|GPTBot|ChatGPT-User/i },
    { name: 'PerplexityBot', re: /PerplexityBot|Perplexity-User/i },
    { name: 'Common Crawl', re: /CCBot/i },
    { name: 'Bytespider', re: /Bytespider/i },
    { name: 'SemrushBot', re: /SemrushBot|semrush/i },
    { name: 'AhrefsBot', re: /AhrefsBot|Ahrefs/i },
    { name: 'Yandex', re: /YandexBot|yandex/i },
    { name: 'Baidu', re: /baiduspider/i },
    { name: 'DuckDuckBot', re: /DuckDuckBot|duckduckbot/i },
    { name: 'Screenshot/other', re: /facebookexternalhit|Twitterbot|Slackbot|Pinterestbot/i }
  ];
  for (const b of bots) if (b.re.test(ua)) return b.name;

  // Heuristic: bot keywords not caught above
  if (/bot|crawl|spider|scrape|archiver|screenshot/i.test(ua)) return 'Other-bot';
  return 'human';
}

function analyzeLog(filePath, options = {}) {
  const botLimit = parseInt(options.botLimit || argValue('--bot-limit', '20'), 10);
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    return { error: `Cannot read log file: ${e.message}` };
  }

  const lines = raw.split(/\r?\n/).filter(l => l.trim());
  const parsed = lines.map(parseLine).filter(Boolean);
  const statusCounts = {};
  const pathCounts = {};
  const botCounts = {};
  const wasteHits = [];
  const securitySignals = { attacks: [], authFailuresByIp: {}, requestsByIp: {} };
  let total = parsed.length;
  let uniquePaths = 0;

  for (const r of parsed) {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
    if (pathCounts[r.path]) pathCounts[r.path].count++;
    else { pathCounts[r.path] = { count: 1, statuses: {} }; uniquePaths++; }
    pathCounts[r.path].statuses[r.status] = (pathCounts[r.path].statuses[r.status] || 0) + 1;

    const bot = classifyBot(r.userAgent);
    botCounts[bot] = (botCounts[bot] || 0) + 1;

    // ── Security signal collection ──
    // Per-IP request volume (rate-anomaly baseline)
    securitySignals.requestsByIp[r.ip] = (securitySignals.requestsByIp[r.ip] || 0) + 1;
    // Auth-failure bursts → brute force candidates
    if (r.status === 401 || r.status === 403) {
      securitySignals.authFailuresByIp[r.ip] = (securitySignals.authFailuresByIp[r.ip] || 0) + 1;
    }
    // Explicit attack patterns in the request line
    for (const p of ATTACK_PATTERNS) {
      if (p.re.test(r.path)) {
        securitySignals.attacks.push({ ip: r.ip, path: r.path.slice(0, 120), label: p.label, status: r.status });
        break; // classify each request once
      }
    }

    for (const p of CRAWL_WASTE_PATTERNS) {
      if (p.re.test(r.path)) {
        wasteHits.push({ path: r.path, label: p.label, bot, status: r.status });
        break; // count each request once
      }
    }
  }

  // Derive security verdicts
  const totalParsed = parsed.length || 1;
  const bruteForceIps = Object.entries(securitySignals.authFailuresByIp)
    .filter(([, n]) => n >= 10)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([ip, failures]) => ({ ip, failures }));
  const rateOutlierIps = Object.entries(securitySignals.requestsByIp)
    .filter(([, n]) => n >= Math.max(200, totalParsed * 0.05))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([ip, count]) => ({ ip, count }));
  const attackSummary = securitySignals.attacks.reduce((acc, a) => {
    acc[a.label] = (acc[a.label] || 0) + 1;
    return acc;
  }, {});

  const notFound = Object.keys(statusCounts).filter(s => s === '404').reduce((s, k) => s + statusCounts[k], 0);
  const serverErrors = Object.keys(statusCounts).filter(s => parseInt(s, 10) >= 500).reduce((s, k) => s + statusCounts[k], 0);
  const redirects = Object.keys(statusCounts).filter(s => parseInt(s, 10) >= 300 && parseInt(s, 10) < 400).reduce((s, k) => s + statusCounts[k], 0);

  const topPaths = Object.entries(pathCounts).sort((a, b) => b[1].count - a[1].count).slice(0, 20).map(([path, info]) => ({ path, count: info.count, statuses: info.statuses }));
  const topBots = Object.entries(botCounts).sort((a, b) => b[1] - a[1]).slice(0, botLimit).map(([name, count]) => ({ name, count }));
  const totalBots = topBots.filter(b => b.name !== 'human').reduce((s, b) => s + b.count, 0);

  const crawlWaste = wasteHits;
  const wasteTotal = crawlWaste.length;

  return {
    source: filePath,
    totalRequests: total,
    uniquePaths,
    uniquePathRatio: total ? Math.round((uniquePaths / total) * 100) : 0,
    statusCounts,
    errors: { notFound, serverErrors, redirects },
    topPaths,
    botBreakdown: topBots,
    botSharePct: total ? Math.round((totalBots / total) * 100) : 0,
    crawlWaste: { total: wasteTotal, labelCounts: wasteHits.reduce((acc, h) => { acc[h.label] = (acc[h.label] || 0) + 1; return acc; }, {}), samples: wasteHits.slice(0, 20) },
    security: {
      attackAttempts: securitySignals.attacks.length,
      attackSummary,
      attackSamples: securitySignals.attacks.slice(0, 15),
      bruteForceSuspects: bruteForceIps,
      rateOutliers: rateOutlierIps
    }
  };
}

function runLogAnalyzer(options = {}) {
  const jsonOutput = options.json || process.argv.includes('--json');
  const filePath = options.file || argValue('--file', null);
  const report = analyzeLog(filePath, options);

  if (!filePath) {
    const err = { error: 'No log file provided. Pass --file access.log.' };
    if (jsonOutput) { console.log(JSON.stringify(err, null, 2)); return err; }
    console.error('✗ ' + err.error);
    return err;
  }

  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2));
    return report;
  }
  if (report.error) { console.error('✗ ' + report.error); return report; }

  console.log('\n====================================================');
  console.log('        SPS SEO ACCESS-LOG ANALYSIS REPORT         ');
  console.log('====================================================\n');
  console.log(`Requests: ${report.totalRequests} | Unique paths: ${report.uniquePaths} (${report.uniquePathRatio}% unique ratio)`);
  console.log(`Status codes: ${JSON.stringify(report.statusCounts)}`);
  console.log(`Errors: ${report.errors.notFound}x 404 | ${report.errors.serverErrors}x 5xx | ${report.errors.redirects}x 3xx`);
  if (report.botBreakdown.length) {
    console.log(`\nBot traffic breakdown (${report.botSharePct}% of requests):`);
    for (const b of report.botBreakdown.slice(0, 12)) {
      if (b.name !== 'human') console.log(`  ${b.name}: ${b.count}`);
    }
  }
  if (report.crawlWaste.total > 0) {
    console.log(`\n⚠️  Crawl waste: ${report.crawlWaste.total} bot/human requests to non-indexable patterns`);
    for (const [label, count] of Object.entries(report.crawlWaste.labelCounts)) {
      console.log(`  ${label}: ${count}`);
    }
  }
  // ── Security signals ──
  if (report.security.attackAttempts > 0) {
    console.log(`\n🚨 Attack signals: ${report.security.attackAttempts} suspicious request(s)`);
    for (const [label, count] of Object.entries(report.security.attackSummary)) {
      console.log(`  ${label}: ${count}`);
    }
    for (const s of report.security.attackSamples.slice(0, 5)) {
      console.log(`  └─ ${s.ip} → ${s.path} [${s.status}]`);
    }
  }
  if (report.security.bruteForceSuspects.length > 0) {
    console.log(`\n🚨 Brute-force suspects (≥10 auth failures):`);
    for (const s of report.security.bruteForceSuspects) {
      console.log(`  ${s.ip}: ${s.failures} failed auth requests → block at WAF/firewall`);
    }
  }
  if (report.security.rateOutliers.length > 0) {
    console.log(`\n⚠️  Rate outliers (≥5% of traffic or 200+ requests from one IP):`);
    for (const s of report.security.rateOutliers) {
      console.log(`  ${s.ip}: ${s.count} requests`);
    }
  }
  if (report.security.attackAttempts === 0 && report.security.bruteForceSuspects.length === 0 && report.security.rateOutliers.length === 0) {
    console.log('\n✓ No attack signals, brute-force bursts, or rate anomalies detected.');
  }
  console.log('\nActions: fix top 404 paths, block crawl-waste patterns via robots.txt, verify indexable templates in `npm run redirect`.\n');
  return report;
}

if (isMain(import.meta.url)) {
  runLogAnalyzer();
}