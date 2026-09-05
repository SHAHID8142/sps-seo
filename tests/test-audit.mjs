#!/usr/bin/env node

/**
 * SPS SEO Comprehensive Test Suite
 * Validates deterministic audit engine, AST tokenizer, auto-fixer,
 * internal links graph, cannibalization, schema validator, OG generator,
 * and IndexNow ping.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { runAudit } from '../scripts/audit.mjs';
import { runAutoFix } from '../scripts/fix.mjs';
import { analyzeInternalLinks } from '../scripts/internal-links.mjs';
import { detectCannibalization } from '../scripts/cannibalization.mjs';
import { validateSchemas } from '../scripts/validate-schema.mjs';
import { generateOgImage } from '../scripts/generate-og.mjs';
import { pingIndexNow } from '../scripts/ping-indexnow.mjs';

function createTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function cleanupDir(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

async function runTests() {
  console.log('🧪 Starting SPS SEO Comprehensive Test Suite...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  // TEST 1: Next.js App Router Detection & Scoring
  const nextDir = createTempDir('sps-seo-test-next-');
  try {
    console.log('Test 1: Next.js App Router Detection & Scoring');
    fs.writeFileSync(path.join(nextDir, 'package.json'), JSON.stringify({
      name: 'test-next-app',
      dependencies: { next: '^15.0.0', react: '^19.0.0' }
    }));
    fs.mkdirSync(path.join(nextDir, 'app'), { recursive: true });
    
    fs.writeFileSync(path.join(nextDir, 'app/layout.tsx'), `
      import type { Metadata } from 'next';
      export const metadata: Metadata = {
        title: 'Test App Title',
        description: 'Test description that has enough characters to be valid.',
        alternates: { canonical: 'https://example.com' },
        openGraph: { title: 'Test OG', description: 'Test OG Desc' },
        twitter: { card: 'summary_large_image' }
      };
      export default function RootLayout({ children }: { children: React.ReactNode }) {
        return (
          <html lang="en">
            <body>
              <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: '{"@context":"https://schema.org"}' }} />
              <header><nav>Nav</nav></header>
              <main>{children}</main>
              <footer>Footer</footer>
            </body>
          </html>
        );
      }
    `);

    fs.writeFileSync(path.join(nextDir, 'app/page.tsx'), `
      export default function Page() {
        return (
          <div>
            <h1>Main Page Heading</h1>
            <h2>Sub Heading</h2>
            <img src="/hero.jpg" alt="Hero banner image describing product" />
          </div>
        );
      }
    `);

    fs.writeFileSync(path.join(nextDir, 'robots.txt'), 'User-agent: *\nAllow: /');
    fs.writeFileSync(path.join(nextDir, 'sitemap.xml'), '<urlset></urlset>');
    fs.writeFileSync(path.join(nextDir, 'llms.txt'), '# Knowledge Base');
    fs.writeFileSync(path.join(nextDir, 'sps-seo-config.json'), '{"site":{}}');

    const report = await runAudit({ cwd: nextDir, json: true });

    assert(report.framework.type === 'nextjs', 'Correctly identified Next.js');
    assert(report.framework.variant === 'app-router', 'Correctly identified App Router');
    assert(report.categories.semantics.h1Issues === 0, 'Zero H1 issues detected');
    assert(report.categories.schemaAndAi.missingAlt === 0, '100% image alt coverage');
    assert(report.score >= 90, `Earned Grade A score (Actual: ${report.score})`);
  } finally {
    cleanupDir(nextDir);
  }

  // TEST 2: Astro Detection & Anomaly Flagging
  const astroDir = createTempDir('sps-seo-test-astro-');
  try {
    console.log('\nTest 2: Astro Detection & Anomaly Flagging');
    fs.writeFileSync(path.join(astroDir, 'package.json'), JSON.stringify({
      dependencies: { astro: '^5.0.0' }
    }));
    fs.mkdirSync(path.join(astroDir, 'src/pages'), { recursive: true });

    fs.writeFileSync(path.join(astroDir, 'src/pages/index.astro'), `
      <html>
        <head><title>Astro Page</title></head>
        <body>
          <h1>Primary Title</h1>
          <h1>Duplicate Invalid Title</h1>
          <h3>Skipped Level Title</h3>
          <img src="/unnamed.png" />
        </body>
      </html>
    `);

    const report = await runAudit({ cwd: astroDir, json: true });

    assert(report.framework.type === 'astro', 'Correctly identified Astro');
    assert(report.categories.semantics.h1Issues > 0, 'Flagged multiple H1 tags');
    assert(report.categories.semantics.skippedHeadings > 0, 'Flagged skipped heading levels');
    assert(report.categories.schemaAndAi.missingAlt === 1, 'Flagged missing image alt attribute');
    assert(report.score < 90, `Properly penalized anomalies (Actual Score: ${report.score})`);
  } finally {
    cleanupDir(astroDir);
  }

  // TEST 3: Static HTML Detection
  const htmlDir = createTempDir('sps-seo-test-html-');
  try {
    console.log('\nTest 3: Static HTML Detection');
    fs.writeFileSync(path.join(htmlDir, 'index.html'), `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Static Site</title>
          <meta name="description" content="A static site description.">
        </head>
        <body>
          <main><h1>Static Site Heading</h1></main>
        </body>
      </html>
    `);

    const report = await runAudit({ cwd: htmlDir, json: true });
    assert(report.framework.type === 'static-html', 'Correctly identified Static HTML');
    assert(report.categories.metadata.title === true, 'Detected title tag');
    assert(report.categories.metadata.description === true, 'Detected meta description');
  } finally {
    cleanupDir(htmlDir);
  }

  // TEST 4: Automated Remediation Engine (fix.mjs)
  const fixDir = createTempDir('sps-seo-test-fix-');
  try {
    console.log('\nTest 4: Automated Remediation Engine (fix.mjs)');
    fs.mkdirSync(path.join(fixDir, 'public'), { recursive: true });
    fs.writeFileSync(path.join(fixDir, 'index.html'), `
      <!DOCTYPE html>
      <html>
        <body>
          <img src="/banner.png" />
        </body>
      </html>
    `);

    // Run auto-fix
    const fixResult = await runAutoFix({ cwd: fixDir, dryRun: false });
    assert(fixResult.applied >= 3, `Applied automated remediation items (${fixResult.applied})`);
    assert(fs.existsSync(path.join(fixDir, 'public/robots.txt')), 'Generated missing robots.txt');
    assert(fs.existsSync(path.join(fixDir, 'public/sitemap.xml')), 'Generated missing sitemap.xml');
    assert(fs.existsSync(path.join(fixDir, 'public/llms.txt')), 'Generated missing llms.txt');

    const patchedHtml = fs.readFileSync(path.join(fixDir, 'index.html'), 'utf8');
    assert(patchedHtml.includes('alt="Banner preview"'), 'Successfully patched missing alt attribute');
  } finally {
    cleanupDir(fixDir);
  }

  // TEST 5: Internal Link & Orphan Page Graph Analyzer
  const linkDir = createTempDir('sps-seo-test-links-');
  try {
    console.log('\nTest 5: Internal Link & Orphan Page Graph Analyzer');
    fs.mkdirSync(path.join(linkDir, 'pages'), { recursive: true });
    
    // index links to /about with descriptive text, but links to /features with weak "click here"
    fs.writeFileSync(path.join(linkDir, 'pages/index.html'), `
      <a href="/about">Learn about our team</a>
      <a href="/features">click here</a>
    `);
    // about links back to /
    fs.writeFileSync(path.join(linkDir, 'pages/about.html'), `
      <a href="/">Home</a>
    `);
    // orphan page: /pricing is defined but never linked from anywhere
    fs.writeFileSync(path.join(linkDir, 'pages/pricing.html'), `
      <h1>Pricing</h1>
    `);

    const linkResult = analyzeInternalLinks({ cwd: linkDir, json: true });
    assert(linkResult.routesCount >= 3, `Discovered all routes (${linkResult.routesCount})`);
    assert(linkResult.orphanRoutes.includes('/pricing'), 'Accurately detected orphan route /pricing');
    assert(linkResult.weakLinks.some(w => w.rawText.toLowerCase() === 'click here'), 'Accurately flagged weak anchor "click here"');
  } finally {
    cleanupDir(linkDir);
  }

  // TEST 6: Keyword Cannibalization & Meta Duplication Detector
  const cannDir = createTempDir('sps-seo-test-cann-');
  try {
    console.log('\nTest 6: Keyword Cannibalization Detector');
    fs.mkdirSync(path.join(cannDir, 'src/pages'), { recursive: true });
    
    // Two pages with duplicate titles and identical H1s
    fs.writeFileSync(path.join(cannDir, 'src/pages/page1.html'), `
      <title>Best Cloud Tool</title>
      <h1>Cloud Platform</h1>
    `);
    fs.writeFileSync(path.join(cannDir, 'src/pages/page2.html'), `
      <title>Best Cloud Tool</title>
      <h1>Cloud Platform</h1>
    `);

    const cannResult = detectCannibalization({ cwd: cannDir, json: true });
    assert(cannResult.duplicateTitles.length === 1, 'Detected duplicate title across pages');
    assert(cannResult.duplicateH1s.length === 1, 'Detected duplicate H1 across pages');
    assert(cannResult.isHealthy === false, 'Marked health as false due to conflicts');
  } finally {
    cleanupDir(cannDir);
  }

  // TEST 7: Schema.org Validator
  const schemaDir = createTempDir('sps-seo-test-schema-');
  try {
    console.log('\nTest 7: Schema.org Syntax & Spec Validator');
    fs.mkdirSync(path.join(schemaDir, 'app'), { recursive: true });

    // Valid Organization Schema
    fs.writeFileSync(path.join(schemaDir, 'app/layout.tsx'), `
      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "Acme Cloud",
        "url": "https://example.com"
      }
      </script>
    `);

    const schemaResult = validateSchemas({ cwd: schemaDir, json: true });
    assert(schemaResult.blocksFound === 1, 'Discovered JSON-LD block');
    assert(schemaResult.errors.length === 0, 'Zero schema validation errors');
    assert(schemaResult.isValid === true, 'Passed full Schema.org validation');
  } finally {
    cleanupDir(schemaDir);
  }

  // TEST 8: Branded OpenGraph Social Card Generator
  const ogDir = createTempDir('sps-seo-test-og-');
  try {
    console.log('\nTest 8: Branded OpenGraph Card Generator');
    fs.mkdirSync(path.join(ogDir, 'public'), { recursive: true });
    fs.writeFileSync(path.join(ogDir, 'sps-seo-config.json'), JSON.stringify({
      site: { name: 'Titan OS', url: 'https://titan.dev', themeColor: '#1e1b4b' },
      metadata: { defaultTitle: 'Titan OS - Autonomous Distributed Compute' }
    }));

    const ogResult = generateOgImage({ cwd: ogDir });
    assert(fs.existsSync(ogResult.targetFile), 'Created og-image.svg');
    assert(ogResult.svg.includes('Titan OS'), 'Included site brand name in SVG');
    assert(ogResult.svg.includes('1200'), 'Proper 1200px width viewBox');
  } finally {
    cleanupDir(ogDir);
  }

  // TEST 9: IndexNow Search Engine Ping
  const pingDir = createTempDir('sps-seo-test-ping-');
  try {
    console.log('\nTest 9: IndexNow Search Engine Ping (Dry Run)');
    fs.mkdirSync(path.join(pingDir, 'public'), { recursive: true });
    fs.writeFileSync(path.join(pingDir, 'sps-seo-config.json'), JSON.stringify({
      site: { url: 'https://titan.dev' }
    }));

    const pingResult = await pingIndexNow({ cwd: pingDir, dryRun: true, urls: ['https://titan.dev/'] });
    assert(pingResult.success === true, 'IndexNow dry-run completed successfully');
    assert(pingResult.payload.host === 'titan.dev', 'Parsed correct host');
    assert(fs.existsSync(path.join(pingDir, 'public/indexnow-key.txt')), 'Generated IndexNow API key file');
  } finally {
    cleanupDir(pingDir);
  }

  console.log(`\n==============================================`);
  console.log(`Test Results: ${passed} passed, ${failed} failed`);
  console.log(`==============================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test Suite Error:', err);
  process.exit(1);
});
