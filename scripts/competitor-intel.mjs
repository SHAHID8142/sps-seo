#!/usr/bin/env node

/**
 * SPS SEO Competitor Intelligence & Content Gap Matrix
 * Version: 1.0.0
 * 
 * Analyzes competitor URLs from sps-seo-config.json:
 * - Scrapes title, meta description, word count, and heading trees (H2/H3)
 * - Identifies Schema.org entities used by competitors
 * - Generates Content Gap Matrix contrasting competitor topics with local site
 */

import fs from 'node:fs';
import path from 'node:path';

const CWD = process.cwd();

function loadConfig(projectDir) {
  const rootConfig = path.join(projectDir, 'sps-seo-config.json');
  if (fs.existsSync(rootConfig)) {
    try {
      return JSON.parse(fs.readFileSync(rootConfig, 'utf8'));
    } catch {
      // ignore
    }
  }
  return {
    targeting: {
      competitors: []
    }
  };
}

export function parsePageHtml(html, sourceUrl) {
  // Title
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const title = titleMatch ? titleMatch[1].trim() : 'Unknown';

  // Description
  const descMatch = /<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']/i.exec(html) ||
                    /<meta\s+content=["']([\s\S]*?)["']\s+name=["']description["']/i.exec(html);
  const description = descMatch ? descMatch[1].trim() : 'None';

  // Headings
  const headings = [];
  const hRegex = /<(h[1-3])\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;
  while ((match = hRegex.exec(html)) !== null) {
    const level = match[1].toUpperCase();
    const text = match[2].replace(/<[^>]+>/g, '').trim();
    if (text) headings.push({ level, text });
  }

  // Schema types
  const schemaTypes = new Set();
  const schemaRegex = /"@type"\s*:\s*["']([^"']+)["']/g;
  while ((match = schemaRegex.exec(html)) !== null) {
    schemaTypes.add(match[1]);
  }

  // Word count approximation (strip scripts, styles, html tags)
  const cleanBody = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const wordCount = cleanBody ? cleanBody.split(' ').length : 0;

  return {
    url: sourceUrl,
    title,
    description,
    headings,
    schemaTypes: Array.from(schemaTypes),
    wordCount
  };
}

export async function analyzeCompetitors(options = {}) {
  const projectDir = options.cwd || CWD;
  const config = loadConfig(projectDir);

  let targetUrls = options.urls || config.targeting?.competitors || [];
  if (targetUrls.length === 0) {
    const cliUrl = process.argv.slice(2).find(arg => arg.startsWith('http'));
    if (cliUrl) {
      targetUrls = [cliUrl];
    }
  }

  console.log('\n====================================================');
  console.log('    SPS SEO COMPETITOR INTEL & CONTENT GAP MATRIX    ');
  console.log('====================================================\n');

  if (targetUrls.length === 0) {
    console.log('ℹ No competitor URLs configured in sps-seo-config.json (`targeting.competitors`).');
    console.log('  To analyze a competitor, add their URL to config or run:');
    console.log('  npm run competitor -- https://competitor.com\n');
    return { competitors: [], localHeadings: [], matrix: null };
  }

  console.log(`Analyzing ${targetUrls.length} competitor URL(s)...\n`);

  const competitorProfiles = [];

  for (const url of targetUrls) {
    console.log(`🔍 Fetching: ${url}`);
    let html = '';
    try {
      if (options.mockHtmlMap && options.mockHtmlMap[url]) {
        html = options.mockHtmlMap[url];
      } else {
        const res = await fetch(url, {
          signal: AbortSignal.timeout(5000),
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) SPS-SEO-Agent/1.0'
          }
        });
        if (!res.ok) {
          console.warn(`  ⚠️ Competitor returned HTTP ${res.status}`);
          continue;
        }
        html = await res.text();
      }

      const parsed = parsePageHtml(html, url);
      competitorProfiles.push(parsed);
      console.log(`  ✓ Title: ${parsed.title.slice(0, 50)}...`);
      console.log(`  ✓ Words: ~${parsed.wordCount} | Headings: ${parsed.headings.length} | Schemas: ${parsed.schemaTypes.join(', ') || 'None'}`);
    } catch (err) {
      console.warn(`  ⚠️ Could not fetch ${url} (${err.message})`);
    }
  }

  // Scan local project headings for gap comparison
  const localHeadings = new Set();
  const fileExts = ['.html', '.astro', '.tsx', '.jsx', '.vue', '.svelte'];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (['node_modules', '.git', '.next', 'dist', 'build'].includes(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.isFile() && fileExts.includes(path.extname(e.name))) {
        try {
          const content = fs.readFileSync(full, 'utf8');
          const hMatch = /<(h[1-3])\b[^>]*>([\s\S]*?)<\/\1>/gi;
          let m;
          while ((m = hMatch.exec(content)) !== null) {
            localHeadings.add(m[2].replace(/<[^>]+>/g, '').trim().toLowerCase());
          }
        } catch {
          // ignore
        }
      }
    }
  }
  walk(projectDir);

  // Calculate Content Gaps
  const competitorTopics = new Set();
  for (const comp of competitorProfiles) {
    for (const h of comp.headings) {
      competitorTopics.add(h.text);
    }
  }

  const missingTopics = [];
  for (const topic of competitorTopics) {
    const lower = topic.toLowerCase();
    const hasMatch = Array.from(localHeadings).some(lh => lh.includes(lower) || lower.includes(lh));
    if (!hasMatch) {
      missingTopics.push(topic);
    }
  }

  const report = {
    timestamp: new Date().toISOString(),
    competitorsCount: competitorProfiles.length,
    competitors: competitorProfiles,
    localHeadingsCount: localHeadings.size,
    missingTopicsCount: missingTopics.length,
    missingTopics: missingTopics.slice(0, 15)
  };

  // Write Markdown Report
  const reportMd = generateMarkdownReport(report);
  const outPath = path.join(projectDir, 'sps-seo-competitor-matrix.md');
  fs.writeFileSync(outPath, reportMd, 'utf8');

  console.log(`\n📊 Competitor Matrix generated: ${path.relative(projectDir, outPath)}`);
  console.log(`   └─ Found ${missingTopics.length} potential topic/heading gap(s) covered by competitors.\n`);

  return report;
}

function generateMarkdownReport(report) {
  let md = `# SPS SEO Competitor Intelligence & Content Gap Matrix\n\n`;
  md += `**Generated:** ${report.timestamp}  \n`;
  md += `**Competitors Analyzed:** ${report.competitorsCount}  \n\n`;

  md += `## 1. Competitor Benchmark Summary\n\n`;
  md += `| Competitor URL | Title | Est. Word Count | Headings (H1-H3) | Schemas |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- |\n`;
  for (const c of report.competitors) {
    md += `| ${c.url} | ${c.title.replace(/\|/g, '-')} | ~${c.wordCount} | ${c.headings.length} | ${c.schemaTypes.join(', ') || 'None'} |\n`;
  }

  md += `\n---\n\n## 2. Topic & Content Gap Matrix\n\n`;
  md += `These headings and subtopics are covered by competitors but not currently prominent in your local codebase:\n\n`;
  if (report.missingTopics.length === 0) {
    md += `*✓ Your content thoroughly matches or exceeds competitor topic coverage!*\n`;
  } else {
    for (const t of report.missingTopics) {
      md += `- **[Topic Gap]** "${t}"\n`;
    }
  }

  md += `\n---\n\n## 3. Recommended Actions\n`;
  md += `1. **Add FAQ/Answer Capsules:** Incorporate missing topic questions into your FAQ section or dedicated subheadings.\n`;
  md += `2. **Surpass Word Count & Depth:** Ensure key informational landing pages reach comparable or superior depth.\n`;
  md += `3. **Adopt Missing Schemas:** If competitors utilize structured schemas you lack (e.g. \`FAQPage\`, \`Product\`), inject them via \`schemas/\`.\n`;

  return md;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  analyzeCompetitors().catch(err => {
    console.error('Competitor analysis error:', err);
    process.exit(1);
  });
}
