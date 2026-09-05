#!/usr/bin/env node

/**
 * SPS SEO - Backlink Equity, Unlinked Mentions & Digital PR Engine
 *
 * Comprehensive link acquisition and equity management:
 * 1. Outbound Link Equity Audit (dofollow vs nofollow/sponsored, anchor analysis)
 * 2. Unlinked Brand Mentions Discovery Generator (Google search operator strings)
 * 3. Digital PR Outreach Pitches (personalized journalist & editor pitches)
 * 4. High-Yield Linkable Asset Blueprints (original data benchmarks, tools, surveys)
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
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function analyzeBacklinks(options = {}) {
  const projectDir = options.projectDir ? path.resolve(options.projectDir) : CWD;
  const config = options.config || loadConfig(projectDir);

  const brand = config.site?.name || 'Brand';
  const siteUrl = config.site?.url || 'https://example.com';
  let host = 'example.com';
  try {
    host = new URL(siteUrl).hostname.replace(/^www\./, '');
  } catch {
    // ignore
  }

  const primaryKeyword = config.keywords?.primary || 'cloud technology';

  // 1. Audit Outbound External Links in Codebase
  const templates = walkDir(projectDir, (name) => {
    return TEMPLATE_EXTS.has(path.extname(name).toLowerCase());
  });

  const outboundLinks = [];
  let dofollowCount = 0;
  let nofollowCount = 0;

  for (const file of templates) {
    let content = '';
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }

    const relPath = path.relative(projectDir, file);

    const aRegex = /<a\b([^>]*href=["'](https?:\/\/[^"']+)["'][^>]*)>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = aRegex.exec(content)) !== null) {
      const attrs = match[1];
      const href = match[2];
      const anchorText = stripHtml(match[3]) || '[no text]';

      if (href.includes(host) || href.startsWith('/') || href.startsWith('#')) continue;

      const isNofollow = /rel=["'][^"']*(?:nofollow|sponsored|ugc)[^"']*["']/i.test(attrs);
      if (isNofollow) nofollowCount++;
      else dofollowCount++;

      outboundLinks.push({
        file: relPath,
        href,
        anchorText,
        isNofollow,
        isDofollow: !isNofollow
      });
    }
  }

  // 2. Generate Unlinked Brand Mention Search Queries
  const unlinkedMentionQueries = [
    `"${brand}" -site:${host}`,
    `"${brand}" "${primaryKeyword}" -site:${host}`,
    `"${siteUrl.replace(/^https?:\/\//, '')}" -site:${host}`,
    `"according to ${brand}" -site:${host}`,
    `"source: ${brand}" -site:${host}`
  ];

  // 3. Digital PR Outreach Pitches
  const outreachPitch = {
    subject: `Original Data Benchmark: ${primaryKeyword} research for your article`,
    body: `Hi [Editor Name],

I enjoyed your recent coverage on ${primaryKeyword} on [Publication Name].

Our engineering team at ${brand} just published an original benchmark study analyzing real-world trends in ${primaryKeyword}. 

A few key takeaways that might be relevant for your readers:
• Key Finding 1: [Insert 1 surprising statistic from original research]
• Key Finding 2: [Insert benchmark measurement]

Here is the complete report and interactive charts: ${siteUrl}/research

Feel free to quote these statistics or republish the graphics with attribution. Let me know if you'd like commentary from our technical lead.

Best regards,
${config.author?.name || 'Technical Director'}
${brand} | ${siteUrl}`
  };

  // 4. Linkable Asset Blueprints
  const linkableAssets = [
    {
      title: `The 2026 ${primaryKeyword} State of Industry Benchmark`,
      type: 'Empirical Data Report',
      rationale: 'Original statistics earn 5x more natural editorial backlinks than opinion articles.'
    },
    {
      title: `Free ${primaryKeyword} ROI & Efficiency Calculator`,
      type: 'Interactive Web Tool',
      rationale: 'Free utility tools generate persistent high-authority backlinks from resource lists.'
    },
    {
      title: `The Complete ${primaryKeyword} Cheat Sheet & Architecture Matrix`,
      type: 'Visual Framework',
      rationale: 'Technical cheatsheets earn steady citations from developer blogs and documentation hubs.'
    }
  ];

  const result = {
    timestamp: new Date().toISOString(),
    outboundSummary: {
      totalOutbound: outboundLinks.length,
      dofollow: dofollowCount,
      nofollow: nofollowCount,
      links: outboundLinks.slice(0, 15)
    },
    unlinkedMentionQueries,
    outreachPitch,
    linkableAssets
  };

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return result;
  }

  // Console Output
  console.log('\n====================================================');
  console.log('       SPS SEO BACKLINK EQUITY & DIGITAL PR         ');
  console.log('====================================================\n');

  console.log(`Brand Name:         ${brand}`);
  console.log(`Domain:             ${host}`);
  console.log(`Outbound Links:     ${outboundLinks.length} (${dofollowCount} dofollow, ${nofollowCount} nofollow)\n`);

  console.log('1. Unlinked Brand Mention Search Queries (Copy into Google):');
  for (const q of unlinkedMentionQueries) {
    console.log(`   🔍 ${q}`);
  }

  console.log('\n2. Recommended Linkable Assets to Build:');
  for (const asset of linkableAssets) {
    console.log(`   🎯 [${asset.type}] ${asset.title}`);
    console.log(`      └─ ${asset.rationale}`);
  }

  console.log('\n3. Digital PR Outreach Template:');
  console.log(`   Subject: ${outreachPitch.subject}`);
  console.log('   Preview: "Hi [Editor Name]... Our engineering team just published an original benchmark..."\n');

  console.log('Backlink Acquisition Hard Laws:');
  console.log('  - Never buy links (Google SpamBrain algorithmic penalties are automated and severe).');
  console.log('  - Convert unlinked brand mentions into high-equity dofollow backlinks with quick email outreach.');
  console.log('  - Build 1 original research benchmark asset per quarter to attract natural passive citations.\n');

  return result;
}

// Auto-run if executed directly
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  // [v1.4 deprecated] Forward to the canonical unified entrypoint
  console.warn('⚠️  Deprecated entrypoint: backlink-intel.mjs is now composed into ./backlink-audit.mjs. Forwarding...\n');
  const { spawnSync } = await import('node:child_process');
  const res = spawnSync(process.execPath, [
    path.join(path.dirname(fileURLToPath(import.meta.url)), 'backlink-audit.mjs'),
    ...process.argv.slice(2)
  ], { stdio: 'inherit' });
  process.exit(res.status ?? 0);
}
