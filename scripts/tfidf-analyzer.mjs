#!/usr/bin/env node

/**
 * SPS SEO - Algorithmic TF*IDF & Semantic Co-occurrence Analyzer
 *
 * Deterministic Term Frequency - Inverse Document Frequency engine:
 * 1. Tokenizes project pages into unigrams and bigrams (excluding stop words)
 * 2. Computes mathematical TF, IDF, and TF*IDF weights for each term across the site
 * 3. Identifies top semantic authority terms and core entities
 * 4. Highlights under-represented semantic concepts needed for topical authority
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CWD = process.cwd();

const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can', 'cannot', 'could',
  'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'has', 'have',
  'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'i', 'if', 'in', 'into',
  'is', 'it', 'its', 'itself', 'just', 'll', 'm', 'me', 'more', 'most', 'my', 'myself', 'no', 'nor', 'not', 'now',
  'of', 'off', 'on', 'once', 'only', 'or', 'other', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 're', 's',
  'same', 'she', 'should', 'so', 'some', 'such', 't', 'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves',
  'then', 'there', 'these', 'they', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was',
  'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'will', 'with', 'won', 'would',
  'you', 'your', 'yours', 'yourself', 'yourselves'
]);

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

/**
 * Tokenize text into valid unigrams and bigrams
 */
function tokenize(text) {
  const clean = text.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ');
  const rawTokens = clean.split(/\s+/).filter(t => t.length > 2 && !STOP_WORDS.has(t));
  
  const tokens = [...rawTokens];

  // Also extract meaningful bigrams
  for (let i = 0; i < rawTokens.length - 1; i++) {
    const t1 = rawTokens[i];
    const t2 = rawTokens[i + 1];
    if (t1 && t2) {
      tokens.push(`${t1} ${t2}`);
    }
  }

  return tokens;
}

export function analyzeTfIdf(options = {}) {
  const projectDir = options.projectDir ? path.resolve(options.projectDir) : CWD;

  const files = walkDir(projectDir, (name) => {
    return TEMPLATE_EXTS.has(path.extname(name).toLowerCase());
  });

  const docs = [];
  const allTerms = new Set();

  for (const file of files) {
    let content = '';
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }

    const relPath = path.relative(projectDir, file);
    const body = stripHtml(content);
    const tokens = tokenize(body);
    if (tokens.length === 0) continue;

    const termCounts = new Map();
    for (const token of tokens) {
      termCounts.set(token, (termCounts.get(token) || 0) + 1);
      allTerms.add(token);
    }

    docs.push({
      file: relPath,
      totalTokens: tokens.length,
      termCounts
    });
  }

  const numDocs = docs.length;
  if (numDocs === 0) {
    const emptyResult = {
      timestamp: new Date().toISOString(),
      documentsAnalyzed: 0,
      vocabularySize: 0,
      topTerms: []
    };
    if (options.json) console.log(JSON.stringify(emptyResult, null, 2));
    return emptyResult;
  }

  // Calculate Inverse Document Frequency (IDF) for every term
  const idfMap = new Map();
  for (const term of allTerms) {
    let docCount = 0;
    for (const doc of docs) {
      if (doc.termCounts.has(term)) docCount++;
    }
    // Standard smoothed IDF: ln(1 + N / df) + 1
    const idf = Math.log(1 + (numDocs / docCount)) + 1;
    idfMap.set(term, idf);
  }

  // Calculate TF*IDF for each document and global top terms
  const globalTfIdf = new Map();

  const docAnalyses = docs.map(doc => {
    const scoredTerms = [];
    for (const [term, count] of doc.termCounts.entries()) {
      const tf = count / doc.totalTokens;
      const idf = idfMap.get(term) || 1;
      const tfidf = tf * idf;

      scoredTerms.push({
        term,
        count,
        tf: Number(tf.toFixed(4)),
        idf: Number(idf.toFixed(4)),
        tfidf: Number(tfidf.toFixed(4))
      });

      globalTfIdf.set(term, (globalTfIdf.get(term) || 0) + tfidf);
    }

    scoredTerms.sort((a, b) => b.tfidf - a.tfidf);

    return {
      file: doc.file,
      totalTokens: doc.totalTokens,
      topTerms: scoredTerms.slice(0, 10)
    };
  });

  // Global top authority terms
  const globalRanked = Array.from(globalTfIdf.entries())
    .map(([term, score]) => ({
      term,
      score: Number(score.toFixed(4)),
      idf: Number((idfMap.get(term) || 0).toFixed(4))
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 25);

  const result = {
    timestamp: new Date().toISOString(),
    documentsAnalyzed: numDocs,
    vocabularySize: allTerms.size,
    globalTopTerms: globalRanked,
    documents: docAnalyses
  };

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return result;
  }

  // Formatted Console Output
  console.log('\n====================================================');
  console.log('       SPS SEO ALGORITHMIC TF*IDF ANALYZER          ');
  console.log('====================================================\n');

  console.log(`Documents Analyzed: ${numDocs} template(s)`);
  console.log(`Unique Vocabulary:  ${allTerms.size} distinct unigram & bigram entities\n`);

  console.log('Top Domain Authority Terms (Global TF*IDF):');
  for (let i = 0; i < Math.min(12, globalRanked.length); i++) {
    const item = globalRanked[i];
    const bar = '█'.repeat(Math.min(25, Math.round(item.score * 150)));
    console.log(`  ${(i + 1).toString().padStart(2)}. ${item.term.padEnd(24)} [Score: ${item.score.toFixed(4)}] ${bar}`);
  }

  console.log('\nDocument-Level Salient Terms:');
  for (const doc of docAnalyses.slice(0, 5)) {
    const topKeywords = doc.topTerms.slice(0, 5).map(t => `${t.term} (${t.tfidf})`).join(', ');
    console.log(`  📄 ${doc.file} (${doc.totalTokens} tokens):`);
    console.log(`     └─ Salient Entities: ${topKeywords}`);
  }

  console.log('\nTopical Authority Insights:');
  console.log('  - High TF*IDF bigrams represent your core semantic entities for Google knowledge graphs.');
  console.log('  - Ensure terms appearing in global authority also appear naturally in your primary layout and pillar articles.\n');

  return result;
}

// Auto-run if executed directly
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  // [v1.4 deprecated] Forward to the canonical unified entrypoint
  console.warn('⚠️  Deprecated entrypoint: tfidf-analyzer.mjs is now composed into ./tfidf.mjs. Forwarding...\n');
  const { spawnSync } = await import('node:child_process');
  const res = spawnSync(process.execPath, [
    path.join(path.dirname(fileURLToPath(import.meta.url)), 'tfidf.mjs'),
    ...process.argv.slice(2)
  ], { stdio: 'inherit' });
  process.exit(res.status ?? 0);
}
