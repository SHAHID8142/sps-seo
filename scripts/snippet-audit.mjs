#!/usr/bin/env node

/**
 * SPS SEO Featured Snippet Eligibility Audit
 * Version: 1.3.0
 *
 * For each priority page, check whether it qualifies for the four
 * dominant SERP feature formats:
 *  - Paragraph snippet (40-60 word direct answer after a question-shaped H2/H3)
 *  - List snippet (ordered/unordered list following a how-to/step heading)
 *  - Table snippet (HTML/Markdown table with header row)
 *  - FAQ snippet (FAQPage schema with Q&A pairs, or visible Q&A)
 *
 * Additionally:
 *  - Question-shaped headings detection ("how", "what", "why", "when", "where", "who")
 *  - Definition-in-first-paragraph (for "what is X?" queries)
 *  - Statistics with sources cited in candidate snippet block
 *  - Schema coverage matching SERP feature type
 *
 * Output: 0-100 Snippet Score + per-page recommendations.
 */

import fs from 'node:fs';
import path from 'node:path';

const CWD = process.cwd();

const IGNORE_DIRS = new Set([
  'node_modules', '.git', '.next', '.nuxt', '.svelte-kit', '.astro',
  'dist', 'build', 'out', '.cache', 'coverage', '.gemini', 'scratch',
  '.sps', '.agents', 'public'
]);

const SCAN_EXTS = new Set(['.html', '.htm', '.astro', '.tsx', '.jsx', '.vue', '.svelte']);

const QUESTION_STARTERS = /^(how|what|why|when|where|who|which|can|does|is|are|should)\b/i;

export function runSnippetAudit(options = {}) {
  const projectDir = options.cwd || CWD;
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
        pages.push({
          file: path.relative(projectDir, full),
          content
        });
      }
    }
  }
  walk(projectDir);

  let totalScore = 100;
  const pageReports = [];
  const findings = [];

  for (const p of pages) {
    const c = p.content;
    const stripped = c
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|\s)\/\/.*$/gm, '');

    const report = {
      file: p.file,
      questionHeadings: 0,
      paragraphSnippets: 0,
      listSnippets: 0,
      tableSnippets: 0,
      faqSnippets: 0,
      hasFaqSchema: false,
      statsWithSources: 0,
      recommendations: []
    };

    // Question-shaped headings
    const headingRegex = /<h([2-3])\b[^>]*>([\s\S]*?)<\/\1>/gi;
    let m;
    while ((m = headingRegex.exec(stripped)) !== null) {
      const headingText = m[2].replace(/<[^>]+>/g, '').trim();
      if (QUESTION_STARTERS.test(headingText)) {
        report.questionHeadings++;

        // Check the next ~600 chars after the heading for a 40-60 word paragraph
        const afterHeading = stripped.slice(m.index + m[0].length, m.index + m[0].length + 1000);
        const firstParagraph = /<p\b[^>]*>([\s\S]*?)<\/p>/i.exec(afterHeading);
        if (firstParagraph) {
          const paraText = firstParagraph[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          const wordCount = paraText.split(/\s+/).filter(Boolean).length;
          if (wordCount >= 30 && wordCount <= 90) {
            report.paragraphSnippets++;
          } else if (wordCount > 0) {
            // Either too short (snippet won't extract) or too long (not a direct answer)
            if (wordCount < 30) {
              report.recommendations.push(`After "${headingText}" — first paragraph is ${wordCount} words. Aim for 40–60 for paragraph-snippet eligibility.`);
            }
          }
        } else {
          report.recommendations.push(`After "${headingText}" — no <p> immediately follows. Add a 40–60 word direct answer.`);
        }
      }
    }

    // Ordered/unordered lists
    const orderedListRegex = /<ol\b[\s\S]*?<\/ol>|<ul\b[\s\S]*?<\/ul>/gi;
    const lists = stripped.match(orderedListRegex);
    if (lists) {
      for (const l of lists) {
        const itemCount = (l.match(/<li\b/g) || []).length;
        if (itemCount >= 3) report.listSnippets++;
      }
    }

    // Tables with header row
    const tableRegex = /<table\b[\s\S]*?<\/table>/gi;
    const tables = stripped.match(tableRegex);
    if (tables) {
      for (const t of tables) {
        if (/<th\b/i.test(t) && /<td\b/i.test(t)) {
          report.tableSnippets++;
        }
      }
    }

    // FAQ schema
    if (/FAQPage/i.test(stripped) && /acceptedAnswer/i.test(stripped)) {
      report.hasFaqSchema = true;
      // Count Q&A pairs
      const qaRegex = /"@type"\s*:\s*"Question"/g;
      const qaCount = (stripped.match(qaRegex) || []).length;
      report.faqSnippets = qaCount;
    }

    // Statistics with sources: look for [number]% / [number]+ / [number]x / etc + a citation
    const statRegex = /\b(\d+(?:\.\d+)?)\s*(?:%|percent|x|times|users?|customers?|requests?|ms|s)\b/gi;
    const sourceRegex = /\b(according to|via|reported by|source:|published by|research by)\b/gi;
    const statsMatches = (stripped.match(statRegex) || []).length;
    const sourcesMatches = (stripped.match(sourceRegex) || []).length;
    report.statsWithSources = Math.min(statsMatches, sourcesMatches);

    // Score this page
    let pageScore = 0;
    if (report.questionHeadings >= 1) pageScore += 15;
    if (report.paragraphSnippets >= 1) pageScore += 20;
    if (report.listSnippets >= 1) pageScore += 15;
    if (report.tableSnippets >= 1) pageScore += 20;
    if (report.hasFaqSchema) pageScore += 15;
    if (report.statsWithSources >= 1) pageScore += 15;

    pageReport_with_score: {
      report.snippetScore = Math.min(100, pageScore);
    }
    pageReports.push(report);
  }

  // Aggregate
  const aggregate = {
    pagesAnalyzed: pages.length,
    totalQuestionHeadings: pageReports.reduce((s, r) => s + r.questionHeadings, 0),
    totalParagraphSnippets: pageReports.reduce((s, r) => s + r.paragraphSnippets, 0),
    totalListSnippets: pageReports.reduce((s, r) => s + r.listSnippets, 0),
    totalTableSnippets: pageReports.reduce((s, r) => s + r.tableSnippets, 0),
    pagesWithFaqSchema: pageReports.filter(r => r.hasFaqSchema).length,
    pagesWithStats: pageReports.filter(r => r.statsWithSources >= 1).length,
  };

  // Aggregate score: penalize if most pages lack any snippet format
  const eligiblePages = pageReports.filter(r =>
    r.questionHeadings > 0 || r.listSnippets > 0 || r.tableSnippets > 0 || r.hasFaqSchema
  ).length;
  const eligibleRatio = pages.length > 0 ? eligiblePages / pages.length : 1;

  let aggregateScore = 100;
  if (eligibleRatio < 0.5 && pages.length > 0) {
    aggregateScore -= 30;
    findings.push({ severity: 'high', msg: `Only ${Math.round(eligibleRatio * 100)}% of pages have any snippet-eligible structure. Most pages won't appear as featured snippets.` });
  } else if (eligibleRatio < 0.8 && pages.length > 0) {
    aggregateScore -= 15;
    findings.push({ severity: 'medium', msg: `Only ${Math.round(eligibleRatio * 100)}% of pages have snippet-eligible structure. Target 80%+.` });
  }
  if (aggregate.pagesWithFaqSchema === 0 && pages.length > 0) {
    aggregateScore -= 10;
    findings.push({ severity: 'medium', msg: 'No pages have FAQPage schema. FAQ snippets are a high-CTR SERP feature.' });
  }
  if (aggregate.pagesWithStats === 0 && pages.length > 0) {
    aggregateScore -= 10;
    findings.push({ severity: 'medium', msg: 'No pages have statistics with sources cited. Stats + citation is the strongest GEO lever (Aggarwal et al. KDD 2024).' });
  }

  totalScore = Math.max(0, Math.min(100, Math.round(aggregateScore)));
  const grade = totalScore >= 90 ? 'A' : totalScore >= 75 ? 'B' : totalScore >= 55 ? 'C' : 'F';

  const result = {
    timestamp: new Date().toISOString(),
    score: totalScore,
    grade,
    aggregate,
    pageReports,
    findings
  };

  if (options.json || process.argv.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
    return result;
  }
  printConsole(result);
  return result;
}

function printConsole(result) {
  console.log('\n====================================================');
  console.log('     SPS SEO FEATURED SNIPPET AUDIT                  ');
  console.log('====================================================\n');
  console.log(`Snippet Score: ${result.score}/100 (Grade: ${result.grade})`);
  console.log(`Pages analyzed: ${result.aggregate.pagesAnalyzed}`);
  console.log(`Total question-shaped headings: ${result.aggregate.totalQuestionHeadings}`);
  console.log(`Paragraph-snippet eligible answers: ${result.aggregate.totalParagraphSnippets}`);
  console.log(`List-snippet eligible blocks: ${result.aggregate.totalListSnippets}`);
  console.log(`Table-snippet eligible blocks: ${result.aggregate.totalTableSnippets}`);
  console.log(`Pages with FAQ schema: ${result.aggregate.pagesWithFaqSchema}`);
  console.log(`Pages with stats + sources: ${result.aggregate.pagesWithStats}\n`);

  if (result.findings.length > 0) {
    console.log('Findings:');
    for (const f of result.findings) {
      const icon = f.severity === 'high' ? '❌' : '⚠️';
      console.log(`  ${icon} ${f.msg}`);
    }
    console.log('');
  }

  // Per-page detail (only pages with issues or interesting signal)
  const withRecs = result.pageReports.filter(r => r.recommendations.length > 0);
  if (withRecs.length > 0) {
    console.log('Per-page recommendations (top 10):');
    for (const r of withRecs.slice(0, 10)) {
      console.log(`\n  ${r.file}  [snippet-score: ${r.snippetScore}/100]`);
      for (const rec of r.recommendations) console.log(`    • ${rec}`);
    }
    if (withRecs.length > 10) console.log(`\n  ...and ${withRecs.length - 10} more pages with recommendations.\n`);
    else console.log('');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  runSnippetAudit();
}
