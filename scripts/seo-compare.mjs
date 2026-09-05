#!/usr/bin/env node

/**
 * SPS SEO Side-by-Side Project Comparison
 * Version: 1.3.0
 *
 * Runs the full SEO audit (and sub-audits: perf, links, cannibalization,
 * schema) against TWO project directories and outputs a side-by-side
 * comparison matrix.
 *
 * Use: compare your site vs. a competitor checkout (read-only), or compare
 * two branches/staging environments of your own site.
 *
 * Usage:
 *   node scripts/seo-compare.mjs <pathA> <pathB>
 *   npm run compare -- /path/to/site-a /path/to/site-b
 */

import fs from 'node:fs';
import path from 'node:path';
import { runAudit } from './audit.mjs';
import { scanPerformanceBudget } from './perf-budget.mjs';
import { analyzeInternalLinks } from './internal-links.mjs';
import { detectCannibalization } from './cannibalization.mjs';
import { validateSchemas } from './validate-schema.mjs';
import { runSecurityAudit } from './security-audit.mjs';
import { runA11yAudit } from './a11y.mjs';
import { runBundleAudit } from './bundle-audit.mjs';
import { runSnippetAudit } from './snippet-audit.mjs';
import { runKeywordAudit } from './keyword-audit.mjs';
import { runTfidfAudit } from './tfidf.mjs';

const CWD = process.cwd();

export async function runSeoCompare(options = {}) {
  const args = options.paths || process.argv.slice(2);
  let pathA, pathB;
  if (args.length >= 2 && fs.existsSync(args[0]) && fs.existsSync(args[1])) {
    pathA = path.resolve(args[0]);
    pathB = path.resolve(args[1]);
  } else if (options.pathA && options.pathB) {
    pathA = path.resolve(options.pathA);
    pathB = path.resolve(options.pathB);
  } else {
    console.error('\nUsage: node scripts/seo-compare.mjs <pathA> <pathB>');
    console.error('  Compares two project directories side-by-side.\n');
    process.exit(1);
  }

  console.log(`\n====================================================`);
  console.log(`     SPS SEO SIDE-BY-SIDE COMPARISON                 `);
  console.log(`====================================================\n`);
  console.log(`A: ${pathA}`);
  console.log(`B: ${pathB}\n`);

  const [a, b] = await Promise.all([
    runFullAudit(pathA),
    runFullAudit(pathB),
  ]);

  const comparison = buildComparison(a, b);
  printComparison(comparison);

  const md = renderMarkdown(comparison);
  const outPath = path.join(CWD, 'sps-seo-comparison.md');
  fs.writeFileSync(outPath, md, 'utf8');
  console.log(`\n  Markdown report: ${outPath}\n`);

  return comparison;
}

async function runFullAudit(projectDir) {
  const [main, perf, links, cann, schema, security, a11y, bundle, snippet, kw, tfidf] = await Promise.all([
    Promise.resolve(runAudit({ cwd: projectDir, json: true })),
    Promise.resolve(scanPerformanceBudget({ cwd: projectDir, json: true })),
    Promise.resolve(analyzeInternalLinks({ cwd: projectDir, json: true })),
    Promise.resolve(detectCannibalization({ cwd: projectDir, json: true })),
    Promise.resolve(validateSchemas({ cwd: projectDir, json: true })),
    Promise.resolve(runSecurityAudit({ cwd: projectDir, json: true })),
    Promise.resolve(runA11yAudit({ cwd: projectDir, json: true })),
    Promise.resolve(runBundleAudit({ cwd: projectDir, json: true })),
    Promise.resolve(runSnippetAudit({ cwd: projectDir, json: true })),
    Promise.resolve(runKeywordAudit({ cwd: projectDir, json: true })),
    Promise.resolve(runTfidfAudit({ cwd: projectDir, json: true })),
  ]);

  return {
    project: projectDir,
    main,
    perf,
    links,
    cannibalization: cann,
    schema,
    security,
    a11y,
    bundle,
    snippet,
    keyword: kw,
    tfidf
  };
}

function buildComparison(a, b) {
  const rows = [];
  rows.push({
    metric: 'Overall audit score',
    a: a.main.score,
    b: b.main.score,
    delta: b.main.score - a.main.score,
    format: 'score'
  });
  rows.push({
    metric: 'Grade',
    a: a.main.grade,
    b: b.main.grade,
    format: 'grade'
  });
  rows.push({
    metric: 'Technical & crawlability',
    a: a.main.categories?.technical?.score,
    b: b.main.categories?.technical?.score,
    delta: (b.main.categories?.technical?.score || 0) - (a.main.categories?.technical?.score || 0),
    format: '/25'
  });
  rows.push({
    metric: 'Meta tags & social',
    a: a.main.categories?.metadata?.score,
    b: b.main.categories?.metadata?.score,
    delta: (b.main.categories?.metadata?.score || 0) - (a.main.categories?.metadata?.score || 0),
    format: '/25'
  });
  rows.push({
    metric: 'Semantic hierarchy',
    a: a.main.categories?.semantics?.score,
    b: b.main.categories?.semantics?.score,
    delta: (b.main.categories?.semantics?.score || 0) - (a.main.categories?.semantics?.score || 0),
    format: '/25'
  });
  rows.push({
    metric: 'Schema & AI search',
    a: a.main.categories?.schemaAndAi?.score,
    b: b.main.categories?.schemaAndAi?.score,
    delta: (b.main.categories?.schemaAndAi?.score || 0) - (a.main.categories?.schemaAndAi?.score || 0),
    format: '/25'
  });

  rows.push({
    metric: 'Files scanned',
    a: a.main.filesScanned,
    b: b.main.filesScanned,
    format: 'count'
  });

  rows.push({
    metric: 'Performance budget',
    a: a.perf.score,
    b: b.perf.score,
    delta: b.perf.score - a.perf.score,
    format: '/100'
  });
  rows.push({
    metric: 'Asset payload (MB)',
    a: a.perf.metrics?.totalAssetMb,
    b: b.perf.metrics?.totalAssetMb,
    format: 'mb'
  });
  rows.push({
    metric: 'Heavy images >200KB',
    a: a.perf.metrics?.heavyImages?.length || 0,
    b: b.perf.metrics?.heavyImages?.length || 0,
    format: 'count'
  });
  rows.push({
    metric: 'Missing image dimensions',
    a: a.perf.metrics?.missingDimensionsCount || 0,
    b: b.perf.metrics?.missingDimensionsCount || 0,
    format: 'count'
  });

  rows.push({
    metric: 'Internal link score',
    a: a.links.score,
    b: b.links.score,
    delta: b.links.score - a.links.score,
    format: '/100'
  });
  rows.push({
    metric: 'Orphan pages',
    a: a.links.orphanRoutes?.length || 0,
    b: b.links.orphanRoutes?.length || 0,
    format: 'count'
  });
  rows.push({
    metric: 'Weak anchor texts',
    a: a.links.weakLinks?.length || 0,
    b: b.links.weakLinks?.length || 0,
    format: 'count'
  });

  rows.push({
    metric: 'Cannibalization',
    a: a.cannibalization.isHealthy ? 'Healthy' : 'Conflicts',
    b: b.cannibalization.isHealthy ? 'Healthy' : 'Conflicts',
    format: 'health'
  });
  rows.push({
    metric: 'Duplicate titles',
    a: a.cannibalization.duplicateTitles?.length || 0,
    b: b.cannibalization.duplicateTitles?.length || 0,
    format: 'count'
  });

  rows.push({
    metric: 'Schema validity',
    a: a.schema.isValid ? '✓ Valid' : `${a.schema.errors?.length || 0} errors`,
    b: b.schema.isValid ? '✓ Valid' : `${b.schema.errors?.length || 0} errors`,
    format: 'health'
  });
  rows.push({
    metric: 'JSON-LD blocks',
    a: a.schema.blocksFound,
    b: b.schema.blocksFound,
    format: 'count'
  });

  rows.push({
    metric: 'Security score',
    a: a.security.score,
    b: b.security.score,
    delta: b.security.score - a.security.score,
    format: '/100'
  });
  rows.push({
    metric: 'Critical security findings',
    a: a.security.counts?.critical || 0,
    b: b.security.counts?.critical || 0,
    format: 'count'
  });

  rows.push({
    metric: 'Accessibility score',
    a: a.a11y.score,
    b: b.a11y.score,
    delta: b.a11y.score - a.a11y.score,
    format: '/100'
  });

  rows.push({
    metric: 'Bundle score',
    a: a.bundle.score,
    b: b.bundle.score,
    delta: b.bundle.score - a.bundle.score,
    format: '/100'
  });
  rows.push({
    metric: 'Render-blocking scripts',
    a: a.bundle.stats?.renderBlockingScripts || 0,
    b: b.bundle.stats?.renderBlockingScripts || 0,
    format: 'count'
  });

  rows.push({
    metric: 'Snippet eligibility score',
    a: a.snippet.score,
    b: b.snippet.score,
    delta: b.snippet.score - a.snippet.score,
    format: '/100'
  });

  rows.push({
    metric: 'Keyword coverage score',
    a: a.keyword.score,
    b: b.keyword.score,
    delta: b.keyword.score - a.keyword.score,
    format: '/100'
  });

  rows.push({
    metric: 'TF-IDF health score',
    a: a.tfidf.score,
    b: b.tfidf.score,
    delta: b.tfidf.score - a.tfidf.score,
    format: '/100'
  });

  // Determine overall winner
  const winsB = rows.filter(r => r.delta !== undefined && r.delta > 0).length;
  const winsA = rows.filter(r => r.delta !== undefined && r.delta < 0).length;
  const ties = rows.filter(r => r.delta === 0 || r.delta === undefined).length;

  return { a, b, rows, summary: { winsA, winsB, ties } };
}

function printComparison(c) {
  console.log('Comparison Matrix:');
  console.log('-'.repeat(80));
  console.log('  Metric                              A                B          Δ');
  console.log('-'.repeat(80));
  for (const row of c.rows) {
    const a = formatVal(row.a, row.format);
    const b = formatVal(row.b, row.format);
    const delta = row.delta !== undefined ? (row.delta > 0 ? `+${row.delta}` : `${row.delta}`) : '';
    const metric = row.metric.padEnd(36);
    console.log(`  ${metric}${a.padStart(18)}${b.padStart(18)}${delta.padStart(10)}`);
  }
  console.log('-'.repeat(80));
  console.log(`  Summary: A wins ${c.summary.winsA} metric(s), B wins ${c.summary.winsB}, ties ${c.summary.ties}.`);
}

function formatVal(v, format) {
  if (v === null || v === undefined) return '—';
  if (format === 'score' || format === '/100') return `${v}/100`;
  if (format === '/25') return `${v}/25`;
  if (format === 'mb') return `${v} MB`;
  if (format === 'count') return `${v}`;
  return String(v);
}

function renderMarkdown(c) {
  let md = `# SPS SEO Side-by-Side Comparison\n\n`;
  md += `**Generated:** ${new Date().toISOString()}\n\n`;
  md += `**A:** \`${c.a.project}\`\n\n**B:** \`${c.b.project}\`\n\n`;

  md += `## Comparison Matrix\n\n`;
  md += `| Metric | A | B | Δ |\n|:---|---:|---:|---:|\n`;
  for (const row of c.rows) {
    md += `| ${row.metric} | ${formatVal(row.a, row.format)} | ${formatVal(row.b, row.format)} | ${row.delta !== undefined ? (row.delta > 0 ? '+' + row.delta : row.delta) : '—'} |\n`;
  }

  md += `\n## Summary\n\nA wins ${c.summary.winsA} metric(s), B wins ${c.summary.winsB}, ties ${c.summary.ties}.\n`;
  return md;
}

export const compareSeo = runSeoCompare;

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  runSeoCompare().catch(err => {
    console.error('SEO compare error:', err);
    process.exit(1);
  });
}

