#!/usr/bin/env node

/**
 * SPS SEO Keyword Cannibalization & Meta Duplication Detector
 * Version: 1.0.0
 * 
 * Identifies:
 * - Duplicate title tags across pages
 * - Duplicate meta descriptions across pages
 * - Overlapping keyword targeting (cannibalization)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CWD = process.cwd();

// TF-IDF keyword overlap detection (v1.3.0)
const STOPWORDS = new Set(['a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'being', 'but', 'by', 'can', 'could', 'did', 'do', 'does', 'doing', 'done', 'each', 'for', 'from', 'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'him', 'his', 'how', 'if', 'in', 'into', 'is', 'it', 'its', 'just', 'me', 'my', 'no', 'not', 'of', 'on', 'once', 'only', 'or', 'other', 'our', 'ours', 'out', 'over', 'own', 'same', 'she', 'should', 'so', 'some', 'such', 'than', 'that', 'the', 'their', 'theirs', 'them', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'will', 'with', 'would', 'you', 'your', 'yours', 'i', 'am', 'get', 'got', 'use', 'used', 'using', 'also', 'one', 'two', 'three']);
const TFIDF_OVERLAP_THRESHOLD = 0.5;
const TFIDF_TOP_N = 25;

function computeTfIdfOverlaps(pages) {
  if (pages.length < 2) return [];

  // Tokenize each page's visible text
  const pageTokens = [];
  const docFreq = new Map();
  for (const p of pages) {
    const text = extractVisibleText(p._raw || '');
    const tokens = (text.toLowerCase().match(/[a-z][a-z0-9_-]{1,}/g) || [])
      .filter(t => !STOPWORDS.has(t) && !/^\d+$/.test(t));
    pageTokens.push(tokens);
    const unique = new Set(tokens);
    for (const t of unique) docFreq.set(t, (docFreq.get(t) || 0) + 1);
  }

  const N = pages.length;
  // Per-page top-N terms by TF-IDF
  const topTermsPerPage = pageTokens.map(tokens => {
    const tf = new Map();
    for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
    const total = tokens.length || 1;
    const scored = [];
    for (const [term, count] of tf) {
      const idf = Math.log((N + 1) / ((docFreq.get(term) || 0) + 1)) + 1;
      scored.push([term, (count / total) * idf]);
    }
    scored.sort((a, b) => b[1] - a[1]);
    return new Set(scored.slice(0, TFIDF_TOP_N).map(([t]) => t));
  });

  // Pairwise Jaccard
  const overlaps = [];
  for (let i = 0; i < topTermsPerPage.length; i++) {
    for (let j = i + 1; j < topTermsPerPage.length; j++) {
      const a = topTermsPerPage[i];
      const b = topTermsPerPage[j];
      const inter = new Set([...a].filter(x => b.has(x))).size;
      const union = new Set([...a, ...b]).size;
      const jaccard = union === 0 ? 0 : inter / union;
      if (jaccard >= TFIDF_OVERLAP_THRESHOLD) {
        overlaps.push({
          pageA: pages[i].file,
          pageB: pages[j].file,
          jaccard: +jaccard.toFixed(3),
          sharedTerms: [...a].filter(x => b.has(x)).slice(0, 10)
        });
      }
    }
  }
  return overlaps.sort((a, b) => b.jaccard - a.jaccard);
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

function extractPageMetadata(filePath) {
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }

  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(content) ||
                     /title:\s*["'`]([^"'`]+)["'`]/i.exec(content);
  const title = titleMatch ? titleMatch[1].trim() : null;

  const descMatch = /<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']/i.exec(content) ||
                    /<meta\s+content=["']([\s\S]*?)["']\s+name=["']description["']/i.exec(content) ||
                    /description:\s*["'`]([^"'`]+)["'`]/i.exec(content);
  const description = descMatch ? descMatch[1].trim() : null;

  const h1Match = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(content);
  const h1 = h1Match ? h1Match[1].replace(/<[^>]+>/g, '').trim() : null;

  return { title, description, h1, _raw: content };
}

export function detectCannibalization(options = {}) {
  const projectDir = options.cwd || CWD;
  const fileExts = ['.html', '.astro', '.tsx', '.jsx', '.vue', '.svelte', '.md', '.mdx'];
  const IGNORED = ['node_modules', '.git', '.next', 'dist', 'build'];

  const pages = [];

  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (IGNORED.includes(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(full);
      } else if (e.isFile() && fileExts.includes(path.extname(e.name))) {
        // Exclude root shell layouts and documents
        if (e.name.startsWith('_') || e.name.includes('layout')) continue;

        const meta = extractPageMetadata(full);
        if (meta && (meta.title || meta.h1)) {
          pages.push({
            file: path.relative(projectDir, full),
            title: meta.title,
            description: meta.description,
            h1: meta.h1,
            _raw: meta._raw
          });
        }
      }
    }
  }

  walk(projectDir);

  // TF-IDF based keyword overlap detection (v1.3.0)
  // For each pair of pages, compute the Jaccard similarity of their top-N
  // distinguishing terms. Pages with very high overlap likely compete for
  // the same queries even when their titles differ.
  const tfidfOverlaps = computeTfIdfOverlaps(pages);

  // Group by Title
  const titleMap = new Map();
  const descMap = new Map();
  const h1Map = new Map();

  for (const p of pages) {
    if (p.title) {
      const t = p.title.toLowerCase();
      if (!titleMap.has(t)) titleMap.set(t, []);
      titleMap.get(t).push(p.file);
    }
    if (p.description) {
      const d = p.description.toLowerCase();
      if (!descMap.has(d)) descMap.set(d, []);
      descMap.get(d).push(p.file);
    }
    if (p.h1) {
      const h = p.h1.toLowerCase();
      if (!h1Map.has(h)) h1Map.set(h, []);
      h1Map.get(h).push(p.file);
    }
  }

  const duplicateTitles = [];
  for (const [title, files] of titleMap.entries()) {
    if (files.length > 1) duplicateTitles.push({ title, files });
  }

  const duplicateDescriptions = [];
  for (const [desc, files] of descMap.entries()) {
    if (files.length > 1) duplicateDescriptions.push({ desc, files });
  }

  const duplicateH1s = [];
  for (const [h1, files] of h1Map.entries()) {
    if (files.length > 1) duplicateH1s.push({ h1, files });
  }

  const isHealthy = duplicateTitles.length === 0
    && duplicateDescriptions.length === 0
    && duplicateH1s.length === 0
    && tfidfOverlaps.length === 0;

  const result = {
    timestamp: new Date().toISOString(),
    pagesAnalyzed: pages.length,
    duplicateTitles,
    duplicateDescriptions,
    duplicateH1s,
    tfidfOverlaps,
    isHealthy
  };

  if (options.json || process.argv.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
    return result;
  }

  console.log('\n====================================================');
  console.log(' SPS SEO CANNIBALIZATION & META DUPLICATION AUDIT   ');
  console.log('====================================================\n');

  console.log(`Pages Analyzed: ${pages.length}\n`);

  if (isHealthy) {
    console.log('✓ All pages feature distinct titles, meta descriptions, and H1 tags.');
    console.log('✓ Zero internal keyword cannibalization detected!\n');
    return result;
  }

  if (duplicateTitles.length > 0) {
    console.log(`❌ ${duplicateTitles.length} Duplicate Title(s) Detected across multiple pages:`);
    duplicateTitles.forEach(d => {
      console.log(`   └─ "${d.title}" used in:`);
      d.files.forEach(f => console.log(`       • ${f}`));
    });
    console.log('');
  }

  if (duplicateDescriptions.length > 0) {
    console.log(`⚠️ ${duplicateDescriptions.length} Duplicate Meta Description(s) Detected:`);
    duplicateDescriptions.forEach(d => {
      console.log(`   └─ "${d.desc.slice(0, 60)}..." used in:`);
      d.files.forEach(f => console.log(`       • ${f}`));
    });
    console.log('');
  }

  if (duplicateH1s.length > 0) {
    console.log(`⚠️ ${duplicateH1s.length} Duplicate H1 Tag(s) Detected:`);
    duplicateH1s.forEach(d => {
      console.log(`   └─ "${d.h1}" used in:`);
      d.files.forEach(f => console.log(`       • ${f}`));
    });
    console.log('');
  }

  if (tfidfOverlaps.length > 0) {
    console.log(`⚠️ ${tfidfOverlaps.length} TF-IDF Keyword Overlap(s) Detected (Jaccard ≥ 0.50):`);
    tfidfOverlaps.slice(0, 5).forEach(o => {
      console.log(`   └─ ${o.jaccard.toFixed(2)} similarity:`);
      console.log(`       A: ${o.pageA}`);
      console.log(`       B: ${o.pageB}`);
      console.log(`       Shared terms: ${o.sharedTerms.join(', ')}`);
    });
    if (tfidfOverlaps.length > 5) console.log(`   └─ ...and ${tfidfOverlaps.length - 5} more.`);
    console.log('   These pages likely compete for the same queries even if titles differ.');
    console.log('   Action: differentiate by adding unique long-tail subtopics, or consolidate with a 301.\n');
  }

  console.log('Actionable Advice:');
  console.log('  1. Differentiate titles to target unique long-tail query variations.');
  console.log('  2. Ensure each page has a unique primary H1 focused on its distinct topic.\n');

  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  detectCannibalization();
}
