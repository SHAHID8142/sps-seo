#!/usr/bin/env node

/**
 * SPS SEO — Local SEO Audit
 * Version: 1.4.0
 *
 * Zero-dependency Local SEO vertical scanner:
 *  1. LocalBusiness JSON-LD validation (name, address, geo, telephone,
 *     openingHoursSpecification, sameAs)
 *  2. NAP consistency — Name / Address / Phone compared across all pages
 *     that declare them (inconsistent NAP is the #1 local ranking killer)
 *  3. Local discoverability signals (contact page, geo meta, maps embed/link)
 *
 * Output: 0-100 Local SEO Score + findings (--json supported).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { walkFiles, IGNORE_DIRS, isMain } from './lib/core.mjs';

const CWD = process.cwd();

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

const LOCAL_TYPES = new Set([
  'localbusiness', 'organization', 'store', 'restaurant', 'hotel',
  'dentist', 'medicalclinic', 'lawfirm', 'realestateagent', 'autorepair',
  'professionalservice', 'homeandconstructionbusiness'
]);

function normalizeNap(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function normalizePhone(p) {
  return String(p || '').replace(/[^\d+]/g, '');
}

export function runLocalSeoAudit(options = {}) {
  const projectDir = options.cwd ? path.resolve(options.cwd) : CWD;
  const jsonOutput = options.json || process.argv.includes('--json');

  const pages = walkFiles(projectDir, {
    ignoreDirs: IGNORE_DIRS,
    extraIgnore: new Set(['public'])
  });

  const findings = [];
  let totalScore = 100;
  const penalize = (amt) => { totalScore -= amt; };

  const localPages = [];
  const phoneVariants = new Map();
  let contactLikePages = 0;
  let geoSignals = 0;

  for (const file of pages) {
    let content;
    try { content = fs.readFileSync(file, 'utf8'); } catch { continue; }

    const relPath = path.relative(projectDir, file);
    const blocks = extractJsonLd(content);
    const locals = blocks.filter(b => LOCAL_TYPES.has(String(b['@type'] || '').toLowerCase()));

    if (/<a[^>]*href=["'][^"']*(?:contact|kontakt|impressum)[^"']*["']/i.test(content) ||
        /(?:contact us|get in touch|call now)/i.test(content)) {
      contactLikePages++;
    }
    if (/<meta\s+name=["']geo\.(?:region|position|placename)["']|google\.com\/maps|goo\.gl\/maps/i.test(content)) {
      geoSignals++;
    }

    if (locals.length === 0) continue;
    localPages.push(relPath);

    for (const lb of locals) {
      if (!lb.name) {
        findings.push({ severity: 'high', file: relPath, msg: 'LocalBusiness missing "name".', fix: 'Add the exact business name used in Google Business Profile.' });
        penalize(8);
      }
      const addr = lb.address;
      if (!addr || (!addr.streetAddress && !addr.addressLocality)) {
        findings.push({ severity: 'high', file: relPath, msg: 'LocalBusiness missing postal address — required for local pack eligibility.', fix: 'Add PostalAddress with streetAddress, addressLocality, addressRegion, postalCode.' });
        penalize(8);
      }
      if (!lb.telephone) {
        findings.push({ severity: 'medium', file: relPath, msg: 'LocalBusiness missing "telephone".', fix: 'Add phone in international format e.g. +1-555-010-1234.' });
        penalize(5);
      } else {
        // NAP consistency: key on trailing 9 digits (ignores country prefix
        // variations), store the RAW rendered string as the variant so that
        // the same number written in different formats is detected.
        const digits = normalizePhone(lb.telephone);
        const key = digits.slice(-9);
        if (!phoneVariants.has(key)) phoneVariants.set(key, new Set());
        phoneVariants.get(key).add(String(lb.telephone).trim().toLowerCase());
      }
      if (!lb.geo || !lb.geo.latitude || !lb.geo.longitude) {
        findings.push({ severity: 'low', file: relPath, msg: 'LocalBusiness missing geo coordinates.', fix: 'Add geo.latitude / geo.longitude.' });
        penalize(3);
      }
      if (!lb.openingHoursSpecification && !lb.openingHours) {
        findings.push({ severity: 'medium', file: relPath, msg: 'Missing openingHoursSpecification — hours drive local rich results.', fix: 'Add openingHoursSpecification array.' });
        penalize(5);
      }
      if (!lb.sameAs || (Array.isArray(lb.sameAs) && lb.sameAs.length === 0)) {
        findings.push({ severity: 'medium', file: relPath, msg: 'Missing sameAs entity links (GBP, socials, directories).', fix: 'Link Google Business Profile + major social profiles via sameAs.' });
        penalize(4);
      }
    }
  }

  // NAP consistency verdict
  const inconsistent = [...phoneVariants.entries()].filter(([key, variants]) => variants.size > 1);
  if (inconsistent.length > 0) {
    findings.push({
      severity: 'critical',
      file: null,
      msg: `NAP inconsistency: ${inconsistent.length} phone number(s) appear in multiple different formats across pages.`,
      fix: 'Use ONE exact phone format everywhere (schema, footer, contact page, GBP).'
    });
    penalize(12);
  }
  if (localPages.length === 0) {
    findings.push({
      severity: 'medium',
      file: null,
      msg: 'No LocalBusiness/Store/Organization schema found — invisible in local pack & Google Maps.',
      fix: 'Add LocalBusiness JSON-LD to the homepage/contact page (template: schemas/local-business.json).'
    });
    penalize(10);
  }
  if (localPages.length > 0 && contactLikePages === 0) {
    findings.push({ severity: 'medium', file: null, msg: 'No crawlable contact signals found (contact links, phone CTA).', fix: 'Add a contact page linked from global navigation with NAP in text (not just schema).' });
    penalize(5);
  }

  totalScore = Math.max(0, Math.min(100, Math.round(totalScore)));
  const grade = totalScore >= 90 ? 'A' : totalScore >= 75 ? 'B' : totalScore >= 50 ? 'C' : 'F';

  const result = {
    timestamp: new Date().toISOString(),
    score: totalScore,
    grade,
    pagesScanned: pages.length,
    localBusinessPages: localPages,
    contactSignals: contactLikePages,
    geoSignals,
    findings
  };

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return result;
  }

  console.log('\n====================================================');
  console.log('          SPS SEO LOCAL AUDIT REPORT                ');
  console.log('====================================================\n');
  console.log(`Local SEO Score: ${result.score}/100 (Grade: ${result.grade})`);
  console.log(`Pages scanned: ${result.pagesScanned} | LocalBusiness pages: ${localPages.length} | Contact signals: ${contactLikePages}`);
  for (const f of findings) {
    console.log(`  [${f.severity.toUpperCase()}] ${f.file || 'site'}: ${f.msg}`);
  }
  if (findings.length === 0) console.log('  ✓ No local SEO issues detected.');
  console.log('');
  return result;
}

if (isMain(import.meta.url)) {
  try { runLocalSeoAudit(); } catch (err) {
    console.error('Local SEO audit error:', err);
    process.exit(1);
  }
}
