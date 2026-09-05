#!/usr/bin/env node

/**
 * SPS SEO Keyword Placement Audit
 * Version: 1.3.0
 *
 * For each target keyword in sps-seo-config.json (metadata.keywords +
 * metadata.secondaryKeywords), audit each page for placement:
 *  - <title>: required
 *  - <meta description>: recommended
 *  - <h1>: required
 *  - URL / file path: recommended
 *  - First 100 words of body: recommended
 *  - One image alt: optional but helpful
 *  - Schema.org JSON-LD: optional
 *
 * Also reports:
 *  - Keyword stuffing (> 5% density) — penalty (Aggarwal et al. 2024)
 *  - Total page word count (thin-content flag)
 *  - Missing H1 entirely
 *
 * Output: 0-100 Keyword Coverage Score + per-keyword × per-page matrix.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeKeywords } from './keyword-check.mjs';
import { captureConsole } from './lib/core.mjs';

const CWD = process.cwd();

const IGNORE_DIRS = new Set([
  'node_modules', '.git', '.next', '.nuxt', '.svelte-kit', '.astro',
  'dist', 'build', 'out', '.cache', 'coverage', '.gemini', 'scratch',
  '.sps', '.agents', 'public'
]);

const SCAN_EXTS = new Set(['.html', '.htm', '.astro', '.tsx', '.jsx', '.vue', '.svelte', '.md', '.mdx']);

const STUFFING_DENSITY = 0.05; // 5%
const THIN_CONTENT_WORDS = 100;

export function runKeywordAudit(options = {}) {
  const projectDir = options.cwd || CWD;
  const config = loadConfig(projectDir);
  const keywords = [
    ...(config.metadata?.keywords || []),
    ...(config.metadata?.secondaryKeywords || []),
  ].filter(Boolean);

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
        pages.push({ file: path.relative(projectDir, full), content });
      }
    }
  }
  walk(projectDir);

  const findings = [];
  let totalScore = 100;

  // Page-level analysis
  const pageAnalyses = pages.map(p => analyzePage(p));
  // Per-keyword × per-page matrix
  const keywordMatrix = [];
  if (keywords.length === 0) {
    findings.push({
      severity: 'info',
      msg: 'No target keywords configured. Add metadata.keywords and metadata.secondaryKeywords to sps-seo-config.json to enable coverage analysis.'
    });
  } else {
    for (const kw of keywords) {
      const kwLower = kw.toLowerCase();
      const perPage = pageAnalyses.map(pa => ({
        file: pa.file,
        placements: analyzePlacements(pa, kwLower),
        density: pa.density[kwLower] || 0,
        stuffing: (pa.density[kwLower] || 0) > STUFFING_DENSITY
      }));
      keywordMatrix.push({ keyword: kw, perPage });
    }
  }

  // Score penalties
  let thinCount = 0;
  let noH1Count = 0;
  for (const pa of pageAnalyses) {
    if (pa.wordCount < THIN_CONTENT_WORDS) {
      thinCount++;
      findings.push({
        severity: 'medium',
        msg: `Thin content (${pa.wordCount} words): ${pa.file}`
      });
    }
    if (!pa.hasH1) {
      noH1Count++;
      findings.push({
        severity: 'high',
        msg: `Missing <h1>: ${pa.file}`
      });
    }
  }
  if (thinCount > 0) totalScore -= Math.min(25, thinCount * 4);
  if (noH1Count > 0) totalScore -= Math.min(20, noH1Count * 5);

  // Keyword placement penalties
  for (const m of keywordMatrix) {
    let missingTitle = 0;
    let missingH1 = 0;
    for (const pp of m.perPage) {
      if (!pp.placements.inTitle) missingTitle++;
      if (!pp.placements.inH1) missingH1++;
      if (pp.stuffing) {
        findings.push({
          severity: 'high',
          msg: `Keyword stuffing: "${m.keyword}" density ${(pp.density * 100).toFixed(2)}% > ${STUFFING_DENSITY * 100}% on ${pp.file} (GEO penalty: -10% to -30% AI visibility).`
        });
        totalScore -= 5;
      }
    }
    if (missingH1 > 0 && m.perPage.length > 0) {
      findings.push({
        severity: 'medium',
        msg: `"${m.keyword}" missing from H1 on ${missingH1}/${m.perPage.length} pages.`
      });
      totalScore -= Math.min(15, missingH1 * 3);
    }
    if (missingTitle > 0 && m.perPage.length > 0) {
      findings.push({
        severity: 'medium',
        msg: `"${m.keyword}" missing from title on ${missingTitle}/${m.perPage.length} pages.`
      });
      totalScore -= Math.min(10, missingTitle * 2);
    }
  }

  totalScore = Math.max(0, Math.min(100, Math.round(totalScore)));
  const grade = totalScore >= 90 ? 'A' : totalScore >= 75 ? 'B' : totalScore >= 55 ? 'C' : 'F';

  const result = {
    timestamp: new Date().toISOString(),
    score: totalScore,
    grade,
    pagesAnalyzed: pages.length,
    keywordsTargeted: keywords.length,
    pageAnalyses: pageAnalyses.map(pa => ({
      file: pa.file,
      wordCount: pa.wordCount,
      hasH1: pa.hasH1,
      title: pa.title,
      metaDescription: pa.metaDescription,
      url: pa.url
    })),
    keywordMatrix,
    findings
  };

// [v1.4 composed] Merge the deprecated standalone companion engine into this unified report.
  try {
    const jsonMode = options.json || process.argv.includes('--json');
    result.companion = jsonMode
      ? captureConsole(() => analyzeKeywords({ json: true })).result
      : analyzeKeywords({});
  } catch (e) {
    result.companion = { error: e.message };
  }

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

function analyzePage(p) {
  const c = p.content;
  const stripped = c
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ');

  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(stripped)?.[1]?.trim()
    || /title:\s*["'`]([^"'`]+)["'`]/i.exec(stripped)?.[1]?.trim()
    || null;
  const metaDescription = /<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']/i.exec(stripped)?.[1]?.trim()
    || /description:\s*["'`]([^"'`]+)["'`]/i.exec(stripped)?.[1]?.trim()
    || null;
  const canonical = /<link\b[^>]*\brel\s*=\s*["']canonical["'][^>]*?\bhref\s*=\s*["']([^"']+)["']/i.exec(stripped)?.[1]
    || /canonical:\s*["'`]([^"'`]+)["'`]/i.exec(stripped)?.[1]
    || null;
  const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(stripped)?.[1]?.replace(/<[^>]+>/g, '').trim() || null;

  const visibleText = stripped.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const words = visibleText.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  // Density per keyword (lazy; caller passes keywords)
  const density = {};
  const lower = visibleText.toLowerCase();
  const tokens = lower.split(/\s+/);
  if (tokens.length > 0) {
    // Will be populated per-keyword in analyzePlacements
  }

  // URL: derive from file path (very rough)
  const url = '/' + p.file
    .replace(/^(?:app|src\/app|pages|src\/pages)\//, '')
    .replace(/\.(tsx|jsx|ts|js|astro|vue|svelte|html|htm|md|mdx)$/, '')
    .replace(/\/index$/, '/')
    .replace(/\[|\]/g, '')
    .toLowerCase();

  // Image alts
  const altList = [];
  const imgAltRegex = /<img\b[^>]*?\balt\s*=\s*["']([^"']*)["']/gi;
  let m;
  while ((m = imgAltRegex.exec(stripped)) !== null) altList.push(m[1]);
  const altText = altList.join(' ');

  return {
    file: p.file,
    title,
    metaDescription,
    canonical,
    h1,
    url,
    altText,
    hasH1: !!h1,
    wordCount,
    density,
    visibleText: lower,
    alts: altList
  };
}

function analyzePlacements(pageAnalysis, keyword) {
  const p = pageAnalysis;
  const inTitle = (p.title || '').toLowerCase().includes(keyword);
  const inMetaDesc = (p.metaDescription || '').toLowerCase().includes(keyword);
  const inH1 = (p.h1 || '').toLowerCase().includes(keyword);
  const inUrl = p.file.toLowerCase().includes(keyword.replace(/\s+/g, '-')) ||
                p.file.toLowerCase().includes(keyword.replace(/\s+/g, '')) ||
                p.url.toLowerCase().includes(keyword.replace(/\s+/g, '-'));
  const inFirst100 = p.visibleText.slice(0, 600).includes(keyword); // ~100 words
  const inAlt = p.altText.toLowerCase().includes(keyword);

  // Density
  const total = p.visibleText.split(/\s+/).filter(Boolean).length || 1;
  const occurrences = (p.visibleText.match(new RegExp(`\\b${escapeRegex(keyword)}\\b`, 'g')) || []).length;
  p.density[keyword] = occurrences / total;

  return { inTitle, inMetaDesc, inH1, inUrl, inFirst100, inAlt };
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function printConsole(result) {
  console.log('\n====================================================');
  console.log('     SPS SEO KEYWORD PLACEMENT AUDIT                 ');
  console.log('====================================================\n');
  console.log(`Keyword Score: ${result.score}/100 (Grade: ${result.grade})`);
  console.log(`Pages analyzed: ${result.pagesAnalyzed}`);
  console.log(`Keywords targeted: ${result.keywordsTargeted}\n`);

  // Per-keyword matrix
  if (result.keywordMatrix && result.keywordMatrix.length > 0) {
    for (const m of result.keywordMatrix) {
      console.log(`"${m.keyword}" — placements per page:`);
      for (const pp of m.perPage) {
        const marks = [
          pp.placements.inTitle ? 'T' : '-',
          pp.placements.inMetaDesc ? 'M' : '-',
          pp.placements.inH1 ? 'H' : '-',
          pp.placements.inUrl ? 'U' : '-',
          pp.placements.inFirst100 ? 'F' : '-',
          pp.placements.inAlt ? 'A' : '-',
        ].join('');
        const density = `${(pp.density * 100).toFixed(2)}%`;
        const stuff = pp.stuffing ? ' ⚠️ STUFFING' : '';
        console.log(`  ${density.padStart(7)}  [${marks}]  ${pp.file}${stuff}`);
      }
      console.log('');
    }
    console.log('  Legend: T=title, M=meta desc, H=H1, U=URL, F=first 100 words, A=image alt');
    console.log('');
  }

  // Findings
  if (result.findings.length > 0) {
    const order = ['high', 'medium', 'low', 'info'];
    const icons = { high: '❌', medium: '⚠️', low: 'ℹ️', info: 'ℹ️' };
    for (const sev of order) {
      const items = result.findings.filter(f => f.severity === sev);
      for (const f of items) {
        console.log(`  ${icons[sev]} [${sev.toUpperCase()}] ${f.msg}`);
      }
    }
    console.log('');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  runKeywordAudit();
}
