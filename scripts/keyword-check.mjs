#!/usr/bin/env node

/**
 * SPS SEO - Keyword Prominence, Density & Intent Analyzer
 *
 * Deterministic, zero-dependency analyzer for:
 * 1. Exact & Secondary Keyword Density (Ideal: 1.0% - 2.5%, Stuffing Guard: >3.0%)
 * 2. Keyword Prominence (Title front-loading, H1, first 100 words, slug, meta desc, image alt)
 * 3. Search Intent Classification (Informational, Commercial, Transactional, Navigational)
 * 4. Secondary / LSI keyword coverage
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

export function analyzeKeywords(options = {}) {
  const projectDir = options.projectDir ? path.resolve(options.projectDir) : CWD;
  const config = options.config || loadConfig(projectDir);

  const targetKeyword = (options.keyword || config.keywords?.primary || 'example keyword').toLowerCase().trim();
  const secondaryKeywords = (options.secondary || config.keywords?.secondary || []).map(k => k.toLowerCase().trim());

  // Discover template files
  const templates = walkDir(projectDir, (name) => {
    return TEMPLATE_EXTS.has(path.extname(name).toLowerCase());
  });

  const pageResults = [];

  for (const file of templates) {
    let content = '';
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }

    const relPath = path.relative(projectDir, file);

    // Extract sections
    const titleMatch = /<title[^>]*>([^<]+)<\/title>/i.exec(content) ||
                       /title:\s*["']([^"']+)["']/i.exec(content);
    const title = titleMatch ? titleMatch[1].trim() : '';

    const descMatch = /<meta\b[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i.exec(content) ||
                      /description:\s*["']([^"']+)["']/i.exec(content);
    const description = descMatch ? descMatch[1].trim() : '';

    const h1Match = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(content);
    const h1Text = h1Match ? stripHtml(h1Match[1]) : '';

    const rawBody = stripHtml(content);
    const words = rawBody.toLowerCase().match(/[a-z0-9'-]+/g) || [];
    const totalWords = words.length;

    // First 100 words
    const first100Words = words.slice(0, 100).join(' ');

    // Calculate primary keyword occurrences
    const escapedKeyword = targetKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const kwRegex = new RegExp(`\\b${escapedKeyword}\\b`, 'gi');
    const primaryMatches = rawBody.match(kwRegex) || [];
    const primaryCount = primaryMatches.length;

    // Density: count of keyword occurrences * words_in_keyword / total_words * 100
    const kwWordCount = targetKeyword.split(/\s+/).length;
    const density = totalWords > 0 ? Number(((primaryCount * kwWordCount / totalWords) * 100).toFixed(2)) : 0;

    let densityVerdict = 'optimal';
    if (density < 0.8) densityVerdict = 'under-optimized';
    else if (density > 3.0) densityVerdict = 'stuffing-risk';

    // Check Prominence Checklist
    const inTitle = title.toLowerCase().includes(targetKeyword);
    const inTitleFront = title.toLowerCase().indexOf(targetKeyword) >= 0 && title.toLowerCase().indexOf(targetKeyword) < 25;
    const inH1 = h1Text.toLowerCase().includes(targetKeyword);
    const inFirst100 = first100Words.includes(targetKeyword);
    const inSlug = relPath.toLowerCase().includes(targetKeyword.replace(/\s+/g, '-'));
    const inMetaDesc = description.toLowerCase().includes(targetKeyword);

    // Check image alt coverage
    const imgRegex = /<img\b[^>]*alt=["']([^"']*)["']/gi;
    let imgMatch;
    let inImageAlt = false;
    while ((imgMatch = imgRegex.exec(content)) !== null) {
      if (imgMatch[1].toLowerCase().includes(targetKeyword)) {
        inImageAlt = true;
        break;
      }
    }

    // Prominence Score (0 - 100)
    let prominenceScore = 0;
    if (inTitle) prominenceScore += 25;
    if (inTitleFront) prominenceScore += 5; // Bonus for front-loaded title
    if (inH1) prominenceScore += 25;
    if (inFirst100) prominenceScore += 15;
    if (inMetaDesc) prominenceScore += 15;
    if (inSlug) prominenceScore += 10;
    if (inImageAlt) prominenceScore += 5;
    prominenceScore = Math.min(100, prominenceScore);

    // Secondary keywords presence
    const secondaryCoverage = secondaryKeywords.map(sec => {
      const secRegex = new RegExp(`\\b${sec.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      const matches = rawBody.match(secRegex) || [];
      return {
        keyword: sec,
        count: matches.length,
        present: matches.length > 0
      };
    });

    // Search Intent Classification
    let intent = 'Informational';
    if (/\b(?:buy|pricing|order|discount|hire|checkout|subscription|cart)\b/i.test(rawBody) ||
        /\b(?:buy|pricing|order)\b/i.test(targetKeyword)) {
      intent = 'Transactional';
    } else if (/\b(?:best|vs|compare|review|top|alternative)\b/i.test(rawBody) ||
               /\b(?:best|vs|review)\b/i.test(targetKeyword)) {
      intent = 'Commercial Investigation';
    } else if (/\b(?:login|sign in|portal|dashboard|official site)\b/i.test(rawBody)) {
      intent = 'Navigational';
    }

    pageResults.push({
      file: relPath,
      totalWords,
      primaryKeyword: targetKeyword,
      primaryCount,
      density,
      densityVerdict,
      prominence: {
        score: prominenceScore,
        inTitle,
        inTitleFront,
        inH1,
        inFirst100,
        inMetaDesc,
        inSlug,
        inImageAlt
      },
      secondaryCoverage,
      intent
    });
  }

  // Aggregate stats
  const avgDensity = pageResults.length > 0
    ? Number((pageResults.reduce((sum, p) => sum + p.density, 0) / pageResults.length).toFixed(2))
    : 0;
  const avgProminence = pageResults.length > 0
    ? Math.round(pageResults.reduce((sum, p) => sum + p.prominence.score, 0) / pageResults.length)
    : 0;

  const result = {
    timestamp: new Date().toISOString(),
    targetKeyword,
    secondaryKeywords,
    pagesAnalyzed: pageResults.length,
    averageDensity: avgDensity,
    averageProminence: avgProminence,
    pages: pageResults
  };

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return result;
  }

  // Console Output
  console.log('\n====================================================');
  console.log('       SPS SEO KEYWORD & INTENT ANALYZER           ');
  console.log('====================================================\n');

  console.log(`Target Keyword:    "${targetKeyword}"`);
  console.log(`Secondary Keys:    ${secondaryKeywords.length > 0 ? secondaryKeywords.join(', ') : 'None configured'}`);
  console.log(`Pages Analyzed:    ${pageResults.length} template(s)\n`);

  if (pageResults.length === 0) {
    console.log('  ℹ No template or HTML pages discovered to analyze.');
    return result;
  }

  for (const page of pageResults) {
    console.log(`📄 Route: ${page.file} (${page.totalWords} words, Intent: ${page.intent})`);
    console.log(`   ├─ Keyword Count:    ${page.primaryCount} occurrence(s)`);
    console.log(`   ├─ Keyword Density:  ${page.density}% [${page.densityVerdict.toUpperCase()}] (Optimal: 1.0%–2.5%)`);
    console.log(`   ├─ Prominence Score: ${page.prominence.score}/100`);
    console.log(`   │  ├─ Title Tag:     ${page.prominence.inTitle ? '✓ Present' + (page.prominence.inTitleFront ? ' (Front-loaded)' : '') : '✗ Missing'}`);
    console.log(`   │  ├─ H1 Heading:    ${page.prominence.inH1 ? '✓ Present' : '✗ Missing'}`);
    console.log(`   │  ├─ First 100 Wds: ${page.prominence.inFirst100 ? '✓ Present' : '✗ Missing'}`);
    console.log(`   │  ├─ Meta Desc:     ${page.prominence.inMetaDesc ? '✓ Present' : '✗ Missing'}`);
    console.log(`   │  └─ Image Alt:     ${page.prominence.inImageAlt ? '✓ Present' : '○ None'}`);

    if (page.secondaryCoverage.length > 0) {
      const presentCount = page.secondaryCoverage.filter(s => s.present).length;
      console.log(`   └─ Secondary LSI:    ${presentCount}/${page.secondaryCoverage.length} matched`);
    }
    console.log('');
  }

  console.log('Keyword Strategy Advice:');
  console.log('  - Keep keyword density between 1.0% and 2.5% to avoid Google spam updates.');
  console.log('  - Front-load your primary keyword within the first 30 characters of the <title> tag.');
  console.log('  - Anchor the target keyword in the first sentence or first 100 words of the body.\n');

  return result;
}

// Auto-run if executed directly
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  // [v1.4 deprecated] Forward to the canonical unified entrypoint
  console.warn('⚠️  Deprecated entrypoint: keyword-check.mjs is now composed into ./keyword-audit.mjs. Forwarding...\n');
  const { spawnSync } = await import('node:child_process');
  const res = spawnSync(process.execPath, [
    path.join(path.dirname(fileURLToPath(import.meta.url)), 'keyword-audit.mjs'),
    ...process.argv.slice(2)
  ], { stdio: 'inherit' });
  process.exit(res.status ?? 0);
}
