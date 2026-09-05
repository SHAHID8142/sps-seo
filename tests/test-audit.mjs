#!/usr/bin/env node

/**
 * SPS SEO Test Suite
 * Validates deterministic audit engine, AST tokenizer, framework detection,
 * and 100-point scoring.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { runAudit } from '../scripts/audit.mjs';

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
  console.log('🧪 Starting SPS SEO Test Suite...\n');
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

  // TEST 1: Next.js App Router Mock Project
  const nextDir = createTempDir('sps-seo-test-next-');
  try {
    console.log('Test 1: Next.js App Router Detection & Scoring');
    fs.writeFileSync(path.join(nextDir, 'package.json'), JSON.stringify({
      name: 'test-next-app',
      dependencies: { next: '^15.0.0', react: '^19.0.0' }
    }));
    fs.mkdirSync(path.join(nextDir, 'app'), { recursive: true });
    
    // Layout with metadata, title, canonical, OG, Twitter, and JSON-LD
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

    // Page with single H1, normal H2, and images with alt
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

    // Robots and sitemap
    fs.writeFileSync(path.join(nextDir, 'robots.txt'), 'User-agent: *\nAllow: /');
    fs.writeFileSync(path.join(nextDir, 'sitemap.xml'), '<urlset></urlset>');
    fs.writeFileSync(path.join(nextDir, 'llms.txt'), '# Knowledge Base');
    fs.writeFileSync(path.join(nextDir, 'sps-seo-config.json'), '{"site":{}}');

    const report = await runAudit({ cwd: nextDir, json: true });

    assert(report.framework.type === 'nextjs', 'Correctly identified Next.js');
    assert(report.framework.variant === 'app-router', 'Correctly identified App Router');
    assert(report.categories.semantics.h1Issues === 0, 'Zero H1 issues detected');
    assert(report.categories.schemaAndAi.missingAlt === 0, '100% image alt coverage');
    assert(report.categories.schemaAndAi.jsonLd === true, 'JSON-LD detected');
    assert(report.score >= 90, `Earned Grade A score (Actual: ${report.score})`);
  } finally {
    cleanupDir(nextDir);
  }

  // TEST 2: Astro Project with Missing Alt & Skipped Heading
  const astroDir = createTempDir('sps-seo-test-astro-');
  try {
    console.log('\nTest 2: Astro Detection & Anomaly Flagging');
    fs.writeFileSync(path.join(astroDir, 'package.json'), JSON.stringify({
      dependencies: { astro: '^5.0.0' }
    }));
    fs.mkdirSync(path.join(astroDir, 'src/pages'), { recursive: true });

    // Page with 2 H1s, skipped H1->H3, and missing alt image
    fs.writeFileSync(path.join(astroDir, 'src/pages/index.astro'), `
      <html>
        <head>
          <title>Astro Page</title>
        </head>
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
          <main>
            <h1>Static Site Heading</h1>
          </main>
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
