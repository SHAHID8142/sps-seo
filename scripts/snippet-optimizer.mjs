#!/usr/bin/env node

/**
 * SPS SEO - Featured Snippet & Answer Capsule Optimizer
 *
 * Optimizes content for Google Featured Snippets, Answer Engines & AI Overviews:
 * 1. 40–60 Word Answer Capsule detection under question headings (<h2>What is X?</h2>)
 * 2. Ordered/Numbered Process Lists (<ol>) for procedural snippet extraction
 * 3. Structured Data Comparison Tables (<table>) for multi-attribute answers
 * 4. FAQ Schema JSON-LD snippet generator for instant zero-click rich results
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractHtmlHeadings } from './lib/core.mjs';

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

function stripHtml(html) {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function optimizeSnippets(options = {}) {
  const projectDir = options.projectDir ? path.resolve(options.projectDir) : CWD;

  const templates = walkDir(projectDir, (name) => {
    return TEMPLATE_EXTS.has(path.extname(name).toLowerCase());
  });

  const snippetFindings = [];

  for (const file of templates) {
    let content = '';
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }

    const relPath = path.relative(projectDir, file);

    // 1. Detect Question Headings & Follow-up Answer Capsules (backref-free, V8-safe)
    const QUESTION_WORD = /\b(?:what|how|why|when|where|who|is|are|can|best)\b/i;
    const capsules = [];

    for (const hm of extractHtmlHeadings(content, { minLevel: 2, maxLevel: 4 })) {
      const headingText = hm.text;
      if (!QUESTION_WORD.test(headingText)) continue;
      const tag = 'h' + hm.level;
      const after = content.slice(hm.end);
      const pMatch = /^[\s\n\r]*<p[^>]*>([\s\S]*?)<\/p>/i.exec(after);
      const pText = pMatch ? stripHtml(pMatch[1]) : '';
      const words = pText.split(/\s+/).filter(Boolean);
      const wordCount = words.length;

      let status = 'missing';
      let advice = 'Add a direct 40–60 word definition paragraph immediately beneath this heading.';

      if (wordCount >= 40 && wordCount <= 65) {
        status = 'optimal';
        advice = 'Prime length (40–60 words) for Google Featured Snippets and AI Overviews.';
      } else if (wordCount > 65) {
        status = 'too-long';
        advice = `Paragraph is ${wordCount} words. Trim to 40–60 words to fit featured snippet display boundaries.`;
      } else if (wordCount > 0 && wordCount < 40) {
        status = 'too-short';
        advice = `Paragraph is only ${wordCount} words. Expand to at least 40 words with complete factual context.`;
      }

      capsules.push({
        heading: headingText,
        tag,
        paragraphSnippet: pText ? pText.slice(0, 100) + '...' : '',
        wordCount,
        status,
        advice
      });
    }

    // 2. Detect Ordered Lists (Procedural How-To Snippets)
    const hasOrderedLists = /<ol\b[^>]*>[\s\S]*?<\/ol>/i.test(content);

    // 3. Detect Comparison Data Tables
    const hasTables = /<table\b[^>]*>[\s\S]*?<\/table>/i.test(content);

    // 4. Schema FAQ detection
    const hasFaqSchema = /"FAQPage"/i.test(content);

    snippetFindings.push({
      file: relPath,
      capsulesCount: capsules.length,
      optimalCapsules: capsules.filter(c => c.status === 'optimal').length,
      capsules,
      hasOrderedLists,
      hasTables,
      hasFaqSchema
    });
  }

  // Generate Sample FAQ Schema JSON-LD snippet
  const sampleFaqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    'mainEntity': snippetFindings.flatMap(f => f.capsules.slice(0, 2)).map(c => ({
      '@type': 'Question',
      'name': c.heading,
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': c.paragraphSnippet || 'Clear direct answer.'
      }
    }))
  };

  const result = {
    timestamp: new Date().toISOString(),
    pagesScanned: snippetFindings.length,
    totalQuestionHeadings: snippetFindings.reduce((sum, f) => sum + f.capsulesCount, 0),
    totalOptimalCapsules: snippetFindings.reduce((sum, f) => sum + f.optimalCapsules, 0),
    findings: snippetFindings,
    generatedFaqSchema: sampleFaqSchema.mainEntity.length > 0 ? sampleFaqSchema : null
  };

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return result;
  }

  // Console Output
  console.log('\n====================================================');
  console.log('       SPS SEO FEATURED SNIPPET & ANSWER CAPSULES   ');
  console.log('====================================================\n');

  console.log(`Pages Scanned:            ${snippetFindings.length}`);
  console.log(`Question Headings Found:  ${result.totalQuestionHeadings}`);
  console.log(`Optimal 40-60w Capsules:  ${result.totalOptimalCapsules}\n`);

  if (snippetFindings.length === 0) {
    console.log('  ℹ No templates discovered to analyze.');
    return result;
  }

  for (const page of snippetFindings) {
    console.log(`📄 Route: ${page.file}`);
    console.log(`   ├─ Structured Formats: Lists: ${page.hasOrderedLists ? '✓' : '✗'} | Tables: ${page.hasTables ? '✓' : '✗'} | FAQ Schema: ${page.hasFaqSchema ? '✓' : '✗'}`);

    if (page.capsules.length === 0) {
      console.log('   └─ No question-based headings detected (What/How/Why).');
    } else {
      for (const cap of page.capsules.slice(0, 3)) {
        const symbol = cap.status === 'optimal' ? '✓' : '⚠️';
        console.log(`   └─ ${symbol} "${cap.heading}" (${cap.wordCount} words) -> [${cap.status.toUpperCase()}]`);
        console.log(`      └─ ${cap.advice}`);
      }
    }
    console.log('');
  }

  console.log('Featured Snippet Best Practices:');
  console.log('  1. Place direct 40–60 word answer capsules immediately below H2/H3 question headers.');
  console.log('  2. For step-by-step processes, use semantic <ol> elements with bolded step labels.');
  console.log('  3. Ingest FAQPage JSON-LD schema to double your probability of People Also Ask (PAA) inclusion.\n');

  return result;
}

// Auto-run if executed directly
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  // [v1.4 deprecated] Forward to the canonical unified entrypoint
  console.warn('⚠️  Deprecated entrypoint: snippet-optimizer.mjs is now composed into ./snippet-audit.mjs. Forwarding...\n');
  const { spawnSync } = await import('node:child_process');
  const res = spawnSync(process.execPath, [
    path.join(path.dirname(fileURLToPath(import.meta.url)), 'snippet-audit.mjs'),
    ...process.argv.slice(2)
  ], { stdio: 'inherit' });
  process.exit(res.status ?? 0);
}
