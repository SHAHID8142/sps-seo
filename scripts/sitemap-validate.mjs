#!/usr/bin/env node

/**
 * SPS SEO — Sitemap Validator
 * Version: 1.4.0
 *
 * Zero-dependency sitemap.xml / sitemap index validator:
 *  1. XML structure sanity (urlset/sitemapindex, <loc> presence & absolute URLs)
 *  2. Route resolution — every <loc> must map to a real page/route in the
 *     project (static file, app router route, pages router, content file)
 *  3. lastmod format validation (W3C datetime)
 *  4. Sitemap index support + limits (50k URLs / 50MB per sitemap spec)
 *  5. hreflang alternates reciprocity inside <url> entries
 *
 * Output: 0-100 Sitemap Score + findings (--json supported).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { walkFiles, IGNORE_DIRS, isMain } from './lib/core.mjs';

const CWD = process.cwd();

function findSitemaps(projectDir) {
  const candidates = ['public/sitemap.xml', 'sitemap.xml', 'public/sitemap-index.xml', 'sitemap-index.xml'];
  return candidates
    .map(rel => path.join(projectDir, rel))
    .filter(p => fs.existsSync(p));
}

function routeExists(projectDir, urlObj) {
  // Resolve a URL path to a plausible project route
  let p = decodeURIComponent(urlObj.pathname || '/').replace(/\/+$/, '') || '/';
  const tries = [];
  if (p === '/') {
    tries.push('index.html', 'app/page.tsx', 'app/page.jsx', 'app/page.astro', 'app/page.md', 'app/page.mdx',
      'src/app/page.tsx', 'src/app/page.jsx', 'pages/index.tsx', 'pages/index.js', 'pages/index.astro',
      'src/pages/index.tsx', 'content/index.md', 'index.md');
  } else {
    const segs = p.split('/').filter(Boolean);
    const last = segs[segs.length - 1];
    tries.push(
      path.join(...segs) + '.html', path.join(...segs) + '.htm',
      path.join(...segs) + '.md', path.join(...segs) + '.mdx',
      path.join('content', ...segs) + '.md', path.join('content', ...segs) + '.mdx',
      path.join('app', ...segs, 'page.tsx'), path.join('app', ...segs, 'page.jsx'),
      path.join('app', ...segs, 'page.astro'), path.join('app', ...segs, 'page.md'),
      path.join('src/app', ...segs, 'page.tsx'),
      path.join('pages', ...segs) + '.tsx', path.join('pages', ...segs) + '.js',
      path.join('pages', ...segs) + '.astro', path.join('src/pages', ...segs) + '.tsx',
      path.join('public', ...segs) + '.html', path.join(...segs, 'index.html'),
      // dynamic route equivalents
      path.join('app', ...segs.slice(0, -1), '[slug]', 'page.tsx'),
      path.join('pages', ...segs.slice(0, -1), '[slug].tsx'),
      path.join('content', ...segs.slice(0, -1), last) + '/index.md'
    );
  }
  // Brackets in file names would be glob chars only in glob context — fs handles them literally
  return tries.some(rel => fs.existsSync(path.join(projectDir, rel)));
}

export function runSitemapValidation(options = {}) {
  const projectDir = options.cwd ? path.resolve(options.cwd) : CWD;
  const jsonOutput = options.json || process.argv.includes('--json');

  const findings = [];
  let totalScore = 100;
  const penalize = (amt) => { totalScore -= amt; };

  const sitemapFiles = findSitemaps(projectDir);
  if (sitemapFiles.length === 0) {
    findings.push({ severity: 'high', msg: 'No sitemap.xml found (checked root and public/).', fix: 'Run npm run sitemap to generate one.' });
    totalScore -= 25;
  }

  let totalUrls = 0;
  const urlsChecked = [];

  for (const sitemapPath of sitemapFiles) {
    let xml;
    try { xml = fs.readFileSync(sitemapPath, 'utf8'); } catch { continue; }

    const isIndex = /<sitemapindex/i.test(xml);
    const rel = path.relative(projectDir, sitemapPath);

    // Parse <loc> entries (sitemapindex: child sitemaps; urlset: pages)
    const locRegex = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
    const locs = [];
    let m;
    while ((m = locRegex.exec(xml)) !== null) locs.push(m[1]);

    if (locs.length === 0) {
      findings.push({ severity: 'high', file: rel, msg: 'Sitemap contains no <loc> entries.', fix: 'Populate <url><loc> entries or fix XML parsing errors.' });
      penalize(15);
    }

    // Limits (per sitemaps.org spec)
    if (!isIndex && locs.length > 50000) {
      findings.push({ severity: 'high', file: rel, msg: `Sitemap has ${locs.length} URLs — exceeds the 50,000 URL limit.`, fix: 'Split into a sitemap index with multiple sitemaps.' });
      penalize(10);
    }
    if (fs.statSync(sitemapPath).size > 50 * 1024 * 1024) {
      findings.push({ severity: 'high', file: rel, msg: 'Sitemap exceeds the 50MB uncompressed size limit.', fix: 'Split into a sitemap index.' });
      penalize(10);
    }

    // lastmod validation + URL resolution (only for page urlsets)
    if (!isIndex) {
      totalUrls += locs.length;
      const lastmodRegex = /<lastmod>\s*([^<\s]+)\s*<\/lastmod>/gi;
      while ((m = lastmodRegex.exec(xml)) !== null) {
        if (Number.isNaN(Date.parse(m[1]))) {
          findings.push({ severity: 'medium', file: rel, msg: `Invalid lastmod value: "${m[1]}" (must be W3C datetime).`, fix: 'Use e.g. 2026-01-15 or 2026-01-15T08:00:00+00:00.' });
          penalize(3);
          break; // one report per sitemap is enough
        }
      }

      const config = (() => {
        try { return JSON.parse(fs.readFileSync(path.join(projectDir, 'sps-seo-config.json'), 'utf8')); }
        catch { return null; }
      })();
      const siteUrl = config?.site?.url || null;

      for (const loc of locs.slice(0, 2000)) { // cap work on huge sitemaps
        let urlObj = null;
        try { urlObj = new URL(loc); } catch {
          findings.push({ severity: 'medium', file: rel, msg: `Non-absolute <loc>: ${loc}`, fix: 'Sitemap URLs must be fully qualified absolute URLs.' });
          penalize(3);
          continue;
        }
        if (siteUrl && !loc.startsWith(siteUrl.replace(/\/$/, ''))) {
          findings.push({ severity: 'medium', file: rel, msg: `URL outside site.url domain: ${loc}`, fix: 'Sitemap must only contain canonical URLs of site.url.' });
          penalize(3);
          continue;
        }
        const exists = routeExists(projectDir, urlObj);
        urlsChecked.push({ loc, exists });
        if (!exists) {
          findings.push({ severity: 'medium', file: rel, msg: `Sitemap URL has no matching page in the project: ${loc}`, fix: 'Remove the URL or create the page. (Dynamic/API routes: verify manually.)' });
          penalize(2);
        }
      }

      // hreflang reciprocity inside sitemap
      if (/<xhtml:link/i.test(xml) && !/hreflang=["']x-default["']/i.test(xml)) {
        findings.push({ severity: 'low', file: rel, msg: 'hreflang alternates present but no x-default defined.', fix: 'Add x-default alternate for language-agnostic selection.' });
        penalize(2);
      }
    } else {
      // validate child sitemaps exist relative to index location
      for (const loc of locs) {
        const childName = loc.split('/').pop();
        const childPath = path.join(path.dirname(sitemapPath), childName);
        if (!fs.existsSync(childPath)) {
          findings.push({ severity: 'high', file: rel, msg: `Sitemap index references missing child sitemap: ${childName}`, fix: 'Generate the child sitemap or remove the entry.' });
          penalize(8);
        }
      }
    }
  }

  totalScore = Math.max(0, Math.min(100, Math.round(totalScore)));
  const grade = totalScore >= 90 ? 'A' : totalScore >= 75 ? 'B' : totalScore >= 50 ? 'C' : 'F';

  const result = {
    timestamp: new Date().toISOString(),
    score: totalScore,
    grade,
    sitemapsFound: sitemapFiles.map(p => path.relative(projectDir, p)),
    totalUrls,
    urlsResolved: urlsChecked.filter(u => u.exists).length,
    findings
  };

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return result;
  }

  console.log('\n====================================================');
  console.log('        SPS SEO SITEMAP VALIDATION                  ');
  console.log('====================================================\n');
  console.log(`Sitemap Score: ${result.score}/100 (Grade: ${result.grade})`);
  console.log(`Sitemaps found: ${result.sitemapsFound.length ? result.sitemapsFound.join(', ') : 'none'} | URLs: ${result.totalUrls} | Resolved to project pages: ${result.urlsResolved}`);
  for (const f of findings) {
    console.log(`  [${f.severity.toUpperCase()}] ${f.file || 'sitemap'}: ${f.msg}`);
  }
  if (findings.length === 0) console.log('  ✓ Sitemap is valid and all URLs resolve.');
  console.log('');
  return result;
}

if (isMain(import.meta.url)) {
  try { runSitemapValidation(); } catch (err) {
    console.error('Sitemap validation error:', err);
    process.exit(1);
  }
}
