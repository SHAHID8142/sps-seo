#!/usr/bin/env node

/**
 * SPS SEO Lighthouse / PageSpeed Insights Wrapper
 * Version: 1.2.0
 *
 * Two modes:
 *  1. PageSpeed Insights API (default, no local install). Requires:
 *       PSI_API_KEY env var (free from Google Cloud Console)
 *     If PSI_API_KEY is missing, falls back to a graceful "skipped" result.
 *  2. Local lighthouse CLI (if installed). Spawn:
 *       npx -y lighthouse <url> --output=json --quiet --chrome-flags="--headless"
 *
 * Reports all 4 Lighthouse category scores:
 *   - Performance, Accessibility, Best Practices, SEO
 * Plus Core Web Vitals field data from CrUX (when PSI API is used).
 *
 * Output: 0-100 Lighthouse composite + per-category scores + actionable items.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const CWD = process.cwd();

const PSI_ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

export async function runLighthouse(options = {}) {
  const url = options.url || process.argv.find(a => a.startsWith('http'));
  const strategy = options.strategy || process.argv.find(a => a.startsWith('--strategy='))?.split('=')[1] || 'mobile';
  const useLocal = options.local || process.argv.includes('--local');
  const projectDir = options.cwd || CWD;

  if (!url) {
    const result = {
      timestamp: new Date().toISOString(),
      url: null,
      mode: 'skipped',
      reason: 'No URL provided. Re-run with --url https://yoursite.com (and PSI_API_KEY env var for live PSI data).',
      score: null
    };
    if (options.json || process.argv.includes('--json')) {
      console.log(JSON.stringify(result, null, 2));
      return result;
    }
    printConsole(result);
    return result;
  }

  let result;
  if (useLocal) {
    result = await runLocalLighthouse(url, strategy);
  } else if (process.env.PSI_API_KEY || options.apiKey) {
    result = await runPsiApi(url, strategy, options.apiKey || process.env.PSI_API_KEY);
  } else {
    // Fall back to local lighthouse CLI
    result = await runLocalLighthouse(url, strategy);
    if (result.mode === 'error') {
      result = {
        timestamp: new Date().toISOString(),
        url,
        mode: 'skipped',
        reason: 'PSI_API_KEY not set and local lighthouse failed. Set PSI_API_KEY for live data or `npm i -g lighthouse` + Chrome for local.',
        score: null
      };
    }
  }

  if (options.json || process.argv.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
    return result;
  }
  printConsole(result);
  return result;
}

async function runPsiApi(url, strategy, apiKey) {
  const params = new URLSearchParams({
    url,
    key: apiKey,
    strategy,
    category: 'performance,accessibility,best-practices,seo'
  });

  try {
    const res = await fetch(`${PSI_ENDPOINT}?${params}`, {
      signal: AbortSignal.timeout(30000)
    });
    if (!res.ok) {
      return {
        timestamp: new Date().toISOString(),
        url,
        mode: 'error',
        reason: `PSI API HTTP ${res.status}: ${await res.text()}`,
        score: null
      };
    }
    const data = await res.json();
    return mapPsiToResult(data, url, strategy);
  } catch (e) {
    return {
      timestamp: new Date().toISOString(),
      url,
      mode: 'error',
      reason: `PSI API unreachable: ${e.message}`,
      score: null
    };
  }
}

function mapPsiToResult(data, url, strategy) {
  const cats = data.lighthouseResult?.categories || {};
  const audits = data.lighthouseResult?.audits || {};
  const crux = data.loadingExperience?.metrics || {};

  const perf = Math.round((cats.performance?.score ?? 0) * 100);
  const a11y = Math.round((cats.accessibility?.score ?? 0) * 100);
  const bp = Math.round((cats['best-practices']?.score ?? 0) * 100);
  const seo = Math.round((cats.seo?.score ?? 0) * 100);

  // Composite: weighted (perf 30, a11y 30, bp 20, seo 20)
  const composite = Math.round(perf * 0.3 + a11y * 0.3 + bp * 0.2 + seo * 0.2);

  // Extract field CWV from CrUX
  const cwv = {
    LCP: crux.LARGEST_CONTENTFUL_PAINT_MS?.percentile ?? null,
    INP: crux.INTERACTION_TO_NEXT_PAINT?.percentile ?? null,
    CLS: crux.CUMULATIVE_LAYOUT_SHIFT?.percentile ?? null,
    FCP: crux.FIRST_CONTENTFUL_PAINT_MS?.percentile ?? null,
    TTFB: audits['server-response-time']?.numericValue ?? null,
  };

  return {
    timestamp: new Date().toISOString(),
    url,
    mode: 'psi-api',
    strategy,
    composite,
    scores: { performance: perf, accessibility: a11y, bestPractices: bp, seo },
    cwv,
    findings: extractPsiFindings(audits)
  };
}

function extractPsiFindings(audits) {
  const findings = [];
  const interesting = {
    'largest-contentful-paint': 'LCP',
    'first-contentful-paint': 'FCP',
    'cumulative-layout-shift': 'CLS',
    'total-blocking-time': 'TBT',
    'speed-index': 'Speed Index',
    'interactive': 'Time to Interactive',
    'uses-text-compression': 'Enable text compression',
    'uses-rel-preconnect': 'Use preconnect',
    'unused-css-rules': 'Reduce unused CSS',
    'unused-javascript': 'Reduce unused JavaScript',
    'render-blocking-resources': 'Eliminate render-blocking resources',
    'uses-optimized-images': 'Efficiently encode images',
    'modern-image-formats': 'Serve images in modern formats',
    'uses-responsive-images': 'Properly size images',
    'efficient-animated-content': 'Use efficient animated content',
    'color-contrast': 'Background and foreground colors have a sufficient contrast ratio',
    'image-alt': 'Image elements have [alt] attributes',
    'link-name': 'Links have a discernible name',
    'button-name': 'Buttons have a discernible name',
    'document-title': 'Document has a title element',
    'meta-description': 'Document has a meta description',
    'is-crawlable': 'Page isn\'t blocked from indexing',
    'valid-lighthouse-lang': '`[lang]` attribute is valid',
    'csp-xss': 'Mitigate XSS with strong CSP',
    'no-vulnerable-libraries': 'No vulnerable libraries detected',
    'errors-in-console': 'No browser errors logged to the console',
    'image-aspect-ratio': 'Displays images with correct aspect ratio',
    'image-size-responsive': 'Displays images that are appropriately sized',
    'font-display': 'All font-display CSS is set',
  };
  for (const [id, label] of Object.entries(interesting)) {
    const a = audits[id];
    if (!a) continue;
    if (a.score !== null && a.score < 0.9) {
      findings.push({
        id,
        label,
        score: Math.round((a.score ?? 0) * 100),
        displayValue: a.displayValue || null,
        severity: a.score < 0.5 ? 'high' : 'medium'
      });
    }
  }
  return findings;
}

async function runLocalLighthouse(url, strategy) {
  try {
    const out = path.join(CWD, '.lighthouse.json');
    const args = [
      url,
      '--output=json',
      '--output-path', out,
      '--quiet',
      '--chrome-flags="--headless --no-sandbox --disable-gpu"',
      '--only-categories=performance,accessibility,best-practices,seo',
      `--form-factor=${strategy}`,
      '--preset=desktop'
    ];
    const res = spawnSync('npx', ['-y', 'lighthouse', ...args], {
      encoding: 'utf8',
      timeout: 120000,
      env: process.env
    });
    if (res.status !== 0) {
      return {
        timestamp: new Date().toISOString(),
        url,
        mode: 'error',
        reason: `Local lighthouse failed: ${res.stderr?.slice(0, 200) || 'unknown'}`,
        score: null
      };
    }
    const data = JSON.parse(fs.readFileSync(out, 'utf8'));
    fs.unlinkSync(out);

    const cats = data.categories || {};
    const audits = data.audits || {};
    const perf = Math.round((cats.performance?.score ?? 0) * 100);
    const a11y = Math.round((cats.accessibility?.score ?? 0) * 100);
    const bp = Math.round((cats['best-practices']?.score ?? 0) * 100);
    const seo = Math.round((cats.seo?.score ?? 0) * 100);
    const composite = Math.round(perf * 0.3 + a11y * 0.3 + bp * 0.2 + seo * 0.2);

    return {
      timestamp: new Date().toISOString(),
      url,
      mode: 'local-cli',
      strategy,
      composite,
      scores: { performance: perf, accessibility: a11y, bestPractices: bp, seo },
      cwv: {
        LCP: audits['largest-contentful-paint']?.numericValue,
        FCP: audits['first-contentful-paint']?.numericValue,
        CLS: audits['cumulative-layout-shift']?.numericValue,
        TBT: audits['total-blocking-time']?.numericValue,
      },
      findings: extractPsiFindings(audits)
    };
  } catch (e) {
    return {
      timestamp: new Date().toISOString(),
      url,
      mode: 'error',
      reason: e.message,
      score: null
    };
  }
}

function printConsole(result) {
  console.log('\n====================================================');
  console.log('     SPS SEO LIGHTHOUSE / PSI REPORT                ');
  console.log('====================================================\n');
  if (result.mode === 'skipped' || result.mode === 'error') {
    console.log(`Mode: ${result.mode}`);
    if (result.url) console.log(`URL:  ${result.url}`);
    console.log(`Reason: ${result.reason}`);
    console.log('\n  To enable live measurement:');
    console.log('    1. Get a free PageSpeed Insights API key from Google Cloud Console.');
    console.log('    2. export PSI_API_KEY=...');
    console.log('    3. npm run lighthouse -- --url https://yoursite.com\n');
    return;
  }

  console.log(`URL:      ${result.url}`);
  console.log(`Mode:     ${result.mode}  Strategy: ${result.strategy}`);
  console.log(`Composite Score: ${result.composite}/100\n`);

  console.log('Lighthouse Categories:');
  console.log(`  Performance:    ${result.scores.performance}/100`);
  console.log(`  Accessibility:  ${result.scores.accessibility}/100`);
  console.log(`  Best Practices: ${result.scores.bestPractices}/100`);
  console.log(`  SEO:            ${result.scores.seo}/100`);

  console.log('\nCore Web Vitals:');
  if (result.cwv.LCP) console.log(`  LCP:  ${Math.round(result.cwv.LCP)} ms   (good: ≤ 2500)`);
  if (result.cwv.FCP) console.log(`  FCP:  ${Math.round(result.cwv.FCP)} ms   (good: ≤ 1800)`);
  if (result.cwv.CLS !== null && result.cwv.CLS !== undefined) console.log(`  CLS:  ${result.cwv.CLS.toFixed(3)}       (good: ≤ 0.1)`);
  if (result.cwv.TBT) console.log(`  TBT:  ${Math.round(result.cwv.TBT)} ms   (good: ≤ 200)`);
  if (result.cwv.INP) console.log(`  INP:  ${Math.round(result.cwv.INP)} ms   (good: ≤ 200)`);
  if (result.cwv.TTFB) console.log(`  TTFB: ${Math.round(result.cwv.TTFB)} ms`);

  if (result.findings && result.findings.length > 0) {
    console.log('\nTop Findings:');
    const top = result.findings.sort((a, b) => a.score - b.score).slice(0, 10);
    for (const f of top) {
      const icon = f.severity === 'high' ? '❌' : '⚠️';
      console.log(`  ${icon} ${f.label} (${f.score}/100)${f.displayValue ? ' — ' + f.displayValue : ''}`);
    }
    console.log('');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  runLighthouse().catch(err => {
    console.error('Lighthouse error:', err);
    process.exit(1);
  });
}
