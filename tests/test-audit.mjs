#!/usr/bin/env node

/**
 * SPS SEO Enterprise Test Suite
 * Validates deterministic audit engine, AST tokenizer, auto-fixer,
 * internal links graph, cannibalization, schema validator, OG generator,
 * IndexNow ping, competitor analyzer, perf budget, SERP preview, i18n, and badge.
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
import { analyzeCompetitors } from '../scripts/competitor-intel.mjs';
import { scanPerformanceBudget } from '../scripts/perf-budget.mjs';
import { generateSerpPreview } from '../scripts/preview-serp.mjs';
import { validateI18n } from '../scripts/i18n-seo.mjs';
import { generateBadge } from '../scripts/badge.mjs';
import { scanSecurityAndBestPractices } from '../scripts/security-check.mjs';
import { analyzeKeywords } from '../scripts/keyword-check.mjs';
import { analyzeTfIdf } from '../scripts/tfidf-analyzer.mjs';
import { evaluateRankingProbability } from '../scripts/ranking-intel.mjs';
import { optimizeSnippets } from '../scripts/snippet-optimizer.mjs';
import { auditRedirects } from '../scripts/redirect-audit.mjs';
import { analyzeBacklinks } from '../scripts/backlink-intel.mjs';
import { compareSeo } from '../scripts/seo-compare.mjs';

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
        <body><img src="/banner.png" /></body>
      </html>
    `);

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
    fs.writeFileSync(path.join(linkDir, 'pages/index.html'), `<a href="/about">About</a><a href="/features">click here</a>`);
    fs.writeFileSync(path.join(linkDir, 'pages/about.html'), `<a href="/">Home</a>`);
    fs.writeFileSync(path.join(linkDir, 'pages/pricing.html'), `<h1>Pricing</h1>`);

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
    fs.writeFileSync(path.join(cannDir, 'src/pages/page1.html'), `<title>Best Cloud Tool</title><h1>Cloud Platform</h1>`);
    fs.writeFileSync(path.join(cannDir, 'src/pages/page2.html'), `<title>Best Cloud Tool</title><h1>Cloud Platform</h1>`);

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
  } finally {
    cleanupDir(pingDir);
  }

  // TEST 10: Competitor Intelligence & Content Gap Matrix
  const compDir = createTempDir('sps-seo-test-comp-');
  try {
    console.log('\nTest 10: Competitor Intelligence & Content Gap Matrix');
    fs.mkdirSync(path.join(compDir, 'app'), { recursive: true });
    fs.writeFileSync(path.join(compDir, 'app/page.tsx'), `<h1>Local Cloud Services</h1><h2>Container Hosting</h2>`);
    fs.writeFileSync(path.join(compDir, 'sps-seo-config.json'), JSON.stringify({
      targeting: { competitors: ['https://competitor.com'] }
    }));

    const mockCompetitorHtml = `
      <html>
        <head><title>Competitor - Multi-Cloud Enterprise</title></head>
        <body>
          <h1>Competitor Cloud</h1>
          <h2>Zero-Trust Security</h2>
          <h2>Disaster Recovery Orchestration</h2>
          <script type="application/ld+json">{"@type":"Product","name":"CloudOS"}</script>
        </body>
      </html>
    `;

    const compResult = await analyzeCompetitors({
      cwd: compDir,
      urls: ['https://competitor.com'],
      mockHtmlMap: { 'https://competitor.com': mockCompetitorHtml }
    });

    assert(compResult.competitorsCount === 1, 'Analyzed competitor profile');
    assert(compResult.missingTopics.length >= 2, 'Identified topic gaps (Zero-Trust Security, Disaster Recovery)');
    assert(fs.existsSync(path.join(compDir, 'sps-seo-competitor-matrix.md')), 'Generated competitor matrix markdown report');
  } finally {
    cleanupDir(compDir);
  }

  // TEST 11: Core Web Vitals & Asset Budget Scanner
  const perfDir = createTempDir('sps-seo-test-perf-');
  try {
    console.log('\nTest 11: Core Web Vitals & Asset Budget Scanner');
    fs.mkdirSync(path.join(perfDir, 'public'), { recursive: true });
    // Create a 250KB heavy dummy image file
    const heavyBuffer = Buffer.alloc(250 * 1024, 0);
    fs.writeFileSync(path.join(perfDir, 'public/huge-banner.png'), heavyBuffer);
    // Create a template with an img missing width/height
    fs.writeFileSync(path.join(perfDir, 'index.html'), `<img src="/huge-banner.png" />`);

    const perfResult = scanPerformanceBudget({ cwd: perfDir, json: true });
    assert(perfResult.metrics.heavyImages.length === 1, 'Accurately flagged image exceeding 200KB');
    assert(perfResult.metrics.missingDimensionsCount === 1, 'Flagged img tag missing width/height attributes (CLS Guard)');
    assert(perfResult.score < 90, `Penalized asset budget score (Actual: ${perfResult.score})`);
  } finally {
    cleanupDir(perfDir);
  }

  // TEST 12: Visual SERP & Social Previewer
  const prevDir = createTempDir('sps-seo-test-prev-');
  try {
    console.log('\nTest 12: Visual SERP & Social Previewer');
    fs.mkdirSync(path.join(prevDir, 'public'), { recursive: true });
    fs.writeFileSync(path.join(prevDir, 'sps-seo-config.json'), JSON.stringify({
      site: { name: 'HyperScale', url: 'https://hyperscale.io' },
      metadata: { defaultTitle: 'HyperScale - Ultra Low Latency Compute' }
    }));

    const prevResult = generateSerpPreview({ cwd: prevDir });
    assert(fs.existsSync(prevResult.previewPath), 'Generated public/seo-preview.html');
    const htmlContent = fs.readFileSync(prevResult.previewPath, 'utf8');
    assert(htmlContent.includes('Google Desktop SERP Result'), 'Included Google Desktop SERP section');
    assert(htmlContent.includes('Twitter / X Social Preview Card'), 'Included Twitter/X card preview');
    assert(htmlContent.includes('Google AI Overview'), 'Included AI Overview citation preview');
  } finally {
    cleanupDir(prevDir);
  }

  // TEST 13: Multilingual i18n & hreflang Reciprocity Engine
  const i18nDir = createTempDir('sps-seo-test-i18n-');
  try {
    console.log('\nTest 13: Multilingual i18n & hreflang Reciprocity Engine');
    fs.mkdirSync(path.join(i18nDir, 'public'), { recursive: true });
    fs.writeFileSync(path.join(i18nDir, 'index.html'), `
      <head>
        <link rel="alternate" hreflang="en" href="https://example.com/en" />
        <link rel="alternate" hreflang="es" href="https://example.com/es" />
        <link rel="alternate" hreflang="x-default" href="https://example.com/" />
      </head>
    `);

    const i18nResult = validateI18n({ cwd: i18nDir, json: true, silent: true });
    assert(i18nResult.isMultilingual === true, 'Detected multilingual hreflang implementation');
    assert(i18nResult.totalTags === 3, 'Extracted all 3 hreflang tags');
    assert(i18nResult.isValid === true, 'Passed ISO code and x-default validation');
  } finally {
    cleanupDir(i18nDir);
  }

  // TEST 14: Live SVG SEO Score Badge Generator
  const badgeDir = createTempDir('sps-seo-test-badge-');
  try {
    console.log('\nTest 14: Live SVG SEO Score Badge Generator');
    fs.mkdirSync(path.join(badgeDir, 'public'), { recursive: true });
    fs.writeFileSync(path.join(badgeDir, 'index.html'), `
      <!DOCTYPE html>
      <html>
        <head><title>Badge Test Site</title><meta name="description" content="A test site for badges." /></head>
        <body><main><h1>Badge Site</h1></main></body>
      </html>
    `);
    fs.writeFileSync(path.join(badgeDir, 'robots.txt'), 'User-agent: *\nAllow: /');
    fs.writeFileSync(path.join(badgeDir, 'sitemap.xml'), '<urlset></urlset>');
    fs.writeFileSync(path.join(badgeDir, 'llms.txt'), '# Knowledge');
    fs.writeFileSync(path.join(badgeDir, 'sps-seo-config.json'), '{"site":{}}');

    const badgeResult = await generateBadge({ cwd: badgeDir });
    assert(fs.existsSync(badgeResult.badgeFile), 'Created seo-score-badge.svg');
    assert(badgeResult.svg.includes('SEO'), 'Contains SEO badge label');
    assert(badgeResult.svg.includes(`${badgeResult.score}/100`), 'Contains exact numerical score in SVG');
  } finally {
    cleanupDir(badgeDir);
  }

  // TEST 15: Enterprise Security & Best Practices Scanner
  const secDir = createTempDir('sps-seo-test-sec-');
  try {
    console.log('\nTest 15: Enterprise Security & Best Practices Scanner');
    fs.mkdirSync(path.join(secDir, 'public'), { recursive: true });

    // Mock vercel.json with all security headers
    const vercelConfig = {
      headers: [
        {
          source: '/(.*)',
          headers: [
            { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
            { key: 'Content-Security-Policy', value: "default-src 'self'" },
            { key: 'X-Frame-Options', value: 'DENY' },
            { key: 'X-Content-Type-Options', value: 'nosniff' },
            { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
            { key: 'Permissions-Policy', value: 'camera=(), microphone=()' }
          ]
        }
      ]
    };
    fs.writeFileSync(path.join(secDir, 'vercel.json'), JSON.stringify(vercelConfig, null, 2));

    // Expose a sensitive file in public directory
    fs.writeFileSync(path.join(secDir, 'public/.env.local'), 'SECRET_KEY=leak');

    // Create an HTML template with mixed content, zoom lock, and deprecated tag
    fs.writeFileSync(path.join(secDir, 'index.html'), `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
          <title>Security Test Site</title>
        </head>
        <body>
          <main>
            <h1>Security Test</h1>
            <center>Old center tag</center>
            <img src="http://insecure-cdn.com/asset.png" alt="Insecure Asset" width="100" height="100" />
          </main>
        </body>
      </html>
    `);

    const secResult = scanSecurityAndBestPractices({ projectDir: secDir, json: true });

    assert(secResult.headers.items.hsts.present, 'Detected HSTS header in vercel.json');
    assert(secResult.headers.items.csp.present, 'Detected CSP header in vercel.json');
    assert(secResult.headers.items.xFrameOptions.present, 'Detected X-Frame-Options in vercel.json');
    assert(secResult.exposure.exposedFilesCount === 1, 'Flagged exposed .env.local in public directory');
    assert(secResult.templates.mixedContentCount === 1, 'Flagged insecure http:// asset');
    assert(secResult.templates.viewportIssuesCount === 1, 'Flagged viewport user-scalable=no zoom lock');
    assert(secResult.templates.deprecatedTagCount === 1, 'Flagged deprecated <center> tag');
  } finally {
    cleanupDir(secDir);
  }

  // TEST 16: Keyword Prominence & Density Analyzer
  const kwDir = createTempDir('sps-seo-test-kw-');
  try {
    console.log('\nTest 16: Keyword Prominence & Density Analyzer');
    fs.writeFileSync(path.join(kwDir, 'index.html'), `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Cloud Compute - High Speed Infrastructure</title>
          <meta name="description" content="Deploy cloud compute nodes across 50 global edge regions." />
        </head>
        <body>
          <main>
            <h1>Cloud Compute Solutions</h1>
            <p>Our cloud compute architecture empowers engineering teams with scalable compute instances and zero latency infrastructure.</p>
            <img src="/banner.png" alt="Cloud Compute Cluster" />
          </main>
        </body>
      </html>
    `);

    const kwResult = analyzeKeywords({ projectDir: kwDir, keyword: 'cloud compute', json: true });
    assert(kwResult.pagesAnalyzed === 1, 'Analyzed 1 page for keywords');
    assert(kwResult.pages[0].primaryCount >= 3, 'Counted at least 3 occurrences of target keyword');
    assert(kwResult.pages[0].prominence.inTitle, 'Detected keyword in title tag');
    assert(kwResult.pages[0].prominence.inH1, 'Detected keyword in H1 heading');
    assert(kwResult.pages[0].prominence.inImageAlt, 'Detected keyword in image alt text');
  } finally {
    cleanupDir(kwDir);
  }

  // TEST 17: Algorithmic TF*IDF Semantic Analyzer
  const tfidfDir = createTempDir('sps-seo-test-tfidf-');
  try {
    console.log('\nTest 17: Algorithmic TF*IDF Semantic Analyzer');
    fs.writeFileSync(path.join(tfidfDir, 'page1.html'), `
      <html><body><p>Enterprise cloud latency infrastructure benchmark for distributed systems.</p></body></html>
    `);
    fs.writeFileSync(path.join(tfidfDir, 'page2.html'), `
      <html><body><p>Serverless edge compute workers with low latency and global replication.</p></body></html>
    `);

    const tfidfResult = analyzeTfIdf({ projectDir: tfidfDir, json: true });
    assert(tfidfResult.documentsAnalyzed === 2, 'Parsed 2 documents for TF*IDF');
    assert(tfidfResult.vocabularySize > 0, 'Extracted non-empty vocabulary');
    assert(tfidfResult.globalTopTerms.length > 0, 'Computed global top authority terms');
  } finally {
    cleanupDir(tfidfDir);
  }

  // TEST 18: SERP Ranking Probability Engine
  const rankDir = createTempDir('sps-seo-test-rank-');
  try {
    console.log('\nTest 18: SERP Ranking Probability Engine');
    fs.writeFileSync(path.join(rankDir, 'index.html'), `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Cloud Compute Guide</title>
        </head>
        <body>
          <main>
            <h1>Cloud Compute Guide</h1>
            <h2>How Cloud Compute Works</h2>
            <p>Comprehensive guide to deploying scalable cloud compute instances across global regions.</p>
            <ol><li>Step 1: Choose instance</li><li>Step 2: Deploy</li></ol>
            <a href="/pricing">View Pricing</a>
          </main>
        </body>
      </html>
    `);

    const rankResult = evaluateRankingProbability({ projectDir: rankDir, keyword: 'cloud compute', json: true });
    assert(rankResult.pagesEvaluated === 1, 'Evaluated 1 page for ranking probability');
    assert(rankResult.pages[0].probabilityScore > 30, 'Generated positive ranking probability score');
    assert(rankResult.pages[0].breakdown.keywordProminence > 0, 'Awarded keyword prominence points');
  } finally {
    cleanupDir(rankDir);
  }

  // TEST 19: Featured Snippet & Answer Capsule Optimizer
  const snippetDir = createTempDir('sps-seo-test-snip-');
  try {
    console.log('\nTest 19: Featured Snippet & Answer Capsule Optimizer');
    fs.writeFileSync(path.join(snippetDir, 'index.html'), `
      <!DOCTYPE html>
      <html>
        <body>
          <h2>What is cloud compute?</h2>
          <p>Cloud compute is a modern on-demand infrastructure delivery model providing scalable virtual servers, containerized workloads, high-speed storage, and raw processing power over secure global networks without requiring local hardware procurement, physical data center maintenance, or upfront capital expenditure for growing businesses worldwide.</p>
          <ol><li>Configure instance</li><li>Deploy container</li></ol>
        </body>
      </html>
    `);

    const snipResult = optimizeSnippets({ projectDir: snippetDir, json: true });
    assert(snipResult.totalQuestionHeadings === 1, 'Detected question-based heading');
    assert(snipResult.totalOptimalCapsules === 1, 'Validated 40-60 word answer capsule');
    assert(snipResult.findings[0].hasOrderedLists, 'Detected ordered list for procedural snippet');
  } finally {
    cleanupDir(snippetDir);
  }

  // TEST 20: Redirects, Chains & Trailing Slash Auditor
  const redirDir = createTempDir('sps-seo-test-redir-');
  try {
    console.log('\nTest 20: Redirects, Chains & Trailing Slash Auditor');
    const vercelConfig = {
      redirects: [
        { source: '/old-path', destination: '/new-path', permanent: true },
        { source: '/temp-path', destination: '/target', permanent: false }
      ]
    };
    fs.writeFileSync(path.join(redirDir, 'vercel.json'), JSON.stringify(vercelConfig, null, 2));

    const redirResult = await auditRedirects({ projectDir: redirDir, json: true });
    assert(redirResult.configRedirectCount === 2, 'Parsed 2 redirect rules from vercel.json');
    const tempWarnings = redirResult.findings.filter(f => f.msg.includes('Temporary redirect'));
    assert(tempWarnings.length === 1, 'Flagged temporary 302/307 redirect');
  } finally {
    cleanupDir(redirDir);
  }

  // TEST 21: Backlink Equity & Digital PR Engine
  const backlinkDir = createTempDir('sps-seo-test-bl-');
  try {
    console.log('\nTest 21: Backlink Equity & Digital PR Engine');
    fs.writeFileSync(path.join(backlinkDir, 'index.html'), `
      <html><body><main><a href="https://external-resource.org">External Authority</a></main></body></html>
    `);
    fs.writeFileSync(path.join(backlinkDir, 'sps-seo-config.json'), '{"site":{"name":"CloudCorp","url":"https://cloudcorp.io"},"keywords":{"primary":"cloud compute"}}');

    const blResult = analyzeBacklinks({ projectDir: backlinkDir, json: true });
    assert(blResult.outboundSummary.totalOutbound === 1, 'Detected outbound link');
    assert(blResult.unlinkedMentionQueries.length > 0, 'Generated unlinked brand mention search queries');
    assert(blResult.outreachPitch.subject.includes('cloud compute'), 'Generated contextual PR pitch');
  } finally {
    cleanupDir(backlinkDir);
  }

  // TEST 22: Side-by-Side Competitive Benchmark
  const dirA = createTempDir('sps-seo-test-compA-');
  const dirB = createTempDir('sps-seo-test-compB-');
  try {
    console.log('\nTest 22: Side-by-Side Competitive Benchmark');
    fs.writeFileSync(path.join(dirA, 'index.html'), `<html><head><title>Site A</title></head><body><main><h1>A</h1><p>Fast compute.</p></main></body></html>`);
    fs.writeFileSync(path.join(dirB, 'index.html'), `<html><head><title>Site B</title></head><body><main><h1>B</h1><p>Enterprise compute.</p></main></body></html>`);

    const compResult = await compareSeo({ pathA: dirA, pathB: dirB });
    assert(Array.isArray(compResult.rows), 'Generated comparison rows');
    assert(compResult.rows.length > 0, 'Rows count is greater than 0');
  } finally {
    cleanupDir(dirA);
    cleanupDir(dirB);
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
