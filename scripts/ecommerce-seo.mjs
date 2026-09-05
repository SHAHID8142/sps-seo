#!/usr/bin/env node

/**
 * SPS SEO — E-commerce SEO Audit
 * Version: 1.4.0
 *
 * Zero-dependency E-commerce vertical scanner:
 *  1. Product JSON-LD validation (name, image, offers.price, priceCurrency,
 *     availability enum, sku/brand/aggregateRating)
 *  2. Pagination SEO — canonical self-reference & rel navigation on
 *     paginated routes (/page/2, ?page=2, /page-3)
 *  3. Category/PLP signals (ItemList schema presence)
 *  4. Out-of-stock handling (availability enum validity)
 *
 * Output: 0-100 E-commerce SEO Score + per-page findings (--json supported).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { walkFiles, IGNORE_DIRS, isMain } from './lib/core.mjs';

const CWD = process.cwd();

const AVAILABILITY_VALUES = new Set([
  'https://schema.org/InStock',
  'https://schema.org/OutOfStock',
  'https://schema.org/SoldOut',
  'https://schema.org/PreOrder',
  'https://schema.org/LimitedAvailability',
  'http://schema.org/InStock',
  'http://schema.org/OutOfStock'
]);

function extractJsonLd(content) {
  const blocks = [];
  const regex = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = regex.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(m[1].trim());
      if (Array.isArray(parsed)) blocks.push(...parsed);
      else blocks.push(parsed);
    } catch {
      blocks.push({ __invalid: true });
    }
  }
  return blocks;
}

function isPaginatedRoute(relPath) {
  return /(?:^|[/_])page[-_/]?\d+|\?page=\d+|\/p\/\d+/i.test(relPath);
}

export function runEcommerceSeoAudit(options = {}) {
  const projectDir = options.cwd ? path.resolve(options.cwd) : CWD;
  const jsonOutput = options.json || process.argv.includes('--json');

  const pages = walkFiles(projectDir, {
    ignoreDirs: IGNORE_DIRS,
    extraIgnore: new Set(['public'])
  });

  const pageReports = [];
  const findings = [];
  let totalScore = 100;
  const penalize = (amt) => { totalScore -= amt; };

  let productPages = 0;
  let paginatedPages = 0;

  for (const file of pages) {
    let content;
    try { content = fs.readFileSync(file, 'utf8'); } catch { continue; }

    const relPath = path.relative(projectDir, file);
    const report = { file: relPath, hasProductSchema: false, paginated: isPaginatedRoute(relPath) };

    if (report.paginated) paginatedPages++;

    // --- Pagination canonicalization ---
    if (report.paginated) {
      const selfCanonical = /<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i.exec(content) ||
                            /<link\s+href=["']([^"']+)["']\s+rel=["']canonical["']/i.exec(content);
      if (!selfCanonical) {
        findings.push({
          severity: 'high',
          file: relPath,
          msg: 'Paginated page has no canonical tag.',
          fix: 'Self-canonicalize each paginated page (never canonicalize page 2 to page 1).'
        });
        penalize(8);
      } else if (!/page/i.test(selfCanonical[1])) {
        findings.push({
          severity: 'high',
          file: relPath,
          msg: `Paginated page canonicalizes to a non-paginated URL (${selfCanonical[1]}) — indexation risk.`,
          fix: 'Use a self-referencing canonical on each pagination step.'
        });
        penalize(8);
      }
      if (!/rel=["'](?:next|prev)["']|aria-label=["'](?:Next|Previous)/i.test(content)) {
        findings.push({
          severity: 'low',
          file: relPath,
          msg: 'Paginated page lacks rel next/prev links or accessible pagination labels.',
          fix: 'Add crawlable <a rel="next/prev"> pagination links with aria-labels.'
        });
        penalize(3);
      }
    }

    // --- Product schema validation ---
    const blocks = extractJsonLd(content);
    const products = blocks.filter(b => String(b['@type'] || '') === 'Product');
    if (products.length === 0) { pageReports.push(report); continue; }

    report.hasProductSchema = true;
    productPages++;

    for (const p of products) {
      if (!p.name) { findings.push({ severity: 'high', file: relPath, msg: 'Product missing "name" — rich result ineligible.', fix: 'Add product name.' }); penalize(8); }
      if (!p.image || (Array.isArray(p.image) && p.image.length === 0)) { findings.push({ severity: 'high', file: relPath, msg: 'Product missing "image".', fix: 'Add at least one product image URL.' }); penalize(6); }
      if (!p.description) { findings.push({ severity: 'medium', file: relPath, msg: 'Product missing "description".', fix: 'Add a product description.' }); penalize(4); }
      if (!p.sku && !p.gtin) { findings.push({ severity: 'low', file: relPath, msg: 'Product missing "sku"/"gtin" — reduces Merchant Center match quality.', fix: 'Add sku or gtin.' }); penalize(2); }
      if (!p.brand) { findings.push({ severity: 'medium', file: relPath, msg: 'Product missing "brand".', fix: 'Add brand as Brand or Organization.' }); penalize(3); }

      const offers = Array.isArray(p.offers) ? p.offers : p.offers ? [p.offers] : [];
      if (offers.length === 0) {
        findings.push({ severity: 'critical', file: relPath, msg: 'Product has no "offers" — Google rejects the rich result entirely.', fix: 'Add offers with price, priceCurrency, availability.' });
        penalize(15);
      } else {
        for (const o of offers) {
          if (o.price === undefined && !o.priceSpecification) {
            findings.push({ severity: 'critical', file: relPath, msg: 'Offer missing "price" — rich result invalid.', fix: 'Add numeric price.' });
            penalize(10);
          }
          if (!o.priceCurrency) {
            findings.push({ severity: 'high', file: relPath, msg: 'Offer missing "priceCurrency".', fix: 'Add ISO 4217 currency code (e.g. USD).' });
            penalize(6);
          }
          if (o.availability && !AVAILABILITY_VALUES.has(String(o.availability))) {
            findings.push({ severity: 'medium', file: relPath, msg: `Invalid availability value: "${o.availability}".`, fix: 'Use full schema.org enum e.g. https://schema.org/InStock.' });
            penalize(4);
          }
          if (!o.availability) {
            findings.push({ severity: 'medium', file: relPath, msg: 'Offer missing "availability" — out-of-stock pages may stay indexed as buyable.', fix: 'Add availability enum.' });
            penalize(4);
          }
        }
      }

      if (!p.aggregateRating && !p.review) {
        findings.push({ severity: 'info', file: relPath, msg: 'Product has no aggregateRating/review — star snippets unavailable.', fix: 'Collect reviews and add AggregateRating.' });
      }
    }

    pageReports.push(report);
  }

  // Category/PLP ItemList detection
  const hasItemList = pages.some(f => {
    try {
      const c = fs.readFileSync(f, 'utf8');
      return /"@type"\s*:\s*"ItemList"/i.test(c);
    } catch { return false; }
  });
  if (productPages > 0 && !hasItemList) {
    findings.push({
      severity: 'low',
      file: null,
      msg: 'No ItemList schema found on category/collection pages.',
      fix: 'Add ItemList schema to PLPs listing products.'
    });
    penalize(3);
  }

  totalScore = Math.max(0, Math.min(100, Math.round(totalScore)));
  const grade = totalScore >= 90 ? 'A' : totalScore >= 75 ? 'B' : totalScore >= 50 ? 'C' : 'F';

  const result = {
    timestamp: new Date().toISOString(),
    score: totalScore,
    grade,
    pagesScanned: pageReports.length,
    productPages,
    paginatedPages,
    pageReports,
    findings
  };

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return result;
  }

  console.log('\n====================================================');
  console.log('        SPS SEO E-COMMERCE AUDIT REPORT             ');
  console.log('====================================================\n');
  console.log(`E-commerce SEO Score: ${result.score}/100 (Grade: ${result.grade})`);
  console.log(`Pages scanned: ${result.pagesScanned} | Product pages: ${productPages} | Paginated routes: ${paginatedPages}`);
  for (const f of findings) {
    console.log(`  [${f.severity.toUpperCase()}] ${f.file || 'site'}: ${f.msg}`);
  }
  if (findings.length === 0) console.log('  ✓ No e-commerce SEO issues detected.');
  console.log('');
  return result;
}

if (isMain(import.meta.url)) {
  try { runEcommerceSeoAudit(); } catch (err) {
    console.error('E-commerce SEO audit error:', err);
    process.exit(1);
  }
}
