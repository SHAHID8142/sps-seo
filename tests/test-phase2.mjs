#!/usr/bin/env node

/**
 * SPS SEO — Phase 2 Test Suite (v1.4.0)
 * Covers: video-seo, news-seo, ecommerce-seo, local-seo, duplicate-content,
 * sitemap-validate, generate-rss, markdown/mdx audit support, unified CLI.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
let failed = 0;

function assert(cond, message) {
  if (cond) { passed++; }
  else { failed++; console.error(`  ✗ FAIL: ${message}`); }
}

function createTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}
function cleanupDir(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

const runVideoSeoAudit = (await import('../scripts/video-seo.mjs')).runVideoSeoAudit;
const runNewsSeoAudit = (await import('../scripts/news-seo.mjs')).runNewsSeoAudit;
const runEcommerceSeoAudit = (await import('../scripts/ecommerce-seo.mjs')).runEcommerceSeoAudit;
const runLocalSeoAudit = (await import('../scripts/local-seo.mjs')).runLocalSeoAudit;
const runDuplicateContentAudit = (await import('../scripts/duplicate-content.mjs')).runDuplicateContentAudit;
const runSitemapValidation = (await import('../scripts/sitemap-validate.mjs')).runSitemapValidation;
const generateRss = (await import('../scripts/generate-rss.mjs')).generateRss;

async function runTests() {
  console.log('SPS SEO Phase 2 Test Suite (v1.4.0)\n');

  // TEST P1: VideoObject schema detection
  const vDir = createTempDir('sps-seo-test-video-');
  try {
    console.log('Test P1: Video SEO Audit');
    fs.writeFileSync(path.join(vDir, 'index.html'), `
      <html><head><title>Video Page</title></head><body>
        <h1>Product Demo</h1>
        <iframe src="https://www.youtube.com/embed/abc123"></iframe>
        <script type="application/ld+json">{"@context":"https://schema.org","@type":"VideoObject","name":"Demo","description":"A demo video","thumbnailUrl":["https://example.com/t.jpg"],"uploadDate":"2026-01-15T08:00:00+00:00","duration":"PT3M30S","embedUrl":"https://www.youtube.com/embed/abc123"}</script>
      </body></html>
    `);
    fs.writeFileSync(path.join(vDir, 'missing.html'), `
      <html><head><title>Embed No Schema</title></head><body>
        <iframe src="https://www.youtube-nocookie.com/embed/xyz"></iframe>
      </body></html>
    `);
    const vResult = runVideoSeoAudit({ cwd: vDir, json: true });
    assert(vResult.embedPages === 2, 'Detected both video embed pages');
    assert(vResult.videoSchemaPages === 1, 'Detected VideoObject schema page');
    assert(vResult.findings.some(f => f.file.includes('missing.html') && f.severity === 'high'), 'Flagged embed without VideoObject schema');
    assert(vResult.findings.some(f => f.msg.includes('privacy-enhanced')), 'Flagged non-nocookie YouTube embed');
  } finally { cleanupDir(vDir); }

  // TEST P2: NewsArticle validation & news sitemap
  const nDir = createTempDir('sps-seo-test-news-');
  try {
    console.log('Test P2: News SEO Audit');
    fs.writeFileSync(path.join(nDir, 'news.html'), `
      <html><head><title>Breaking</title></head><body>
        <h1>Breaking Story</h1>
        <script type="application/ld+json">{"@context":"https://schema.org","@type":"NewsArticle","headline":"Breaking Story About An Important Development","datePublished":"not-a-date","author":{"@type":"Person","name":"Jane"},"image":["https://example.com/i.jpg"],"publisher":{"@type":"Organization","name":"ACME","logo":"https://example.com/logo.png"}}</script>
      </body></html>
    `);
    const nResult = runNewsSeoAudit({ cwd: nDir, json: true });
    assert(nResult.newsArticlePages === 1, 'Detected NewsArticle page');
    assert(nResult.findings.some(f => f.msg.includes('not valid ISO 8601')), 'Flagged invalid datePublished');
    assert(nResult.findings.some(f => f.msg.includes('news sitemap')), 'Flagged missing news sitemap');
    assert(nResult.findings.some(f => f.msg.includes('isAccessibleForFree')), 'Info: isAccessibleForFree not declared');
  } finally { cleanupDir(nDir); }

  // TEST P3: Product schema + pagination
  const eDir = createTempDir('sps-seo-test-ecom-');
  try {
    console.log('Test P3: E-commerce SEO Audit');
    fs.writeFileSync(path.join(eDir, 'product.html'), `
      <html><head><title>Widget</title></head><body>
        <h1>Widget</h1>
        <script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Widget","image":["https://example.com/w.jpg"],"description":"A widget","brand":{"@type":"Brand","name":"ACME"},"sku":"W-1","offers":{"price":9.99,"priceCurrency":"USD","availability":"https://schema.org/InStock"}}</script>
      </body></html>
    `);
    fs.writeFileSync(path.join(eDir, 'page-2.html'), `
      <html><head><title>Shop Page 2</title></head><body><h1>Shop</h1></body></html>
    `);
    const eResult = runEcommerceSeoAudit({ cwd: eDir, json: true });
    assert(eResult.productPages === 1, 'Detected product page');
    assert(eResult.paginatedPages === 1, 'Detected paginated route');
    assert(eResult.findings.some(f => f.msg.includes('Paginated page has no canonical')), 'Flagged missing canonical on pagination');
    assert(!eResult.findings.some(f => f.file === 'product.html' && f.severity === 'critical'), 'Valid product has no critical findings');
  } finally { cleanupDir(eDir); }

  // TEST P4: LocalBusiness + NAP
  const lDir = createTempDir('sps-seo-test-local-');
  try {
    console.log('Test P4: Local SEO Audit');
    const lb = (tel) => `<html><head><title>Store</title></head><body><h1>Store</h1><script type="application/ld+json">{"@context":"https://schema.org","@type":"LocalBusiness","name":"ACME Store","address":{"@type":"PostalAddress","streetAddress":"1 Main St","addressLocality":"Springfield"},"telephone":"${tel}","geo":{"latitude":39.7,"longitude":-89.6},"openingHoursSpecification":[{"@type":"OpeningHoursSpecification","dayOfWeek":"Monday","opens":"09:00","closes":"17:00"}],"sameAs":["https://g.page/acme"]}</script></body></html>`;
    fs.writeFileSync(path.join(lDir, 'index.html'), lb('+1-555-010-1234'));
    fs.writeFileSync(path.join(lDir, 'contact.html'), lb('+1 (555) 010-1234'));
    const lResult = runLocalSeoAudit({ cwd: lDir, json: true });
    assert(lResult.localBusinessPages.length === 2, 'Found both LocalBusiness pages');
    assert(lResult.findings.some(f => f.severity === 'critical' && f.msg.includes('NAP inconsistency')), 'Flagged NAP phone inconsistency (same number, different formats)');
  } finally { cleanupDir(lDir); }

  // TEST P5: Duplicate content detection
  const dDir = createTempDir('sps-seo-test-dup-');
  try {
    console.log('Test P5: Duplicate Content Audit');
    const body = 'Buy our blue widget pro today with free shipping and a two year warranty included. Blue widgets are the best widgets for professional use and home use alike, with fast delivery and easy returns.';
    fs.writeFileSync(path.join(dDir, 'a.html'), `<html><head><title>Blue Widget</title></head><body><p>${body} Extra unique sentence number one about widgets.</p></body></html>`);
    fs.writeFileSync(path.join(dDir, 'b.html'), `<html><head><title>Blue Widget</title></head><body><p>${body} Totally different closing sentence about giraffes and lamps.</p></body></html>`);
    fs.writeFileSync(path.join(dDir, 'c.html'), `<html><head><title>Coffee Guide</title></head><body><p>Roast green beans at two hundred degrees until first crack, then cool rapidly and rest beans for twelve hours before grinding fine for espresso extraction practice sessions daily.</p></body></html>`);
    const dResult = runDuplicateContentAudit({ cwd: dDir, json: true });
    assert(dResult.duplicatePairs.length === 1, 'Detected the near-duplicate pair (a.html vs b.html)');
    assert(dResult.duplicateTitles.length === 1, 'Detected duplicate <title>');
    assert(!JSON.stringify(dResult.duplicatePairs).includes('c.html'), 'Unrelated page not flagged');
  } finally { cleanupDir(dDir); }

  // TEST P6: Sitemap validation
  const sDir = createTempDir('sps-seo-test-sitemap-');
  try {
    console.log('Test P6: Sitemap Validation');
    fs.mkdirSync(path.join(sDir, 'public'), { recursive: true });
    fs.writeFileSync(path.join(sDir, 'sps-seo-config.json'), JSON.stringify({ site: { url: 'https://example.com' } }));
    fs.writeFileSync(path.join(sDir, 'public', 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/</loc><lastmod>2026-01-15</lastmod></url>
  <url><loc>https://example.com/about</loc><lastmod>invalid-date</lastmod></url>
  <url><loc>https://other-site.net/steal</loc></url>
</urlset>`);
    const sResult = runSitemapValidation({ cwd: sDir, json: true });
    assert(sResult.sitemapsFound.length === 1, 'Found public/sitemap.xml');
    assert(sResult.findings.some(f => f.msg.includes('Invalid lastmod')), 'Flagged invalid lastmod');
    assert(sResult.findings.some(f => f.msg.includes('outside site.url')), 'Flagged cross-domain URL');
  } finally { cleanupDir(sDir); }

  // TEST P7: RSS generation
  const rDir = createTempDir('sps-seo-test-rss-');
  try {
    console.log('Test P7: RSS Feed Generation');
    fs.writeFileSync(path.join(rDir, 'sps-seo-config.json'), JSON.stringify({ site: { url: 'https://example.com', name: 'Example Blog' } }));
    fs.writeFileSync(path.join(rDir, 'post-1.md'), `---\ntitle: First Post\ndescription: About widgets\ndate: 2026-01-15\n---\n\n# First Post\n\nSome content.\n`);
    fs.writeFileSync(path.join(rDir, 'post-2.md'), `---\ntitle: Second Post\ndescription: About gadgets\ndate: 2026-02-20\n---\n\n# Second Post\n\nMore content.\n`);
    const rResult = generateRss({ cwd: rDir, json: true });
    assert(rResult.success === true, 'RSS generation succeeded');
    assert(rResult.items === 2, 'Both markdown posts included in feed');
    const rss = fs.readFileSync(path.join(rDir, 'public', 'rss.xml'), 'utf8');
    assert(rss.includes('<rss version="2.0"'), 'Output is valid RSS 2.0 XML');
    assert(rss.indexOf('Second Post') < rss.indexOf('First Post'), 'Feed sorted newest-first');
  } finally { cleanupDir(rDir); }

  // TEST P8: Markdown scanning in main audit + unified CLI
  const mDir = createTempDir('sps-seo-test-md-');
  try {
    console.log('Test P8: Markdown/MDX Audit Support + CLI');
    fs.writeFileSync(path.join(mDir, 'sps-seo-config.json'), JSON.stringify({ site: { url: 'https://example.com' } }));
    fs.writeFileSync(path.join(mDir, 'guide.mdx'), `---\ntitle: MDX Guide\ndescription: An MDX content page about SEO testing workflows today\n---\n\n# MDX Guide\n\n## How does MDX work?\n\nMDX combines markdown and JSX components in one file.\n\n![](/img/missing-alt.png)\n`);
    const auditMod = await import('../scripts/audit.mjs');
    const auditReport = await auditMod.runAudit({ cwd: mDir, json: true });
    assert(auditReport.filesScanned >= 1, 'Main audit scanned .mdx file');
    const mdxPage = auditReport.analyses.find(a => a.file.includes('guide.mdx'));
    assert(mdxPage && mdxPage.title === 'MDX Guide', 'Frontmatter title extracted from mdx');
    assert(mdxPage && mdxPage.images.total === 1 && mdxPage.images.emptyAlt === 1, 'Markdown image missing alt detected');
    assert(mdxPage && mdxPage.headings.total >= 2, 'Markdown headings extracted');
    const cli = spawnSync(process.execPath, [path.join(SKILL_ROOT, 'scripts', 'cli.mjs'), 'video', '--json'], { cwd: mDir, encoding: 'utf8' });
    assert(cli.status === 0, 'CLI router dispatches vertical commands');
  } finally { cleanupDir(mDir); }






  console.log(`\n==============================================`);
  console.log(`Phase 2 Test Results: ${passed} passed, ${failed} failed`);
  console.log(`==============================================\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Phase 2 Test Suite Error:', err);
  process.exit(1);
});
