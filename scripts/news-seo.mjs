#!/usr/bin/env node

/**
 * SPS SEO — News SEO Audit
 * Version: 1.4.0
 *
 * Zero-dependency News vertical scanner:
 *  1. NewsArticle JSON-LD validation (headline, dates, author, image, publisher logo)
 *  2. Date freshness analysis
 *  3. News sitemap detection (news-sitemap.xml with <news:news> namespace)
 *  4. isAccessibleForFree paywall declaration check
 *
 * Output: 0-100 News SEO Score + per-page findings (--json supported).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { walkFiles, IGNORE_DIRS, isMain } from './lib/core.mjs';

const CWD = process.cwd();

function extractJsonLd(content) {
  const blocks = [];
  const regex = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = regex.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(m[1].trim());
      if (Array.isArray(parsed)) blocks.push(...parsed);
      else blocks.push(parsed);
    } catch {
      blocks.push({ __invalid: true });
    }
  }
  return blocks;
}

export function runNewsSeoAudit(options = {}) {
  const projectDir = options.cwd ? path.resolve(options.cwd) : CWD;
  const jsonOutput = options.json || process.argv.includes('--json');

  const pages = walkFiles(projectDir, {
    ignoreDirs: IGNORE_DIRS,
    extraIgnore: new Set(['public'])
  });

  const pageReports = [];
  const findings = [];
  let totalScore = 100;
  const penalize = (amt) => { totalScore -= amt; };

  let newsPages = 0;
  const now = Date.now();
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

  for (const file of pages) {
    let content;
    try { content = fs.readFileSync(file, 'utf8'); } catch { continue; }

    const report = { file: path.relative(projectDir, file), hasNewsSchema: false, issues: [] };

    const blocks = extractJsonLd(content);
    const news = blocks.filter(b => String(b['@type'] || '') === 'NewsArticle');
    if (news.length === 0) { pageReports.push(report); continue; }

    report.hasNewsSchema = true;
    newsPages++;

    for (const article of news) {
      if (!article.headline) {
        findings.push({ severity: 'high', file: report.file, msg: 'NewsArticle missing "headline" — required for Top Stories eligibility.', fix: 'Add a headline <= 110 characters.' });
        penalize(10);
      } else if (article.headline.length > 110) {
        findings.push({ severity: 'medium', file: report.file, msg: `NewsArticle headline exceeds 110 characters (${article.headline.length}).`, fix: 'Shorten the headline.' });
        penalize(5);
      }
      if (!article.datePublished) {
        findings.push({ severity: 'high', file: report.file, msg: 'NewsArticle missing datePublished — required for news ranking signals.', fix: 'Add ISO 8601 datePublished.' });
        penalize(8);
      } else if (Number.isNaN(Date.parse(article.datePublished))) {
        findings.push({ severity: 'medium', file: report.file, msg: 'NewsArticle datePublished is not valid ISO 8601.', fix: 'Use e.g. 2026-01-15T08:00:00+00:00.' });
        penalize(4);
      } else if (now - Date.parse(article.datePublished) > THIRTY_DAYS) {
        findings.push({ severity: 'info', file: report.file, msg: 'NewsArticle older than 30 days — refresh content and bump dateModified for freshness signals.', fix: 'Update content; add dateModified.' });
      }
      if (!article.author || (Array.isArray(article.author) && article.author.length === 0)) {
        findings.push({ severity: 'medium', file: report.file, msg: 'NewsArticle missing author — weakens E-E-A-T.', fix: 'Add author Person with name and url.' });
        penalize(5);
      }
      if (!article.image || (Array.isArray(article.image) && article.image.length === 0)) {
        findings.push({ severity: 'medium', file: report.file, msg: 'NewsArticle missing image — required for Top Stories carousel.', fix: 'Add a large (>= 1200px wide) image URL.' });
        penalize(5);
      }
      const pub = article.publisher || {};
      if (!pub.name || !pub.logo) {
        findings.push({ severity: 'medium', file: report.file, msg: 'NewsArticle publisher missing name or logo.', fix: 'Add publisher Organization with logo ImageObject.' });
        penalize(5);
      }
      if (!('isAccessibleForFree' in article)) {
        findings.push({ severity: 'info', file: report.file, msg: 'isAccessibleForFree not declared — declare false for paywalled news to keep rich results.', fix: 'Add "isAccessibleForFree": false plus paywalled-section markup.' });
      }
    }

    pageReports.push(report);
  }

  // News sitemap detection
  const newsSitemapFiles = ['public/news-sitemap.xml', 'news-sitemap.xml', 'public/sitemap-news.xml'];
  let hasNewsSitemap = newsSitemapFiles.some(rel => fs.existsSync(path.join(projectDir, rel)));
  if (!hasNewsSitemap) {
    for (const rel of ['public/sitemap.xml', 'sitemap.xml']) {
      const p = path.join(projectDir, rel);
      if (fs.existsSync(p) && /<news:news>/i.test(fs.readFileSync(p, 'utf8'))) {
        hasNewsSitemap = true;
        break;
      }
    }
  }

  if (newsPages > 0 && !hasNewsSitemap) {
    findings.push({
      severity: 'medium',
      file: null,
      msg: 'News content detected but no news sitemap (news-sitemap.xml).',
      fix: 'Create a news sitemap with articles from the last 48 hours using <news:news> tags.'
    });
    penalize(8);
  }

  totalScore = Math.max(0, Math.min(100, Math.round(totalScore)));
  const grade = totalScore >= 90 ? 'A' : totalScore >= 75 ? 'B' : totalScore >= 50 ? 'C' : 'F';

  const result = {
    timestamp: new Date().toISOString(),
    score: totalScore,
    grade,
    pagesScanned: pageReports.length,
    newsArticlePages: newsPages,
    hasNewsSitemap,
    pageReports,
    findings
  };

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return result;
  }

  console.log('\n====================================================');
  console.log('          SPS SEO NEWS AUDIT REPORT                 ');
  console.log('====================================================\n');
  console.log(`News SEO Score: ${result.score}/100 (Grade: ${result.grade})`);
  console.log(`Pages scanned: ${result.pagesScanned} | NewsArticle pages: ${newsPages} | News sitemap: ${hasNewsSitemap ? '✓' : '✗'}`);
  for (const f of findings) {
    console.log(`  [${f.severity.toUpperCase()}] ${f.file || 'site'}: ${f.msg}`);
  }
  if (findings.length === 0) console.log('  ✓ No news SEO issues detected.');
  console.log('');
  return result;
}

if (isMain(import.meta.url)) {
  try { runNewsSeoAudit(); } catch (err) {
    console.error('News SEO audit error:', err);
    process.exit(1);
  }
}
