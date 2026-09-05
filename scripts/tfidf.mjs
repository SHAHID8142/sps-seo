#!/usr/bin/env node

/**
 * SPS SEO TF-IDF & Keyword Coverage Analyzer
 * Version: 1.3.0
 *
 * Pure-Node implementation (no native deps). For each scanned page:
 *  - Tokenizes visible text (strip HTML/scripts/styles)
 *  - Computes TF-IDF vectors across the local corpus
 *  - For each target keyword in sps-seo-config.json:
 *      * reports TF-IDF weight of keyword in this page
 *      * reports coverage gap vs the corpus average
 *      * flags missing keyword in title / meta / H1 / URL / first-100-words
 *  - Cosine similarity matrix between pages (catches near-duplicate content)
 *  - Top-30 distinguishing terms per page (terms with the highest TF-IDF)
 *
 * Use: detect content thinness, keyword gaps, and unintended duplication.
 */

import fs from 'node:fs';
import path from 'node:path';

const CWD = process.cwd();

const IGNORE_DIRS = new Set([
  'node_modules', '.git', '.next', '.nuxt', '.svelte-kit', '.astro',
  'dist', 'build', 'out', '.cache', 'coverage', '.gemini', 'scratch',
  '.sps', '.agents', 'public'
]);

const SCAN_EXTS = new Set(['.html', '.htm', '.astro', '.tsx', '.jsx', '.vue', '.svelte', '.md', '.mdx']);

// Minimal English stopwords; extend by editing this list
const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'being', 'but', 'by', 'can',
  'could', 'did', 'do', 'does', 'doing', 'done', 'each', 'for', 'from', 'had',
  'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'him', 'his', 'how',
  'if', 'in', 'into', 'is', 'it', 'its', 'just', 'me', 'my', 'no', 'not', 'of',
  'on', 'once', 'only', 'or', 'other', 'our', 'ours', 'out', 'over', 'own',
  'same', 'she', 'should', 'so', 'some', 'such', 'than', 'that', 'the', 'their',
  'theirs', 'them', 'then', 'there', 'these', 'they', 'this', 'those', 'through',
  'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we', 'were', 'what',
  'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'will', 'with', 'would',
  'you', 'your', 'yours', 'i', 'am', 'get', 'got', 'use', 'used', 'using', 'also',
  'one', 'two', 'three', 's', 't', 'm', 're', 've', 'll', 'd'
]);

const TOKENIZE_REGEX = /[a-z][a-z0-9_-]{1,}/g; // English-ish tokens, length ≥ 2

export function runTfidfAudit(options = {}) {
  const projectDir = options.cwd || CWD;
  const config = loadConfig(projectDir);

  const pages = extractPages(projectDir);
  if (pages.length === 0) {
    const result = { timestamp: new Date().toISOString(), score: null, note: 'No scannable pages found.' };
    if (options.json || process.argv.includes('--json')) { console.log(JSON.stringify(result, null, 2)); return result; }
    console.log('\n====================================================');
    console.log('   SPS SEO TF-IDF & KEYWORD COVERAGE ANALYZER       ');
    console.log('====================================================\n');
    console.log('  No scannable pages found.\n');
    return result;
  }

  // Tokenize each page (visible text only)
  const pageTokens = pages.map(p => tokenize(p.text));
  // Document frequency: for each term, how many pages contain it
  const df = new Map();
  for (const tokens of pageTokens) {
    const unique = new Set(tokens);
    for (const t of unique) df.set(t, (df.get(t) || 0) + 1);
  }
  const N = pages.length;

  // Per-page TF-IDF
  const pageTfidf = pageTokens.map((tokens, i) => computeTfidf(tokens, df, N));
  // IDF lookup for keyword analysis
  const idf = new Map();
  for (const [term, count] of df) {
    idf.set(term, Math.log((N + 1) / (count + 1)) + 1); // smooth IDF
  }

  // ─── 1. Keyword coverage analysis ───
  const keywordReport = [];
  const targetKeywords = [
    ...(config.metadata?.keywords || []),
    ...(config.metadata?.secondaryKeywords || []),
  ].filter(Boolean);

  if (targetKeywords.length === 0) {
    keywordReport.push({ note: 'No target keywords configured. Add metadata.keywords and metadata.secondaryKeywords to sps-seo-config.json.' });
  } else {
    for (const kw of targetKeywords) {
      const kwLower = kw.toLowerCase();
      const coverage = analyzeKeywordCoverage(pages, pageTfidf, kwLower, idf);
      keywordReport.push(coverage);
    }
  }

  // ─── 2. Per-page distinguishing terms ───
  const topTermsPerPage = pageTfidf.map((tfidf, i) => {
    const top = [...tfidf.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
    return { file: pages[i].file, topTerms: top.map(([t, w]) => ({ term: t, weight: +w.toFixed(3) })) };
  });

  // ─── 3. Pairwise cosine similarity (duplicate-content detection) ───
  const duplicates = [];
  for (let i = 0; i < pageTfidf.length; i++) {
    for (let j = i + 1; j < pageTfidf.length; j++) {
      const sim = cosine(pageTfidf[i], pageTfidf[j]);
      if (sim >= 0.7) {
        duplicates.push({
          pageA: pages[i].file,
          pageB: pages[j].file,
          similarity: +sim.toFixed(3)
        });
      }
    }
  }
  duplicates.sort((a, b) => b.similarity - a.similarity);

  // ─── 4. Score ───
  let score = 100;
  const findings = [];
  const weights = { high: 8, medium: 4, low: 2 };

  // Penalize thin pages (< 100 tokens)
  let thinPages = 0;
  for (let i = 0; i < pages.length; i++) {
    if (pageTokens[i].length < 100) thinPages++;
  }
  if (thinPages > 0) {
    findings.push({ severity: 'medium', msg: `${thinPages} page(s) have fewer than 100 visible tokens (thin content).` });
    score -= Math.min(30, thinPages * 4);
  }

  // Penalize keyword gaps
  for (const r of keywordReport) {
    if (!r.note) {
      for (const p of r.pages || []) {
        if (!p.inTitle && !p.inH1) {
          findings.push({
            severity: 'medium',
            msg: `Keyword "${r.keyword}" missing from title AND H1 on ${p.file}.`
          });
          score -= 3;
        } else if (!p.inTitle || !p.inH1) {
          findings.push({
            severity: 'low',
            msg: `Keyword "${r.keyword}" missing from ${!p.inTitle ? 'title' : 'H1'} on ${p.file}.`
          });
          score -= 1.5;
        }
      }
      // Penalize pages where keyword is absent entirely (no coverage)
      const missing = (r.pages || []).filter(p => p.tfidfWeight === 0).length;
      if (missing > 0 && r.pages && r.pages.length > 0) {
        const pct = missing / r.pages.length;
        if (pct > 0.5) {
          findings.push({
            severity: 'medium',
            msg: `Keyword "${r.keyword}" absent from ${missing}/${r.pages.length} target pages (${Math.round(pct * 100)}%).`
          });
          score -= 5;
        }
      }
    }
  }

  // Penalize high duplicate similarity
  if (duplicates.length > 0) {
    const severe = duplicates.filter(d => d.similarity >= 0.85);
    if (severe.length > 0) {
      findings.push({
        severity: 'high',
        msg: `${severe.length} page pair(s) with cosine similarity ≥ 0.85 — likely duplicate content.`
      });
      score -= Math.min(30, severe.length * 10);
    } else {
      findings.push({
        severity: 'medium',
        msg: `${duplicates.length} page pair(s) with cosine similarity ≥ 0.70 — review for unintentional duplication.`
      });
      score -= Math.min(15, duplicates.length * 3);
    }
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 55 ? 'C' : 'F';

  const result = {
    timestamp: new Date().toISOString(),
    score,
    grade,
    pagesAnalyzed: pages.length,
    keywordReport,
    duplicates,
    topTermsPerPage: topTermsPerPage.slice(0, 10),
    thinPages,
    findings
  };

  if (options.json || process.argv.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
    return result;
  }
  printConsole(result);
  return result;
}

function loadConfig(projectDir) {
  const candidates = ['sps-seo-config.json', 'sps-seo-config.example.json'];
  for (const c of candidates) {
    const p = path.join(projectDir, c);
    if (fs.existsSync(p)) {
      try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch {}
    }
  }
  return {};
}

function extractPages(projectDir) {
  const pages = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (IGNORE_DIRS.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.isFile() && SCAN_EXTS.has(path.extname(e.name).toLowerCase())) {
        let content;
        try { content = fs.readFileSync(full, 'utf8'); } catch { continue; }
        const text = extractVisibleText(content);
        if (text.length < 50) continue;
        pages.push({
          file: path.relative(projectDir, full),
          text,
          raw: content
        });
      }
    }
  }
  walk(projectDir);
  return pages;
}

function extractVisibleText(content) {
  return content
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<template\b[\s\S]*?<\/template>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\{[^}]+\}/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text) {
  const tokens = [];
  const matches = text.toLowerCase().match(TOKENIZE_REGEX);
  if (!matches) return tokens;
  for (const m of matches) {
    if (STOPWORDS.has(m)) continue;
    if (/^\d+$/.test(m)) continue;
    tokens.push(m);
  }
  return tokens;
}

function computeTfidf(tokens, df, N) {
  const tf = new Map();
  for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
  const total = tokens.length || 1;
  const tfidf = new Map();
  for (const [term, count] of tf) {
    const idf = Math.log((N + 1) / ((df.get(term) || 0) + 1)) + 1;
    tfidf.set(term, (count / total) * idf);
  }
  return tfidf;
}

function cosine(a, b) {
  let dot = 0, magA = 0, magB = 0;
  for (const [k, va] of a) {
    magA += va * va;
    const vb = b.get(k);
    if (vb !== undefined) dot += va * vb;
  }
  for (const [, vb] of b) magB += vb * vb;
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

function analyzeKeywordCoverage(pages, pageTfidf, keyword, idf) {
  const keywordTokens = keyword.split(/\s+/).filter(Boolean);
  if (keywordTokens.length === 0) return { keyword, note: 'empty' };

  const pageReports = [];
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    const tfidf = pageTfidf[i];
    let weight = 0;
    // Multi-word keyword: sum TF-IDF of constituent tokens (approximation)
    for (const kt of keywordTokens) weight += (tfidf.get(kt) || 0);

    // Phrase match in text?
    const phrasePresent = p.text.toLowerCase().includes(keyword);
    const inTitle = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(p.raw)?.[1]?.toLowerCase().includes(keyword) ||
                     /title:\s*["'`]([^"'`]+)["'`]/i.exec(p.raw)?.[1]?.toLowerCase().includes(keyword);
    const inH1 = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(p.raw)?.[1]?.replace(/<[^>]+>/g, '').toLowerCase().includes(keyword);
    const inFirst100 = p.text.toLowerCase().slice(0, 500).includes(keyword);
    const inMetaDesc = /<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']/i.exec(p.raw)?.[1]?.toLowerCase().includes(keyword) ||
                       /description:\s*["'`]([^"'`]+)["'`]/i.exec(p.raw)?.[1]?.toLowerCase().includes(keyword);
    const inUrl = p.file.toLowerCase().includes(keyword.replace(/\s+/g, '-')) || p.file.toLowerCase().includes(keyword.replace(/\s+/g, ''));

    pageReports.push({
      file: p.file,
      tfidfWeight: +weight.toFixed(3),
      phrasePresent,
      inTitle: !!inTitle,
      inH1: !!inH1,
      inMetaDesc: !!inMetaDesc,
      inFirst100: !!inFirst100,
      inUrl: !!inUrl
    });
  }

  return { keyword, pages: pageReports };
}

function printConsole(result) {
  console.log('\n====================================================');
  console.log('   SPS SEO TF-IDF & KEYWORD COVERAGE ANALYZER       ');
  console.log('====================================================\n');
  if (result.score === null) {
    console.log(`  ${result.note}\n`);
    return;
  }
  console.log(`TF-IDF Health Score: ${result.score}/100 (Grade: ${result.grade})`);
  console.log(`Pages analyzed: ${result.pagesAnalyzed}`);
  if (result.thinPages > 0) console.log(`Thin-content pages: ${result.thinPages}`);
  console.log(`Duplicate-content pairs (cosine ≥ 0.7): ${result.duplicates.length}\n`);

  // Keyword report
  if (result.keywordReport && result.keywordReport[0]?.note) {
    console.log(`  ${result.keywordReport[0].note}\n`);
  } else if (result.keywordReport && result.keywordReport.length > 0) {
    console.log('Keyword coverage (per target keyword, per page):');
    for (const r of result.keywordReport) {
      console.log(`\n  "${r.keyword}" — ${r.pages.length} page(s) analyzed`);
      for (const p of r.pages) {
        const marks = [
          p.inTitle ? 'T' : '-',
          p.inH1 ? 'H' : '-',
          p.inMetaDesc ? 'M' : '-',
          p.inFirst100 ? 'F' : '-',
          p.inUrl ? 'U' : '-',
        ].join('');
        console.log(`    ${p.tfidfWeight.toFixed(3).padStart(7)}  [${marks}]  ${p.file}  (T=title, H=h1, M=meta, F=first100, U=url)`);
      }
    }
    console.log('');
  }

  if (result.duplicates.length > 0) {
    console.log('Duplicate-content pairs:');
    for (const d of result.duplicates.slice(0, 10)) {
      console.log(`  ${d.similarity.toFixed(2)}  ${d.pageA}  ≈  ${d.pageB}`);
    }
    if (result.duplicates.length > 10) console.log(`  ...and ${result.duplicates.length - 10} more.`);
    console.log('');
  }

  if (result.findings.length > 0) {
    console.log('Findings:');
    for (const f of result.findings) {
      const icon = f.severity === 'high' ? '❌' : f.severity === 'medium' ? '⚠️' : 'ℹ️';
      console.log(`  ${icon} ${f.msg}`);
    }
    console.log('');
  }

  // Top terms per page (sample)
  if (result.topTermsPerPage && result.topTermsPerPage.length > 0) {
    console.log('Top distinguishing terms per page (sample):');
    for (const t of result.topTermsPerPage.slice(0, 5)) {
      console.log(`\n  ${t.file}`);
      console.log(`    ${t.topTerms.slice(0, 8).map(x => `${x.term}(${x.weight})`).join(', ')}`);
    }
    console.log('');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  runTfidfAudit();
}
