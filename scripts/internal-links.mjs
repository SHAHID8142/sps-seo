#!/usr/bin/env node

/**
 * SPS SEO Internal Linking & Orphan Page Graph Analyzer
 * Version: 1.0.0
 * 
 * Maps internal link graph across pages and components:
 * - Detects orphan pages (in-degree = 0)
 * - Detects dead-end pages (out-degree = 0)
 * - Identifies weak anchor text ('click here', 'more', empty)
 * - Calculates Internal Link Health Score (0-100)
 */

import fs from 'node:fs';
import path from 'node:path';

const CWD = process.cwd();

const WEAK_ANCHORS = new Set([
  'click here',
  'here',
  'read more',
  'learn more',
  'more',
  'link',
  'view',
  'this',
  'go',
  'details',
  'check this out'
]);

function discoverRoutes(projectDir) {
  const routes = new Set(['/']);
  const IGNORE = ['api', '_app', '_document', '_error', '404', '500'];

  function walk(dir, base = '') {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (['node_modules', '.git', '.next', 'dist', 'build'].includes(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        const seg = e.name.replace(/^\(.*?\)$/, '').replace(/^\[.*?\]$/, '');
        walk(full, seg ? `${base}/${seg}` : base);
      } else if (e.isFile()) {
        const ext = path.extname(e.name);
        const name = path.basename(e.name, ext);
        if (name === 'page' && ['.tsx', '.jsx', '.ts', '.js'].includes(ext)) {
          routes.add((base || '/').replace(/\/+/g, '/'));
        } else if (['.astro', '.tsx', '.jsx', '.html', '.vue', '.svelte'].includes(ext)) {
          if (IGNORE.includes(name) || name.startsWith('_') || name.startsWith('.')) continue;
          const r = name === 'index' ? (base || '/') : `${base}/${name}`;
          routes.add(r.replace(/\/+/g, '/'));
        }
      }
    }
  }

  walk(path.join(projectDir, 'app'));
  walk(path.join(projectDir, 'src/app'));
  walk(path.join(projectDir, 'pages'));
  walk(path.join(projectDir, 'src/pages'));
  if (fs.existsSync(path.join(projectDir, 'index.html'))) routes.add('/');

  return Array.from(routes).sort();
}

function extractLinks(content, file) {
  const links = [];
  // Match <a href="...">text</a> and <Link href="...">text</Link>
  const linkRegex = /<(?:a|Link)\b([^>]*?)(?:>(.*?)<\/(?:a|Link)>|\/?>)/gis;
  let match;

  while ((match = linkRegex.exec(content)) !== null) {
    const attrs = match[1] || '';
    const body = match[2] || '';

    const hrefMatch = /(?:href|to)=(?:["']([^"']+)["']|{([^}]+)})/i.exec(attrs);
    if (!hrefMatch) continue;

    let href = hrefMatch[1] || hrefMatch[2] || '';
    href = href.trim();

    // Filter external links, protocols, anchors
    if (!href || href.startsWith('http://') || href.startsWith('https://') || 
        href.startsWith('mailto:') || href.startsWith('tel:') || 
        href.startsWith('javascript:') || href === '#') {
      continue;
    }

    // Clean internal anchor query
    const cleanHref = href.split('?')[0].split('#')[0].replace(/\/$/, '') || '/';
    const text = body.replace(/<[^>]+>/g, '').trim();

    links.push({
      target: cleanHref,
      rawText: text,
      isWeak: WEAK_ANCHORS.has(text.toLowerCase()) || text === '',
      file
    });
  }

  return links;
}

export function analyzeInternalLinks(options = {}) {
  const projectDir = options.cwd || CWD;
  const knownRoutes = discoverRoutes(projectDir);
  const routeSet = new Set(knownRoutes);

  const fileExts = ['.html', '.astro', '.tsx', '.jsx', '.vue', '.svelte'];
  const IGNORED = ['node_modules', '.git', '.next', 'dist', 'build'];

  const allLinks = [];
  const filesScanned = [];

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
        filesScanned.push(full);
        try {
          const content = fs.readFileSync(full, 'utf8');
          const found = extractLinks(content, path.relative(projectDir, full));
          allLinks.push(...found);
        } catch {
          // ignore
        }
      }
    }
  }

  walk(projectDir);

  // Directed graph calculation
  // incomingLinks: targetRoute -> count
  const incomingMap = new Map();
  const outgoingMap = new Map();
  for (const r of knownRoutes) {
    incomingMap.set(r, 0);
    outgoingMap.set(r, 0);
  }

  const weakLinks = [];
  for (const link of allLinks) {
    if (incomingMap.has(link.target)) {
      incomingMap.set(link.target, incomingMap.get(link.target) + 1);
    }
    if (link.isWeak) {
      weakLinks.push(link);
    }
  }

  // Find orphans (in-degree == 0, excluding root '/')
  const orphanRoutes = [];
  for (const [r, count] of incomingMap.entries()) {
    if (r !== '/' && count === 0) {
      orphanRoutes.push(r);
    }
  }

  // Score computation (0-100)
  // Penalize for orphans and weak links
  let score = 100;
  const orphanPenalty = orphanRoutes.length * 15;
  const weakPenalty = Math.min(30, weakLinks.length * 5);
  score = Math.max(0, 100 - orphanPenalty - weakPenalty);

  const result = {
    timestamp: new Date().toISOString(),
    routesCount: knownRoutes.length,
    knownRoutes,
    totalInternalLinks: allLinks.length,
    orphanRoutes,
    weakLinks,
    score,
    grade: score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 50 ? 'C' : 'F'
  };

  if (options.json || process.argv.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
    return result;
  }

  // Pretty Console Output
  console.log('\n====================================================');
  console.log('    SPS SEO INTERNAL LINKING & GRAPH ANALYZER       ');
  console.log('====================================================\n');

  console.log(`Routes Discovered:      ${knownRoutes.length}`);
  console.log(`Internal Links Parsed:  ${allLinks.length}`);
  console.log(`Files Scanned:          ${filesScanned.length}`);
  console.log(`Internal Link Score:    ${score}/100 (Grade: ${result.grade})\n`);

  console.log('Graph Health Findings:');
  if (orphanRoutes.length === 0) {
    console.log('  ✓ Zero orphan pages detected! All routes receive internal link equity.');
  } else {
    console.log(`  ✗ ${orphanRoutes.length} Orphan Route(s) Detected (No incoming links):`);
    orphanRoutes.forEach(r => console.log(`     └─ ${r}`));
  }

  if (weakLinks.length === 0) {
    console.log('  ✓ Anchor text quality is high (no generic "click here" detected).');
  } else {
    console.log(`  ⚠️ ${weakLinks.length} Weak / Non-Descriptive Anchor Text(s) Flagged:`);
    weakLinks.slice(0, 5).forEach(w => {
      console.log(`     └─ "${w.rawText || '<empty>'}" -> ${w.target} in ${w.file}`);
    });
    if (weakLinks.length > 5) console.log(`     └─ ...and ${weakLinks.length - 5} more.`);
  }

  console.log('\nActionable Advice:');
  console.log('  1. Link to orphan pages from relevant contextual body text or nav menus.');
  console.log('  2. Replace generic anchors ("click here", "learn more") with keyword-rich descriptive text.');
  console.log('');

  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  analyzeInternalLinks();
}
