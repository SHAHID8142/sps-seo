#!/usr/bin/env node

/**
 * SPS SEO — PageSpeed Insights & CrUX Integration
 * Version: 1.4.0
 *
 * Zero-dependency field/lab Core Web Vitals intelligence:
 *  1. PageSpeed Insights API v5 — lab scores (performance, a11y, best-practices,
 *     SEO) + lab LCP/INP/TBT/CLS from a Lighthouse run per URL.
 *  2. Chrome UX Report (CrUX) History API — real-user field data: p75 LCP, INP,
 *     CLS, TTFB over 25 monthly buckets per origin.
 *
 * Auth: optional API key via --key, config `technical.pagespeedApiKey`,
 * or env PSI_API_KEY. PSI also runs without a key at reduced rate limits.
 *
 * Usage:
 *   npm run pagespeed -- --url https://example.com [--key YOUR_API_KEY] [--json]
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMain, loadConfig } from './lib/core.mjs';

function argValue(name, fallback) {
  const idx = process.argv.indexOf(name);
  return idx > -1 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback;
}

function gradeThresholds(p75, good, needsImprovement) {
  if (p75 === null) return { value: null, verdict: 'no-data' };
  if (p75 <= good) return { value: p75, verdict: 'good' };
  if (p75 <= needsImprovement) return { value: p75, verdict: 'needs-improvement' };
  return { value: p75, verdict: 'poor' };
}

async function runPagespeedAndCrUX(options = {}) {
  const jsonOutput = options.json || process.argv.includes('--json');
  const { config } = loadConfig(process.cwd());
  const url = options.url || argValue('--url', null) || config?.site?.url;
  const apiKey = options.key || argValue('--key', null) || config?.technical?.pagespeedApiKey || process.env.PSI_API_KEY || '';

  if (!url) {
    const err = 'No URL provided. Pass --url https://example.com or set site.url in sps-seo-config.json.';
    if (jsonOutput) console.log(JSON.stringify({ success: false, error: err }, null, 2));
    else console.error(`✗ ${err}`);
    return { success: false, error: err };
  }

  const report = { timestamp: new Date().toISOString(), url, origin: new URL(url).origin, lab: null, field: null };

  // 1. PageSpeed Insights (lab)
  try {
    const apiUrl = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
    apiUrl.searchParams.set('url', url);
    apiUrl.searchParams.set('strategy', 'mobile');
    if (apiKey) apiUrl.searchParams.set('key', apiKey);
    const res = await fetch(apiUrl, { signal: AbortSignal.timeout(60000) });
    if (res.ok) {
      const data = await res.json();
      const lhr = data.lighthouseResult || {};
      const cats = lhr.categories || {};
      const audits = lhr.audits || {};
      const scoreOf = (k) => cats[k]?.score !== undefined && cats[k].score !== null ? Math.round(cats[k].score * 100) : null;
      report.lab = {
        categories: {
          performance: scoreOf('performance'),
          accessibility: scoreOf('accessibility'),
          'best-practices': scoreOf('best-practices'),
          seo: scoreOf('seo')
        },
        metrics: {
          largestContentfulPaintMs: audits['largest-contentful-paint']?.displayValue?.replace(/[^0-9.]/g, '') ? parseFloat(audits['largest-contentful-paint'].displayValue.replace(/[^0-9.]/g, '')) : null,
          totalBlockingTimeMs: audits['total-blocking-time']?.displayValue?.replace(/[^0-9.]/g, '') ? parseFloat(audits['total-blocking-time'].displayValue.replace(/[^0-9.]/g, '')) : null,
          cumulativeLayoutShift: audits['cumulative-layout-shift']?.displayValue ? parseFloat(audits['cumulative-layout-shift'].displayValue) : null,
          interactiveMs: audits['interactive']?.displayValue?.replace(/[^0-9.]/g, '') ? parseFloat(audits['interactive'].displayValue.replace(/[^0-9.]/g, '')) : null,
          serverResponseTimeMs: audits['server-response-time']?.displayValue?.replace(/[^0-9.]/g, '') ? parseFloat(audits['server-response-time'].displayValue.replace(/[^0-9.]/g, '')) : null
        }
      };
      // New: Interaction to Next Paint (INP) in modern LH
      const inp = audits['interaction-to-next-paint'];
      if (inp?.displayValue) report.lab.metrics.interactionToNextPaintMs = parseFloat(inp.displayValue.replace(/[^0-9.]/g, ''));
    } else {
      report.lab = { error: `PSI HTTP ${res.status}: ${(await res.text()).slice(0, 200)}` };
    }
  } catch (e) {
    report.lab = { error: e.message };
  }

// 2. CrUX History (field data — real-user Core Web Vitals)
  if (apiKey) {
    try {
      const cruxUrl = new URL('https://chromeuxreport.googleapis.com/v1/records:queryHistoryRecord');
      cruxUrl.searchParams.set('key', apiKey);
      const res = await fetch(cruxUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ formFactor: 'PHONE', origin: report.origin }),
        signal: AbortSignal.timeout(60000)
      });
      if (res.ok) {
        const data = await res.json();
        const records = data.record?.metrics || {};
        const mapMetric = (metric) => {
          const h = records[metric];
          if (!h) return null;
          const p75 = h.percentiles?.p75 !== undefined && h.percentiles.p75 !== null ? Math.round(h.percentiles.p75 * 100) / 100 : null;
          const history = (h.history || []).map(entry => {
            const v = entry.percentiles?.p75;
            return v !== undefined && v !== null ? Math.round(v * 100) / 100 : null;
          });
          return { p75, history };
        };
        report.field = {
          collectionPeriod: data.record?.collectionPeriod ? `${data.record.collectionPeriod.firstDay} → ${data.record.collectionPeriod.lastDay}` : null,
          interactionToNextPaintMs: mapMetric('interaction_to_next_paint'),
          largestContentfulPaintMs: mapMetric('largest_contentful_paint'),
          cumulativeLayoutShift: mapMetric('cumulative_layout_shift'),
          timeToFirstByteMs: mapMetric('experimental_time_to_first_byte'),
          key: Boolean(apiKey)
        };
        // Verdicts against formal CWV thresholds (INP ≤200 good, LCP ≤2.5s, CLS ≤0.1, TTFB ≤0.8s)
        report.field.verdicts = {
          inp: gradeThresholds(report.field.interactionToNextPaintMs?.p75 ?? null, 200, 500),
          lcp: gradeThresholds(report.field.largestContentfulPaintMs?.p75 ?? null, 2500, 4000),
          cls: gradeThresholds(report.field.cumulativeLayoutShift?.p75 ?? null, 0.1, 0.25),
          ttfb: gradeThresholds(report.field.timeToFirstByteMs?.p75 ?? null, 800, 1800)
        };
      } else {
        report.field = { error: `CrUX HTTP ${res.status}: ${(await res.text()).slice(0, 200)}` };
      }
    } catch (e) {
      report.field = { error: e.message };
    }
  } else {
    report.field = { note: 'API key required for CrUX field data. Pass --key, set technical.pagespeedApiKey, or export PSI_API_KEY' };
  }

if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2));
    return report;
  }

  console.log('\n====================================================');
  console.log('   SPS SEO CORE WEB VITALS (LAB + FIELD) REPORT     ');
  console.log('====================================================\n');
  console.log(`URL:  ${url}`);
  if (report.lab?.categories) {
    const c = report.lab.categories;
    console.log('Lab (Lighthouse mobile):');
    console.log(`  Performance: ${c.performance ?? 'n/a'} | A11y: ${c.accessibility ?? 'n/a'} | Best-Practices: ${c['best-practices'] ?? 'n/a'} | SEO: ${c.seo ?? 'n/a'}`);
    const m = report.lab.metrics;
    console.log(`  ${m.largestContentfulPaintMs ? 'LCP ' + m.largestContentfulPaintMs + 'ms' : ''} ${m.interactionToNextPaintMs ? '| INP ' + m.interactionToNextPaintMs + 'ms' : ''} ${m.totalBlockingTimeMs ? '| TBT ' + m.totalBlockingTimeMs + 'ms' : ''} ${m.cumulativeLayoutShift !== null && m.cumulativeLayoutShift !== undefined ? '| CLS ' + m.cumulativeLayoutShift : ''}`);
  } else if (report.lab?.error) {
    console.log(`Lab: PSI unavailable — ${report.lab.error}`);
  }
  if (report.field?.verdicts) {
    console.log('\nField (CrUX real-user, p75):');
    for (const [k, v] of Object.entries(report.field.verdicts)) {
      const icon = v.verdict === 'good' ? '✅' : v.verdict === 'needs-improvement' ? '⚠️' : v.verdict === 'poor' ? '❌' : '○';
      console.log(`  ${icon} ${k.toUpperCase()}: ${v.value ?? 'no-data'} (${v.verdict})`);
    }
    const trend = (arr) => arr?.filter(x => x !== null).length ? `last ${arr.filter(x=>x!==null).slice(-3).join(' → ')}` : 'no trend';
    console.log(`  LCP history: ${trend(report.field.largestContentfulPaintMs?.history)}`);
    console.log(`  INP history: ${trend(report.field.interactionToNextPaintMs?.history)}`);
  } else if (report.field?.note) {
    console.log(`\nField: ${report.field.note}`);
  } else if (report.field?.error) {
    console.log(`\nField: CrUX unavailable — ${report.field.error}`);
  }
  console.log('\nTip: wire gsc.mjs + pagespeed.mjs into monitoring; run `npm run perf` locally for file-level budgets.\n');
  return report;
}

if (isMain(import.meta.url)) {
  runPagespeedAndCrUX().catch(err => {
    console.error('PageSpeed/CrUX error:', err);
    process.exit(1);
  });
}