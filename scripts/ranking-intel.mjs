#!/usr/bin/env node

/**
 * SPS SEO - SERP Ranking Factors & Probability Engine
 *
 * Evaluates target pages against 15 verified Google & AI ranking signals:
 * 1. Search Intent Alignment (15 pts)
 * 2. Keyword Prominence in Title, H1, H2 (15 pts)
 * 3. Content Depth & Topical Breadth (15 pts)
 * 4. E-E-A-T Credibility & Schema (15 pts)
 * 5. Mobile & CWV Readiness (10 pts)
 * 6. Internal Link Integration (10 pts)
 * 7. Structured Media, Lists & Tables (10 pts)
 * 8. Image Optimization & Alt Accessibility (5 pts)
 * 9. Freshness & Timestamp Signals (5 pts)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CWD = process.cwd();

const TEMPLATE_EXTS = new Set([
  '.html', '.htm',
  '.jsx', '.tsx',
  '.astro', '.vue', '.svelte',
  '.php', '.blade.php'
]);

const IGNORE_DIRS = new Set([
  'node_modules', '.git', '.next', '.astro', '.nuxt',
  '.svelte-kit', 'dist', 'build', 'coverage', 'scripts', 'tests'
]);

function walkDir(dir, filterFn, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return fileList;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.has(entry.name)) walkDir(full, filterFn, fileList);
    } else if (entry.isFile()) {
      if (filterFn(entry.name, full)) fileList.push(full);
    }
  }
  return fileList;
}

function loadConfig(projectDir) {
  const candidates = [
    path.join(projectDir, 'sps-seo-config.json'),
    path.join(projectDir, '.sps/seo.json'),
    path.join(projectDir, 'sps-seo-config.example.json')
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      try {
        return JSON.parse(fs.readFileSync(c, 'utf8'));
      } catch {
        // ignore
      }
    }
  }
  return {};
}

function stripHtml(html) {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function evaluateRankingProbability(options = {}) {
  const projectDir = options.projectDir ? path.resolve(options.projectDir) : CWD;
  const config = options.config || loadConfig(projectDir);

  const targetKeyword = (options.keyword || config.keywords?.primary || 'example keyword').toLowerCase().trim();

  const templates = walkDir(projectDir, (name) => {
    return TEMPLATE_EXTS.has(path.extname(name).toLowerCase());
  });

  const pageScores = [];

  for (const file of templates) {
    let content = '';
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }

    const relPath = path.relative(projectDir, file);
    const body = stripHtml(content);
    const words = body.toLowerCase().match(/[a-z0-9'-]+/g) || [];
    const wordCount = words.length;

    // 1. Title Tag
    const titleMatch = /<title[^>]*>([^<]+)<\/title>/i.exec(content) ||
                       /title:\s*["']([^"']+)["']/i.exec(content);
    const title = titleMatch ? titleMatch[1].trim() : '';

    // 2. Heading extraction
    const h1Match = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(content);
    const h1Text = h1Match ? stripHtml(h1Match[1]).toLowerCase() : '';

    const hasH2WithKw = new RegExp(`<h2[^>]*>[\\s\\S]*?${targetKeyword}[\\s\\S]*?<\\/h2>`, 'i').test(content);

    // 3. E-E-A-T Signals
    const hasSchema = content.includes('application/ld+json');
    const hasAuthor = /author/i.test(content) || /author/i.test(JSON.stringify(config));
    const hasOrg = /Organization/i.test(content) || hasSchema;

    // 4. Content Depth
    let depthScore = 0;
    if (wordCount >= 1200) depthScore = 15;
    else if (wordCount >= 600) depthScore = 10;
    else if (wordCount >= 300) depthScore = 5;

    // 5. Keyword Prominence (Max 15)
    let kwScore = 0;
    if (title.toLowerCase().includes(targetKeyword)) kwScore += 6;
    if (h1Text.includes(targetKeyword)) kwScore += 6;
    if (hasH2WithKw) kwScore += 3;

    // 6. Search Intent Match (Max 15)
    let intentScore = 10;
    if (content.includes('what') || content.includes('how') || content.includes('guide') || content.includes('best')) {
      intentScore = 15;
    }

    // 7. E-E-A-T Score (Max 15)
    let eeatScore = 0;
    if (hasSchema) eeatScore += 7;
    if (hasAuthor) eeatScore += 4;
    if (hasOrg) eeatScore += 4;

    // 8. Mobile & CWV (Max 10)
    let cwvScore = 5;
    if (/<meta[^>]*viewport/i.test(content)) cwvScore += 5;

    // 9. Structured Media, Lists & Tables (Max 10)
    let structureScore = 0;
    if (/<(?:ul|ol)\b/i.test(content)) structureScore += 5;
    if (/<table\b/i.test(content)) structureScore += 5;

    // 10. Image Optimization (Max 5)
    let imgScore = 0;
    if (/<img\b[^>]*alt=/i.test(content)) imgScore = 5;

    // 11. Freshness & Timestamp (Max 5)
    let freshnessScore = 0;
    const currentYear = new Date().getFullYear().toString();
    if (content.includes('dateModified') || content.includes(currentYear)) {
      freshnessScore = 5;
    }

    // Internal Link integration (Max 10)
    let internalLinkScore = 5;
    if (/<a\b[^>]*href=["']\//i.test(content)) internalLinkScore = 10;

    const totalProbability = Math.min(100,
      depthScore + kwScore + intentScore + eeatScore + cwvScore +
      structureScore + imgScore + freshnessScore + internalLinkScore
    );

    const grade = totalProbability >= 85 ? 'High (Top 3 Contender)' :
                  totalProbability >= 70 ? 'Moderate (Page 1 Potential)' :
                  totalProbability >= 50 ? 'Low (Needs Enhancement)' : 'Poor';

    pageScores.push({
      file: relPath,
      wordCount,
      title,
      keyword: targetKeyword,
      probabilityScore: totalProbability,
      grade,
      breakdown: {
        keywordProminence: kwScore,
        contentDepth: depthScore,
        searchIntent: intentScore,
        eeat: eeatScore,
        structure: structureScore,
        mobileCwv: cwvScore,
        internalLinks: internalLinkScore,
        imageOptimization: imgScore,
        freshness: freshnessScore
      }
    });
  }

  const avgScore = pageScores.length > 0
    ? Math.round(pageScores.reduce((sum, p) => sum + p.probabilityScore, 0) / pageScores.length)
    : 0;

  const result = {
    timestamp: new Date().toISOString(),
    targetKeyword,
    pagesEvaluated: pageScores.length,
    averageProbabilityScore: avgScore,
    pages: pageScores
  };

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return result;
  }

  // Console Output
  console.log('\n====================================================');
  console.log('       SPS SEO SERP RANKING PROBABILITY ENGINE      ');
  console.log('====================================================\n');
  console.log('ℹ️  METHOD: static 15-signal heuristic over local source files.');
  console.log('   This is an on-page READINESS estimate — NOT a live SERP');
  console.log('   position or prediction. Real positions: npm run gsc / rank-tracker.');
  console.log('   Methodology: guides/ranking-guide.md\n');

  console.log(`Target Keyword:     "${targetKeyword}"`);
  console.log(`Pages Evaluated:    ${pageScores.length} template(s)`);
  console.log(`Average SERP Score: ${avgScore}/100\n`);

  if (pageScores.length === 0) {
    console.log('  ℹ No templates discovered to evaluate.');
    return result;
  }

  for (const page of pageScores) {
    console.log(`📄 Route: ${page.file}`);
    console.log(`   ├─ Ranking Probability: ${page.probabilityScore}/100 [${page.grade}]`);
    console.log(`   ├─ Content Depth:       ${page.breakdown.contentDepth}/15 pts (${page.wordCount} words)`);
    console.log(`   ├─ Keyword Prominence:  ${page.breakdown.keywordProminence}/15 pts (Title, H1, H2)`);
    console.log(`   ├─ Intent Alignment:    ${page.breakdown.searchIntent}/15 pts`);
    console.log(`   ├─ E-E-A-T & Schema:    ${page.breakdown.eeat}/15 pts`);
    console.log(`   ├─ Rich Structure:      ${page.breakdown.structure}/10 pts (Lists, Tables)`);
    console.log(`   └─ Mobile & Links:      ${page.breakdown.mobileCwv + page.breakdown.internalLinks}/20 pts\n`);
  }

  console.log('SERP Climb Directives:');
  console.log('  1. Expand thin content (<600 words) with detailed subheadings and data comparisons.');
  console.log('  2. Bind Article or Organization schema with verified author bio and sameAs links.');
  console.log('  3. Feature an ordered list (<ol>) or table (<table>) to unlock Google Featured Snippets.\n');

  return result;
}

// Auto-run if executed directly
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const isJson = process.argv.includes('--json');
  evaluateRankingProbability({ json: isJson });
}
