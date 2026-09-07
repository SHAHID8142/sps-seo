#!/usr/bin/env node

/**
 * SPS SEO Deterministic Audit Engine
 * Version: 1.5.0
 * 
 * Zero-dependency Node.js ESM scanner for framework detection, AST/HTML parsing,
 * heading hierarchy analysis, alt attribute validation, metadata verification,
 * and 100-point deterministic SEO scoring.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractHtmlHeadings } from './lib/core.mjs';

const CWD = process.cwd();

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  '.nuxt',
  '.astro',
  '.svelte-kit',
  'dist',
  'build',
  'out',
  '.cache',
  'coverage',
  '.gemini',
  'scratch'
]);

// 1. Detect Framework
function detectFramework(projectDir) {
  const pkgPath = path.join(projectDir, 'package.json');
  let pkg = null;
  if (fs.existsSync(pkgPath)) {
    try {
      pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    } catch {
      // ignore invalid json
    }
  }

  const deps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) };

  const hasFile = (rel) => fs.existsSync(path.join(projectDir, rel));

  if (deps['next'] || hasFile('next.config.js') || hasFile('next.config.mjs') || hasFile('next.config.ts')) {
    const isAppRouter = hasFile('app') || hasFile('src/app');
    const isPagesRouter = hasFile('pages') || hasFile('src/pages');
    return {
      type: 'nextjs',
      variant: isAppRouter ? 'app-router' : isPagesRouter ? 'pages-router' : 'app-router',
      label: `Next.js (${isAppRouter ? 'App Router' : 'Pages Router'})`,
      configFile: hasFile('next.config.ts') ? 'next.config.ts' : hasFile('next.config.mjs') ? 'next.config.mjs' : 'next.config.js'
    };
  }

  if (deps['astro'] || hasFile('astro.config.mjs') || hasFile('astro.config.ts')) {
    return { type: 'astro', variant: 'astro', label: 'Astro', configFile: hasFile('astro.config.ts') ? 'astro.config.ts' : 'astro.config.mjs' };
  }

  if (deps['nuxt'] || hasFile('nuxt.config.ts') || hasFile('nuxt.config.js')) {
    return { type: 'nuxt', variant: 'nuxt', label: 'Nuxt / Vue', configFile: hasFile('nuxt.config.ts') ? 'nuxt.config.ts' : 'nuxt.config.js' };
  }

  if (deps['@sveltejs/kit'] || hasFile('svelte.config.js')) {
    return { type: 'sveltekit', variant: 'sveltekit', label: 'SvelteKit', configFile: 'svelte.config.js' };
  }

  if (deps['@remix-run/node'] || deps['@remix-run/react'] || hasFile('remix.config.js')) {
    return { type: 'remix', variant: 'remix', label: 'Remix', configFile: 'remix.config.js' };
  }

  if (deps['gatsby'] || hasFile('gatsby-config.js') || hasFile('gatsby-config.mjs')) {
    return { type: 'gatsby', variant: 'gatsby', label: 'Gatsby', configFile: 'gatsby-config.js' };
  }

  if (deps['@angular/core']) {
    return { type: 'angular', variant: 'angular', label: 'Angular', configFile: hasFile('angular.json') ? 'angular.json' : null };
  }

  if (deps['laravel-mix'] || deps['@laravel/vite-plugin'] || hasFile('artisan')) {
    return { type: 'laravel', variant: 'laravel', label: 'Laravel (Blade)', configFile: hasFile('vite.config.js') ? 'vite.config.js' : null };
  }

  if (deps['vite'] || hasFile('vite.config.ts') || hasFile('vite.config.js')) {
    const variant = deps['vue'] ? 'spa-vue' : deps['svelte'] ? 'spa-svelte' : deps['preact'] ? 'spa-preact' : 'spa-react';
    return { type: 'vite', variant, label: `Vite / ${variant.replace('spa-', '').replace(/^\w/, c => c.toUpperCase())} SPA`, configFile: hasFile('vite.config.ts') ? 'vite.config.ts' : 'vite.config.js' };
  }

  if (hasFile('index.html')) {
    return { type: 'static-html', variant: 'html', label: 'Static HTML', configFile: 'index.html' };
  }

  return { type: 'unknown', variant: 'generic', label: 'Universal / Generic Web', configFile: null };
}

// 2. Discover Source Files
function collectFiles(dir, exts = ['.html', '.htm', '.astro', '.tsx', '.jsx', '.vue', '.svelte', '.md', '.mdx']) {
  const results = [];

  function walk(currentDir) {
    let entries;
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (exts.includes(ext)) {
          results.push(fullPath);
        }
      }
    }
  }

  walk(dir);
  return results;
}

// 3. Parser & Tokenizer Helper
function analyzeContent(filePath, content) {
  const relPath = path.relative(CWD, filePath);
  const ext = path.extname(filePath).toLowerCase();
  const isMarkdown = ext === '.md' || ext === '.mdx';
  // Strip fenced code blocks before analysis so `#` comments in code
  // samples are never misread as markdown headings.
  const proseContent = isMarkdown ? content.replace(/```[\s\S]*?```/g, '') : content;

  // Heading analysis (HTML tags + markdown ATX headings)
  let match;
  const headings = [];
  if (isMarkdown) {
    const mdHeadingRegex = /^(#{1,6})\s+(.+?)\s*$/gm;
    while ((match = mdHeadingRegex.exec(proseContent)) !== null) {
      headings.push({
        level: match[1].length,
        text: match[2].replace(/[*_`]/g, '').trim(),
        line: proseContent.slice(0, match.index).split('\n').length
      });
    }
  } else {
    const headingMatches = extractHtmlHeadings(content, { minLevel: 1, maxLevel: 6 });
    for (const hm of headingMatches) {
      headings.push({ level: hm.level, text: hm.text, line: hm.line });
    }
  }

  // Heading hierarchy validation
  let h1Count = 0;
  let skippedLevels = 0;
  let lastLevel = 0;
  for (const h of headings) {
    if (h.level === 1) h1Count++;
    if (lastLevel > 0 && h.level > lastLevel + 1) {
      skippedLevels++;
    }
    lastLevel = h.level;
  }

  // Image alt tag analysis
  // Matches <img ...>, <Image ...>, etc.
  const imgRegex = /<(?:img|Image)\b([^>]*?)(?:\/?>|>[\s\S]*?<\/(?:img|Image)>)/gi;
  let totalImages = 0;
  let missingAlt = 0;
  let emptyAlt = 0;
  const imageDetails = [];

  if (isMarkdown) {
    // Markdown images: ![alt](src) — empty alt is always a defect
    const mdImgRegex = /!\[([^\]]*)\]\(([^)\s]+)/g;
    while ((match = mdImgRegex.exec(proseContent)) !== null) {
      totalImages++;
      const alt = match[1].trim();
      const src = match[2];
      if (alt === '') {
        emptyAlt++;
        imageDetails.push({ src, status: 'empty', line: proseContent.slice(0, match.index).split('\n').length });
      }
    }
  }
  while ((match = imgRegex.exec(content)) !== null) {
    totalImages++;
    const attrs = match[1];
    const altMatch = /alt=(?:["']([\s\S]*?)["']|{([^}]*)})/i.exec(attrs);
    const srcMatch = /src=(?:["']([\s\S]*?)["']|{([^}]*)})/i.exec(attrs);
    const src = srcMatch ? (srcMatch[1] || srcMatch[2] || 'unknown') : 'unknown';

    if (!altMatch) {
      missingAlt++;
      imageDetails.push({ src, status: 'missing', line: content.slice(0, match.index).split('\n').length });
    } else {
      const val = (altMatch[1] ?? altMatch[2] ?? '').trim();
      if (val === '' || val === '""' || val === "''") {
        emptyAlt++;
        imageDetails.push({ src, status: 'empty', line: content.slice(0, match.index).split('\n').length });
      }
    }
  }

  // Meta & Tag checks
  // Next.js metadata object check: export const metadata: Metadata = { ... }
  const hasNextMetadata = /export\s+const\s+metadata\s*(?::\s*Metadata)?\s*=\s*{/i.test(content) ||
                          /export\s+async\s+function\s+generateMetadata/i.test(content);

  // NOTE: fallback object-literal matches are anchored to real metadata
  // contexts (export const metadata / generateMetadata) so that unrelated
  // JS object keys like `document.title = '...'` or i18n dictionaries
  // never produce false positives.
  const METADATA_CONTEXT = '(?:export\\s+const\\s+metadata|export\\s+async\\s+function\\s+generateMetadata)';

  let title = null;
  let description = null;
  let canonical = null;
  let hasFrontmatter = false;

  if (isMarkdown) {
    // Markdown frontmatter (YAML) is the canonical source for md/mdx pages
    const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
    if (fm) {
      hasFrontmatter = true;
      const t = /^title:\s*["']?(.+?)["']?\s*$/m.exec(fm[1]);
      const d = /^description:\s*["']?(.+?)["']?\s*$/m.exec(fm[1]);
      if (t) title = t[1].trim();
      if (d) description = d[1].trim();
    }
    if (!title) {
      const h1 = headings.find(h => h.level === 1);
      if (h1) title = h1.text;
    }
  } else {    const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(content) ||
                       new RegExp(`${METADATA_CONTEXT}[\\s\\S]{0,800}?title:\\s*["'\`]([^"'\`]+)["'\`]`, 'i').exec(content);
    title = titleMatch ? titleMatch[1].trim() : null;

    const descMatch = /<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']/i.exec(content) ||
                      /<meta\s+content=["']([\s\S]*?)["']\s+name=["']description["']/i.exec(content) ||
                      new RegExp(`${METADATA_CONTEXT}[\\s\\S]{0,800}?description:\\s*["'\`]([^"'\`]+)["'\`]`, 'i').exec(content);
    description = descMatch ? descMatch[1].trim() : null;

    const canonicalMatch = /<link\s+rel=["']canonical["']\s+href=["']([\s\S]*?)["']/i.exec(content) ||
                           /<link\s+href=["']([\s\S]*?)["']\s+rel=["']canonical["']/i.exec(content) ||
                           new RegExp(`${METADATA_CONTEXT}[\\s\\S]{0,800}?canonical:\\s*["'\`]([^"'\`]+)["'\`]`, 'i').exec(content);
    canonical = canonicalMatch ? canonicalMatch[1].trim() : null;
  }

  // OpenGraph checks
  const ogTitle = /property=["']og:title["']/i.test(content) || /openGraph:\s*{[\s\S]*?title:/i.test(content);
  const ogDesc = /property=["']og:description["']/i.test(content) || /openGraph:\s*{[\s\S]*?description:/i.test(content);
  const ogImage = /property=["']og:image["']/i.test(content) || /openGraph:\s*{[\s\S]*?images?:/i.test(content);
  const ogUrl = /property=["']og:url["']/i.test(content) || /openGraph:\s*{[\s\S]*?url:/i.test(content);

  // Twitter cards
  const twitterCard = /name=["']twitter:card["']/i.test(content) || /twitter:\s*{[\s\S]*?card:/i.test(content);

  // Structured data (JSON-LD)
  const hasJsonLd = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi.test(content) ||
                    /type=["']application\/ld\+json["']/i.test(content);

  // Check for dangerous noindex/nofollow tags
  const hasNoindex = /name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(content) ||
                     /robots:\s*{[^}]*index:\s*false/i.test(content);
  const hasNofollow = /name=["']robots["'][^>]*content=["'][^"']*nofollow/i.test(content) ||
                      /robots:\s*{[^}]*follow:\s*false/i.test(content);

  // Check for insecure external links: target="_blank" missing rel="noopener noreferrer"
  const targetBlankRegex = /<a\b([^>]*target=["']_blank["'][^>]*?)>/gi;
  let insecureLinksCount = 0;
  while ((match = targetBlankRegex.exec(content)) !== null) {
    const attrs = match[1];
    const hasRel = /rel=["'][^"']*(?:noopener|noreferrer)[^"']*["']/i.test(attrs);
    if (!hasRel) {
      insecureLinksCount++;
    }
  }

  // Mobile viewport readiness (Next.js App Router uses `export const viewport`)
  const hasViewport = /<meta[^>]+name=["']viewport["']/i.test(content) ||
                      /export\s+const\s+viewport\s*(?::\s*Viewport)?\s*=/i.test(content);

  // Language declaration (SC 3.1.1 + hreflang baseline)
  const hasHtmlLang = /<html\b[^>]*\slang=["'][^"']+["']/i.test(content);

  // Canonical multiplicity (multiple canonical tags on one page is a defect)
  const canonicalCount = (content.match(/<link\s+rel=["']canonical["']/gi) || []).length;

  // Semantic landmarks
  const hasMain = /<main\b/i.test(content);
  const hasHeader = /<header\b/i.test(content);
  const hasFooter = /<footer\b/i.test(content);
  const hasNav = /<nav\b/i.test(content);

  // Visible word count for thin-content detection (strip script/style/tags)
  const bodyText = content
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const wordCount = isMarkdown
    ? proseContent.split(/\s+/).filter(Boolean).length
    : (bodyText ? bodyText.split(' ').length : 0);

  return {
    file: relPath,
    ext,
    hasNextMetadata,
    hasFrontmatter,
    title,
    description,
    canonical,
    canonicalCount,
    og: { title: ogTitle, desc: ogDesc, image: ogImage, url: ogUrl },
    twitter: { card: twitterCard },
    hasJsonLd,
    hasNoindex,
    hasNofollow,
    insecureLinksCount,
    hasViewport,
    hasHtmlLang,
    wordCount,
    headings: {
      total: headings.length,
      h1Count,
      skippedLevels,
      list: headings
    },
    images: {
      total: totalImages,
      missingAlt,
      emptyAlt,
      details: imageDetails
    },
    semantics: {
      hasMain,
      hasHeader,
      hasFooter,
      hasNav
    }
  };
}

// Framework adapter mapping: audit report + fix pipeline reference
// adapters/<type>.md; framework types without a dedicated file must route
// to the universal fallback instead of a dead link.
const ADAPTER_MAP = {
  nextjs: 'nextjs-app',
  astro: 'astro',
  nuxt: 'universal-fallback',
  sveltekit: 'universal-fallback',
  remix: 'universal-fallback',
  gatsby: 'universal-fallback',
  angular: 'universal-fallback',
  laravel: 'universal-fallback',
  vite: 'vite-react',
  'static-html': 'static-html',
  unknown: 'universal-fallback'
};

// 3b. Visible word counter (thin-content signal)
function countVisibleWords(analysis, content) {
  return analysis.wordCount || 0;
}

// 4. Main Audit Controller
export async function runAudit(options = {}) {
  const projectDir = options.cwd || CWD;
  const isJsonOutput = options.json || process.argv.includes('--json');
  const framework = detectFramework(projectDir);

  // Global file checks
  const robotsPath = [
    path.join(projectDir, 'robots.txt'),
    path.join(projectDir, 'public/robots.txt')
  ].find(p => fs.existsSync(p));

  const robotsExists = !!robotsPath ||
                       fs.existsSync(path.join(projectDir, 'app/robots.ts')) ||
                       fs.existsSync(path.join(projectDir, 'src/app/robots.ts'));

  let hasDangerousRobots = false;
  if (robotsPath) {
    try {
      const robotsContent = fs.readFileSync(robotsPath, 'utf8');
      if (/User-agent:\s*\*\s*[\r\n]+Disallow:\s*\/\s*$/im.test(robotsContent)) {
        hasDangerousRobots = true;
      }
    } catch {
      // ignore
    }
  }

  const sitemapExists = fs.existsSync(path.join(projectDir, 'sitemap.xml')) ||
                        fs.existsSync(path.join(projectDir, 'public/sitemap.xml')) ||
                        fs.existsSync(path.join(projectDir, 'app/sitemap.ts')) ||
                        fs.existsSync(path.join(projectDir, 'src/app/sitemap.ts'));

  const llmsExists = fs.existsSync(path.join(projectDir, 'llms.txt')) ||
                     fs.existsSync(path.join(projectDir, 'public/llms.txt'));

  const llmsFullExists = fs.existsSync(path.join(projectDir, 'llms-full.txt')) ||
                         fs.existsSync(path.join(projectDir, 'public/llms-full.txt'));

  // AI bot policy check (2026): verify the robots.txt allows the
  // citation-capable bots and (optionally) blocks training bots.
  // Returns the policy verdict plus which bots are missing/blocked.
  const aiBotPolicy = analyzeAiBotPolicy(robotsPath);

  const configExists = fs.existsSync(path.join(projectDir, 'sps-seo-config.json')) ||
                       fs.existsSync(path.join(projectDir, '.sps/seo.json'));

  const faviconExists = [
    'favicon.ico', 'public/favicon.ico', 'app/favicon.ico', 'src/app/favicon.ico',
    'public/favicon.svg', 'public/icon.svg', 'apple-touch-icon.png'
  ].some(rel => fs.existsSync(path.join(projectDir, rel)));

  // Collect and parse files
  const files = collectFiles(projectDir);
  const analyses = [];

  for (const f of files) {
    try {
      const content = fs.readFileSync(f, 'utf8');
      analyses.push(analyzeContent(f, content));
    } catch {
      // skip unreadable
    }
  }

  // Aggregate Metrics across pages/layouts
  let aggregatedTitle = null;
  let aggregatedDesc = null;
  let aggregatedCanonical = null;
  let hasAnyOG = false;
  let hasAnyTwitter = false;
  let hasAnyJsonLd = false;

  let totalH1Issues = 0;
  let totalSkippedHeadings = 0;
  let totalImages = 0;
  let totalMissingAlt = 0;
  let totalEmptyAlt = 0;
  let pagesWithH1 = 0;

  // Metadata quality collectors
  const titleLengthViolations = [];
  const descLengthViolations = [];
  const titleMap = new Map();   // title -> [files]
  const descMap = new Map();    // description -> [files]
  const multiCanonicalPages = [];
  let eligibleMetaPages = 0;
  let pagesWithTitle = 0;
  let pagesWithDesc = 0;
  let pagesWithoutViewport = 0;
  let pagesWithoutLang = 0;
  const thinContentPages = [];
  // Files eligible for per-page metadata coverage. tsx/jsx are excluded:
  // Next.js metadata inheritance from layouts/generateMetadata cannot be
  // resolved statically, so per-file coverage there would false-penalize.
  const META_ELIGIBLE_EXTS = new Set(['.html', '.htm', '.astro', '.vue', '.svelte', '.md', '.mdx']);

  for (const a of analyses) {
    if (a.title && !aggregatedTitle) aggregatedTitle = a.title;
    if (a.description && !aggregatedDesc) aggregatedDesc = a.description;
    if (a.canonical && !aggregatedCanonical) aggregatedCanonical = a.canonical;
    if (a.og.title || a.og.desc || a.og.image) hasAnyOG = true;
    if (a.twitter.card) hasAnyTwitter = true;
    if (a.hasJsonLd) hasAnyJsonLd = true;

    if (a.headings.h1Count === 1) pagesWithH1++;
    if (a.headings.h1Count > 1 || a.headings.h1Count === 0) {
      if (a.headings.total > 0) totalH1Issues++;
    }
    totalSkippedHeadings += a.headings.skippedLevels;

    totalImages += a.images.total;
    totalMissingAlt += a.images.missingAlt;
    totalEmptyAlt += a.images.emptyAlt;

    // --- Metadata quality collection (templates + frontmatter-markdown only)
    const isMetaEligible = META_ELIGIBLE_EXTS.has(a.ext) && (a.ext !== '.md' && a.ext !== '.mdx' || a.hasFrontmatter);
    if (isMetaEligible) {
      eligibleMetaPages++;
      if (a.title) {
        pagesWithTitle++;
        const list = titleMap.get(a.title) || [];
        list.push(a.file);
        titleMap.set(a.title, list);
        if (a.title.length < 30 || a.title.length > 60) {
          titleLengthViolations.push({ file: a.file, length: a.title.length });
        }
      }
      if (a.description) {
        pagesWithDesc++;
        const list = descMap.get(a.description) || [];
        list.push(a.file);
        descMap.set(a.description, list);
        if (a.description.length < 70 || a.description.length > 160) {
          descLengthViolations.push({ file: a.file, length: a.description.length });
        }
      }
    }

    // Canonical multiplicity (any file type that emits <link> tags)
    if (a.canonicalCount > 1) multiCanonicalPages.push({ file: a.file, count: a.canonicalCount });

    // Mobile / language readiness for HTML documents
    const isHtmlDoc = ['.html', '.htm'].includes(a.ext);
    if (isHtmlDoc) {
      if (!a.hasViewport) pagesWithoutViewport++;
      if (!a.hasHtmlLang) pagesWithoutLang++;
    }

    // Thin content (static HTML pages & frontmatter markdown only)
    if (isHtmlDoc || (a.hasFrontmatter && (a.ext === '.md' || a.ext === '.mdx'))) {
      const words = countVisibleWords(a);
      if (words > 0 && words < 120) thinContentPages.push({ file: a.file, words });
    }
  }

  // If nextjs app router has metadata in layout or page
  const hasMetadataObject = analyses.some(a => a.hasNextMetadata);

  const duplicateTitles = [...titleMap.entries()].filter(([, files]) => files.length > 1);
  const duplicateDescs = [...descMap.entries()].filter(([, files]) => files.length > 1);

  // -------------------------------------------------------------
  // DETERMINISTIC 100-POINT SCORING BREAKDOWN
  // -------------------------------------------------------------
  // Category 1: Technical & Crawlability (25 pts)
  //   - Robots.txt present (8 pts)
  //   - Sitemap.xml present (8 pts)
  //   - Framework config verified (5 pts)
  //   - sps-seo config present (4 pts)
  let cat1Score = 0;
  if (robotsExists) cat1Score += 8;
  if (sitemapExists) cat1Score += 8;
  if (framework.configFile) cat1Score += 5;
  if (configExists) cat1Score += 4;

  // Category 2: Meta Tags & Social Previews (25 pts)
  //   - Title coverage & quality (8 pts): 5 coverage + 3 quality
  //   - Description coverage & quality (8 pts): 5 coverage + 3 quality
  //   - Canonical URL present (4 pts)
  //   - Open Graph tags present (3 pts)
  //   - Twitter Card tag present (2 pts)
  //
  // Coverage is computed over metadata-eligible pages (html/astro/vue/svelte
  // templates and frontmatter markdown). For pure Next.js metadata-object
  // projects (no inline tags), a 0.6 coverage floor applies ONLY when a real
  // title was actually extracted — an empty `metadata = {}` no longer
  // earns the full 25/25 it previously did.
  let titleCoverage = 0;
  let descCoverage = 0;
  if (eligibleMetaPages > 0) {
    titleCoverage = pagesWithTitle / eligibleMetaPages;
    descCoverage = pagesWithDesc / eligibleMetaPages;
  }
  let titleQuality = 1;
  let descQuality = 1;
  if (titleLengthViolations.length > 0 || duplicateTitles.length > 0) {
    const offenders = titleLengthViolations.length + duplicateTitles.reduce((s, [, f]) => s + f.length - 1, 0);
    titleQuality = Math.max(0, 1 - offenders / Math.max(1, eligibleMetaPages));
  }
  if (descLengthViolations.length > 0 || duplicateDescs.length > 0) {
    const offenders = descLengthViolations.length + duplicateDescs.reduce((s, [, f]) => s + f.length - 1, 0);
    descQuality = Math.max(0, 1 - offenders / Math.max(1, eligibleMetaPages));
  }
  // Next.js metadata-object fallback: partial credit when no template files
  // carry inline tags. Requires a real extracted title so empty metadata
  // objects earn nothing.
  let nextFallback = 0;
  if (eligibleMetaPages === 0 && hasMetadataObject && aggregatedTitle) nextFallback = 0.6;

  const effTitleCoverage = eligibleMetaPages > 0 ? titleCoverage : nextFallback;
  const effDescCoverage = eligibleMetaPages > 0 ? descCoverage : nextFallback;

  let cat2Score = 0;
  cat2Score += Math.round(5 * effTitleCoverage) + Math.round(3 * (effTitleCoverage > 0 ? titleQuality : 0));
  cat2Score += Math.round(5 * effDescCoverage) + Math.round(3 * (effDescCoverage > 0 ? descQuality : 0));
  if (aggregatedCanonical || (hasMetadataObject && aggregatedCanonical)) cat2Score += 4;
  if (hasAnyOG || hasMetadataObject) cat2Score += 3;
  if (hasAnyTwitter || hasMetadataObject) cat2Score += 2;

  // Category 3: Semantic Structure & Headings (25 pts)
  //   - Exactly 1 H1 per page / layout (10 pts)
  //   - No skipped heading levels (H1 -> H3) (8 pts)
  //   - Semantic HTML tags (main, header, footer, nav) (7 pts)
  let cat3Score = 0;
  if (totalH1Issues === 0 && analyses.length > 0) cat3Score += 10;
  else if (totalH1Issues <= 2) cat3Score += 5;

  if (totalSkippedHeadings === 0 && analyses.length > 0) cat3Score += 8;
  else if (totalSkippedHeadings <= 2) cat3Score += 4;

  const hasSemantics = analyses.some(a => a.semantics.hasMain || a.semantics.hasHeader || a.semantics.hasFooter);
  if (hasSemantics) cat3Score += 7;

  // Category 4: Media, Schema & AI Search Readiness (25 pts)
  //   - Image Alt Text coverage (10 pts)
  //   - JSON-LD Structured Data Schema (8 pts)
  //   - AI Search / llms.txt readiness (7 pts)
  let cat4Score = 0;
  if (totalImages === 0) {
    cat4Score += 10; // No images to fail
  } else {
    const validImages = totalImages - (totalMissingAlt + totalEmptyAlt);
    const altRatio = validImages / totalImages;
    cat4Score += Math.round(altRatio * 10);
  }

  if (hasAnyJsonLd) cat4Score += 8;
  if (llmsExists) cat4Score += 7;
  // Bonus: llms-full.txt companion (Aug 2026 standard) — +2 if present, capped
  // so it never pushes past 25/25 in this category.
  if (llmsFullExists) cat4Score = Math.min(25, cat4Score + 2);

  // Deduct if dangerous robots or severe noindex
  const noindexPages = analyses.filter(a => a.hasNoindex).map(a => a.file);
  const totalInsecureLinks = analyses.reduce((sum, a) => sum + (a.insecureLinksCount || 0), 0);

  if (hasDangerousRobots) cat1Score = Math.max(0, cat1Score - 12);
  if (!faviconExists) cat1Score = Math.max(0, cat1Score - 2);
  // Heavy penalty: blocking a citation bot silently removes you from that
  // engine's answers. -6 per citation bot blocked (capped at -18).
  if (aiBotPolicy.blockedCitationBots.length > 0) {
    cat1Score = Math.max(0, cat1Score - Math.min(18, aiBotPolicy.blockedCitationBots.length * 6));
  }

  // Metadata/mobile deductions: canonical multiplicity, missing viewport,
  // missing html lang, thin content.
  if (multiCanonicalPages.length > 0) {
    cat2Score = Math.max(0, cat2Score - Math.min(4, multiCanonicalPages.length * 2));
  }
  if (pagesWithoutViewport > 0) cat1Score = Math.max(0, cat1Score - Math.min(3, pagesWithoutViewport));
  if (pagesWithoutLang > 0) cat1Score = Math.max(0, cat1Score - Math.min(2, pagesWithoutLang));
  if (thinContentPages.length > 0) cat3Score = Math.max(0, cat3Score - Math.min(5, thinContentPages.length));

  // Empty-project guard: with zero pages analyzed there is nothing to
  // reward — every category scores 0 so a bare folder can never earn
  // free points (previously an empty repo scored 19/100).
  if (analyses.length === 0) {
    cat1Score = 0; cat2Score = 0; cat3Score = 0; cat4Score = 0;
  }

  const totalScore = Math.min(100, Math.max(0, cat1Score + cat2Score + cat3Score + cat4Score));

  let grade = 'F';
  if (totalScore >= 90) grade = 'A';
  else if (totalScore >= 80) grade = 'B';
  else if (totalScore >= 65) grade = 'C';
  else if (totalScore >= 50) grade = 'D';

  // Framework adapter mapping is applied at module scope (ADAPTER_MAP).

  const report = {
    timestamp: new Date().toISOString(),
    framework: framework,
    score: totalScore,
    grade: grade,
    categories: {
      technical: {
        score: cat1Score,
        max: 25,
        robots: robotsExists,
        sitemap: sitemapExists,
        config: configExists,
        favicon: faviconExists,
        dangerousRobots: hasDangerousRobots,
        noindexCount: noindexPages.length,
        insecureLinksCount: totalInsecureLinks,
        pagesWithoutViewport,
        pagesWithoutLang,
        aiBotPolicy: aiBotPolicy
      },
      metadata: {
        score: cat2Score,
        max: 25,
        title: !!aggregatedTitle || hasMetadataObject,
        description: !!aggregatedDesc || hasMetadataObject,
        canonical: !!aggregatedCanonical,
        og: hasAnyOG || hasMetadataObject,
        twitter: hasAnyTwitter || hasMetadataObject,
        titleCoverage: eligibleMetaPages > 0 ? Math.round((pagesWithTitle / eligibleMetaPages) * 100) : (hasMetadataObject && aggregatedTitle ? 60 : 0),
        descCoverage: eligibleMetaPages > 0 ? Math.round((pagesWithDesc / eligibleMetaPages) * 100) : (hasMetadataObject && aggregatedDesc ? 60 : 0),
        titleLengthViolations: titleLengthViolations.length,
        descLengthViolations: descLengthViolations.length,
        duplicateTitles: duplicateTitles.map(([t, files]) => ({ title: t, files })),
        duplicateDescriptions: duplicateDescs.map(([d, files]) => ({ description: d, files })),
        multiCanonicalPages
      },
      semantics: { score: cat3Score, max: 25, h1Issues: totalH1Issues, skippedHeadings: totalSkippedHeadings, hasSemantics, thinContentPages },
      schemaAndAi: { score: cat4Score, max: 25, jsonLd: hasAnyJsonLd, llmsTxt: llmsExists, llmsFullTxt: llmsFullExists, totalImages, missingAlt: totalMissingAlt, emptyAlt: totalEmptyAlt }
    },
    filesScanned: analyses.length,
    analyses
  };

  if (isJsonOutput) {
    console.log(JSON.stringify(report, null, 2));
    return report;
  }

  // Pretty Console Output
  console.log(`\n${colors.bold}${colors.cyan}====================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}        SPS SEO DETERMINISTIC AUDIT REPORT          ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}====================================================${colors.reset}\n`);

  console.log(`${colors.bold}Target Framework:${colors.reset} ${colors.green}${framework.label}${colors.reset}`);
  console.log(`${colors.bold}Files Analyzed:${colors.reset}   ${analyses.length} templates/pages`);
  
  const scoreColor = totalScore >= 85 ? colors.green : totalScore >= 65 ? colors.yellow : colors.red;
  console.log(`${colors.bold}Audit Score:${colors.reset}      ${scoreColor}${colors.bold}${totalScore}/100 (Grade: ${grade})${colors.reset}\n`);

  console.log(`${colors.bold}Category Breakdown:${colors.reset}`);
  console.log(`  1. Technical & Crawlability:      ${cat1Score}/25 pts [Robots: ${robotsExists ? '✓' : '✗'}, Sitemap: ${sitemapExists ? '✓' : '✗'}, Config: ${configExists ? '✓' : '✗'}, Favicon: ${faviconExists ? '✓' : '✗'}]`);
  console.log(`  2. Meta Tags & Social Previews:   ${cat2Score}/25 pts [Title: ${aggregatedTitle || hasMetadataObject ? '✓' : '✗'}, Desc: ${aggregatedDesc || hasMetadataObject ? '✓' : '✗'}, Canonical: ${aggregatedCanonical || hasMetadataObject ? '✓' : '✗'}, OG: ${hasAnyOG || hasMetadataObject ? '✓' : '✗'}]`);
  console.log(`  3. Semantic Hierarchy (H1-H6):    ${cat3Score}/25 pts [H1 Anomalies: ${totalH1Issues}, Skipped Levels: ${totalSkippedHeadings}]`);
  console.log(`  4. Schema & AI Search Readiness:  ${cat4Score}/25 pts [JSON-LD: ${hasAnyJsonLd ? '✓' : '✗'}, llms.txt: ${llmsExists ? '✓' : '✗'}, llms-full.txt: ${llmsFullExists ? '✓' : '○ bonus'}, Images: ${totalImages} (Missing Alt: ${totalMissingAlt})]`);

  console.log(`\n${colors.bold}Actionable Findings:${colors.reset}`);
  if (hasDangerousRobots) console.log(`  ${colors.red}🚨 CRITICAL: robots.txt blocks all crawlers (Disallow: /)${colors.reset}`);
  if (aiBotPolicy.blockedCitationBots.length > 0) {
    console.log(`  ${colors.red}🚨 CITATION BLOCKED: ${aiBotPolicy.blockedCitationBots.length} AI citation bot(s) blocked in robots.txt: ${aiBotPolicy.blockedCitationBots.join(', ')}. These engines literally cannot cite your site. Unblock them.${colors.reset}`);
  }
  if (noindexPages.length > 0) console.log(`  ${colors.red}⚠️ Production 'noindex' tag detected in: ${noindexPages.join(', ')}${colors.reset}`);
  if (!robotsExists) console.log(`  ${colors.red}✗ Missing robots.txt${colors.reset} - Crawlers have no baseline indexing boundaries.`);
  if (!sitemapExists) console.log(`  ${colors.red}✗ Missing sitemap.xml${colors.reset} - Search engines cannot efficiently discover deep URLs.`);
  if (!faviconExists) console.log(`  ${colors.yellow}! Missing favicon / app icon${colors.reset} - Search engine SERP snippet branding compromised.`);
  if (totalInsecureLinks > 0) console.log(`  ${colors.yellow}! Insecure external links (${totalInsecureLinks} detected)${colors.reset} - target="_blank" without rel="noopener noreferrer".`);
  if (!llmsExists) console.log(`  ${colors.yellow}! Missing llms.txt${colors.reset} - Modern LLMs (ChatGPT, Claude, Perplexity) lack a structured knowledge index.`);
  if (llmsExists && !llmsFullExists) console.log(`  ${colors.cyan}ℹ llms-full.txt not detected — optional Aug 2026 companion for full-content agent ingestion. Run \`npm run sitemap\` to scaffold.${colors.reset}`);
  if (!hasAnyJsonLd) console.log(`  ${colors.red}✗ Missing Schema.org JSON-LD${colors.reset} - No rich snippets eligibility in Google SERPs.`);
  if (totalMissingAlt > 0) console.log(`  ${colors.yellow}! Missing Image Alt Attributes (${totalMissingAlt} detected)${colors.reset} - Impairs accessibility and Google Image indexing.`);
  if (titleLengthViolations.length > 0) console.log(`  ${colors.yellow}! Suboptimal title lengths (${titleLengthViolations.length} pages)${colors.reset} - Titles should be 30-60 characters. First: ${titleLengthViolations[0].file} (${titleLengthViolations[0].length} chars)`);
  if (descLengthViolations.length > 0) console.log(`  ${colors.yellow}! Suboptimal description lengths (${descLengthViolations.length} pages)${colors.reset} - Descriptions should be 70-160 characters.`);
  if (duplicateTitles.length > 0) console.log(`  ${colors.yellow}! Duplicate titles (${duplicateTitles.length} titles shared by multiple pages)${colors.reset} - Keyword cannibalization risk. Run \`npm run cannibalization\` for details.`);
  if (duplicateDescs.length > 0) console.log(`  ${colors.yellow}! Duplicate meta descriptions (${duplicateDescs.length} shared)${colors.reset}`);
  if (multiCanonicalPages.length > 0) console.log(`  ${colors.red}✗ Multiple canonical tags on ${multiCanonicalPages.length} page(s)${colors.reset} - Conflicting canonical signals dilute indexing.`);
  if (pagesWithoutViewport > 0) console.log(`  ${colors.yellow}! Missing mobile viewport meta on ${pagesWithoutViewport} HTML page(s)${colors.reset} - Mobile-first indexing penalty risk.`);
  if (pagesWithoutLang > 0) console.log(`  ${colors.yellow}! Missing <html lang> on ${pagesWithoutLang} HTML page(s)${colors.reset} - Accessibility & language targeting.`);
  if (thinContentPages.length > 0) console.log(`  ${colors.yellow}! Thin content (<120 words) on ${thinContentPages.length} page(s)${colors.reset} - First: ${thinContentPages[0].file} (${thinContentPages[0].words} words).`);
  if (!configExists) console.log(`  ${colors.blue}ℹ Missing sps-seo-config.json${colors.reset} - Initialize config using sps-seo-config.example.json.`);

  console.log(`\n${colors.bold}Security & Performance Diagnostics:${colors.reset}`);
  console.log(`  - Run \`npm run security\` to audit HTTP security headers (HSTS, CSP), secret leaks, mixed content, and accessibility.`);
  console.log(`  - Run \`npm run perf\` to scan Core Web Vitals, asset payload budgets, and CLS layout shifts.`);

  console.log(`\n${colors.dim}Detailed markdown report generated at: sps-seo-audit-report.md${colors.reset}\n`);

  // Write Markdown Report
  const worstOffenders = buildWorstOffenders(analyses);
  writeMarkdownReport(report, projectDir, { worstOffenders });

  return report;
}

function writeMarkdownReport(report, projectDir, extras = {}) {
  const offenders = extras.worstOffenders || [];
  const worstOffendersSection = offenders.length > 0
    ? `## 6. Worst-Offender Pages (Priority Fixes)\n\n| Page | Issues |\n| :--- | :--- |\n${offenders.map(o => `| \`${o.file}\` | ${o.issues.join(', ')} |`).join('\n')}\n\n---\n\n`
    : '';

  const md = `# SPS SEO Technical Audit Report

**Generated:** ${report.timestamp}  
**Detected Framework:** \`${report.framework.label}\`  
**Overall Score:** **${report.score}/100** (Grade: **${report.grade}**)  

---

## 1. Score Summary

| Category | Score | Max Points | Status |
| :--- | :--- | :--- | :--- |
| **Technical & Crawlability** | \`${report.categories.technical.score}\` | 25 | ${report.categories.technical.score >= 20 ? '✅ Pass' : '⚠️ Attention Needed'} |
| **Meta Tags & Social Previews** | \`${report.categories.metadata.score}\` | 25 | ${report.categories.metadata.score >= 20 ? '✅ Pass' : '⚠️ Attention Needed'} |
| **Semantic Hierarchy (H1-H6)** | \`${report.categories.semantics.score}\` | 25 | ${report.categories.semantics.score >= 20 ? '✅ Pass' : '⚠️ Attention Needed'} |
| **Schema & AI Readiness (AEO)** | \`${report.categories.schemaAndAi.score}\` | 25 | ${report.categories.schemaAndAi.score >= 20 ? '✅ Pass' : '⚠️ Attention Needed'} |
| **TOTAL** | **\`${report.score}\`** | **100** | **Grade: ${report.grade}** |

---

## 2. Technical & Crawlability Audit
- **robots.txt:** ${report.categories.technical.robots ? '✅ Present' : '❌ Missing (Priority: High)'}
- **sitemap.xml:** ${report.categories.technical.sitemap ? '✅ Present' : '❌ Missing (Priority: High)'}
- **SPS SEO Config:** ${report.categories.technical.config ? '✅ Present' : '⚠️ Missing (`sps-seo-config.json`)'}

---

## 3. Metadata & Social Previews
- **Title Tag:** ${report.categories.metadata.title ? '✅ Configured' : '❌ Missing or Empty'}
- **Meta Description:** ${report.categories.metadata.description ? '✅ Configured' : '❌ Missing or Empty'}
- **Canonical URL:** ${report.categories.metadata.canonical ? '✅ Configured' : '⚠️ Missing'}
- **OpenGraph Tags:** ${report.categories.metadata.og ? '✅ Configured' : '⚠️ Missing (og:title, og:image)'}
- **Twitter Card:** ${report.categories.metadata.twitter ? '✅ Configured' : '⚠️ Missing (summary_large_image)'}

---

## 4. Semantic Hierarchy & Image Alt Attributes
- **H1 Tag Violations:** ${report.categories.semantics.h1Issues === 0 ? '✅ None (Compliant)' : `❌ ${report.categories.semantics.h1Issues} pages with multiple or zero H1 tags`}
- **Skipped Heading Levels:** ${report.categories.semantics.skippedHeadings === 0 ? '✅ None' : `⚠️ ${report.categories.semantics.skippedHeadings} skipped levels (e.g. H1 to H3)`}
- **Images Scanned:** ${report.categories.schemaAndAi.totalImages}
- **Images Missing Alt:** ${report.categories.schemaAndAi.missingAlt === 0 ? '✅ 100% Coverage' : `❌ ${report.categories.schemaAndAi.missingAlt} images missing alt text`}

---

## 5. Schema.org & AI Engine Optimization (GEO/AEO)
- **JSON-LD Rich Snippets:** ${report.categories.schemaAndAi.jsonLd ? '✅ Present' : '❌ Missing (Needs Organization / WebSite schema)'}
- **llms.txt AI Index:** ${report.categories.schemaAndAi.llmsTxt ? '✅ Present' : '⚠️ Missing (Recommended for ChatGPT / Perplexity / Claude)'}

---
${worstOffendersSection}
## 6. Actionable Remediation Plan
1. **Framework Adapter:** Apply [adapters/${ADAPTER_MAP[report.framework.type] || 'universal-fallback'}.md](file://${projectDir}/adapters/${ADAPTER_MAP[report.framework.type] || 'universal-fallback'}.md) for idiomatic metadata injection.
2. **JSON-LD Schema:** Inject appropriate templates from \`schemas/\` into the root layout.
3. **Alt Attributes:** Add descriptive, contextual alt attributes to all flagged images.
4. **Crawlability:** Generate \`sitemap.xml\` and \`robots.txt\` using \`npm run sitemap\`.
5. **AI Search:** Generate \`llms.txt\` using the SPS SEO AEO guideline.
`;

  try {
    fs.writeFileSync(path.join(projectDir, 'sps-seo-audit-report.md'), md, 'utf8');
    // If .sps directory exists, mirror the report
    const spsDir = path.join(projectDir, '.sps');
    if (fs.existsSync(spsDir)) {
      fs.writeFileSync(path.join(spsDir, 'seo-audit.md'), md, 'utf8');
    }
  } catch (e) {
    console.error('Failed to write audit report markdown:', e.message);
  }
}

// 4b. Worst-offender ranking (surface the pages needing priority fixes)
function buildWorstOffenders(analyses, limit = 10) {
  const offenders = [];
  for (const a of analyses) {
    const issues = [];
    if (a.ext === '.html' || a.ext === '.htm') {
      if (!a.title) issues.push('missing title');
      if (!a.description) issues.push('missing description');
      if (!a.hasViewport) issues.push('no viewport');
      if (!a.hasHtmlLang) issues.push('no html lang');
      if (a.canonicalCount > 1) issues.push(`${a.canonicalCount} canonical tags`);
    }
    if (a.headings.h1Count === 0 && a.headings.total > 0) issues.push('zero H1');
    if (a.headings.h1Count > 1) issues.push(`${a.headings.h1Count} H1 tags`);
    if (a.images.missingAlt > 0) issues.push(`${a.images.missingAlt} missing alt`);
    if (a.images.emptyAlt > 0) issues.push(`${a.images.emptyAlt} empty alt`);
    if (a.wordCount > 0 && a.wordCount < 120) issues.push(`thin content (${a.wordCount} words)`);
    if (a.insecureLinksCount > 0) issues.push(`${a.insecureLinksCount} unsafe _blank links`);
    if (issues.length > 0) offenders.push({ file: a.file, issues, count: issues.length });
  }
  return offenders.sort((x, y) => y.count - x.count).slice(0, limit);
}

// 5. AI bot policy analyzer (2026-correct)
//
// Bots that MUST be allowed if you want citations from that engine.
// Bots that MAY be blocked to opt out of training data collection.
const CITATION_BOTS = new Set([
  'OAI-SearchBot',     // OpenAI ChatGPT search citations
  'ChatGPT-User',      // OpenAI user-triggered fetches
  'ClaudeBot',         // Anthropic Claude retrieval
  'anthropic-ai',      // Anthropic legacy token
  'PerplexityBot',     // Perplexity
  'Bingbot',           // Microsoft Copilot (Bing)
]);

const TRAINING_BOTS = new Set([
  'GPTBot',            // OpenAI training
  'CCBot',             // Common Crawl training
  'Google-Extended',   // Google Gemini training only (does NOT affect AIO/AI Mode)
  'Bytespider',        // ByteDance training
]);

function analyzeAiBotPolicy(robotsPath) {
  const result = {
    hasRobotsTxt: !!robotsPath,
    blockedCitationBots: [],
    allowedTrainingBots: [],
    policyVerdict: 'unknown',
  };

  if (!robotsPath) return result;

  let content;
  try {
    content = fs.readFileSync(robotsPath, 'utf8');
  } catch {
    return result;
  }

  // Parse each User-agent block: the first Allow/Disallow after each
  // User-agent token applies to that token.
  const blocks = content.split(/User-agent\s*:\s*/i).slice(1);
  const tokenRules = new Map(); // token -> 'allow' | 'disallow'
  for (const block of blocks) {
    const lines = block.split(/\r?\n/);
    const token = lines.shift().trim();
    if (!token) continue;
    let rule = null;
    for (const line of lines) {
      const m = /^\s*(Allow|Disallow)\s*:\s*(\S*)/i.exec(line);
      if (m && m[2]) {
        rule = m[1].toLowerCase() === 'allow' ? 'allow' : 'disallow';
        break; // first non-empty rule wins per bot
      }
    }
    // Wildcard block: applies to every bot without an explicit rule
    if (token === '*') {
      if (!rule) continue;
      const knownBots = new Set([...CITATION_BOTS, ...TRAINING_BOTS]);
      for (const bot of knownBots) {
        if (!tokenRules.has(bot)) tokenRules.set(bot, rule);
      }
      // Wildcard does NOT retroactively override already-specific tokens
    } else {
      tokenRules.set(token, rule);
    }
  }

  for (const bot of CITATION_BOTS) {
    const rule = tokenRules.get(bot);
    if (rule === 'disallow') result.blockedCitationBots.push(bot);
  }
  for (const bot of TRAINING_BOTS) {
    const rule = tokenRules.get(bot);
    if (rule === 'allow') result.allowedTrainingBots.push(bot);
  }

  // Verdict
  if (result.blockedCitationBots.length > 0) {
    result.policyVerdict = 'blocked-citation-bot';
  } else if (result.allowedTrainingBots.length > 0 && result.blockedCitationBots.length === 0) {
    result.policyVerdict = 'max-visibility';
  } else {
    result.policyVerdict = 'cite-dont-train';
  }

  return result;
}

// Auto-run if executed directly
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  runAudit().catch(err => {
    console.error('Audit execution error:', err);
    process.exit(1);
  });
}
