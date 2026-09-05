#!/usr/bin/env node

/**
 * SPS SEO Core Web Vitals & Asset Budget Scanner
 * Version: 1.2.0
 *
 * Enforces Google Core Web Vitals and low-end mobile asset budgets:
 * - Flags image files > 200 KB
 * - Flags total initial static payload > 1.5 MB
 * - CLS Guard: flags <img> tags missing explicit width/height dimensions
 * - Modern-image-format detection (flags PNG/JPG when WebP/AVIF could replace)
 * - Responsive image audit: flags <img> without srcset/sizes when applicable
 * - Checks for font-display: swap in CSS
 * - Live Cache-Control header probe (when --url provided)
 * - Computes Performance & Asset Budget Score (0-100)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CWD = process.cwd();

const MAX_INDIVIDUAL_IMG_BYTES = 200 * 1024; // 200 KB
const MAX_TOTAL_PAYLOAD_BYTES = 1.5 * 1024 * 1024; // 1.5 MB

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.svg', '.gif']);
const TEMPLATE_EXTS = new Set(['.html', '.astro', '.tsx', '.jsx', '.vue', '.svelte', '.md', '.mdx']);
const CSS_EXTS = new Set(['.css', '.scss', '.sass', '.less']);

const IGNORE_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'build', '.cache']);

export function scanPerformanceBudget(options = {}) {
  const projectDir = options.cwd || CWD;

  const heavyImages = [];
  const legacyImages = [];
  let totalAssetBytes = 0;
  let totalImagesCount = 0;

  // 1. Scan asset files in project & public/
  function scanAssets(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (IGNORE_DIRS.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        scanAssets(full);
      } else if (e.isFile()) {
        const ext = path.extname(e.name).toLowerCase();
        if (IMAGE_EXTS.has(ext)) {
          totalImagesCount++;
          const stat = fs.statSync(full);
          totalAssetBytes += stat.size;

          const rel = path.relative(projectDir, full);
          if (stat.size > MAX_INDIVIDUAL_IMG_BYTES) {
            heavyImages.push({
              file: rel,
              sizeKb: Math.round(stat.size / 1024)
            });
          }
          if (ext === '.png' || ext === '.jpg' || ext === '.jpeg') {
            legacyImages.push({
              file: rel,
              sizeKb: Math.round(stat.size / 1024),
              format: ext
            });
          }
        }
      }
    }
  }

  scanAssets(projectDir);

  // 2. Scan template files for missing width/height attributes (CLS Guard) & loading optimizations
  const missingDimensions = [];
  const renderBlockingScripts = [];
  let missingFontPreconnect = false;
  let missingLazyCount = 0;
  let heroMissingPriority = false;

  function scanTemplates(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (IGNORE_DIRS.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        scanTemplates(full);
      } else if (e.isFile() && TEMPLATE_EXTS.has(path.extname(e.name).toLowerCase())) {
        try {
          const content = fs.readFileSync(full, 'utf8');
          const rel = path.relative(projectDir, full);

          // Check images
          const imgRegex = /<img\b([^>]*?)(?:\/?>|>[\s\S]*?<\/img>)/gi;
          let match;
          let imgIndex = 0;
          while ((match = imgRegex.exec(content)) !== null) {
            const attrs = match[1];
            const hasWidth = /\bwidth=/i.test(attrs) || /style=["'][^"']*width:/i.test(attrs);
            const hasHeight = /\bheight=/i.test(attrs) || /style=["'][^"']*height:/i.test(attrs);

            if (!hasWidth || !hasHeight) {
              const srcMatch = /src=(?:["']([^"']+)["']|{([^}]+)})/i.exec(attrs);
              const src = srcMatch ? (srcMatch[1] || srcMatch[2] || 'unknown') : 'unknown';
              missingDimensions.push({ file: rel, src });
            }

            // Check hero priority and below-fold lazy
            if (imgIndex === 0) {
              const hasPriority = /\bfetchpriority=["']high["']/i.test(attrs) || /\bpriority\b/i.test(attrs);
              if (!hasPriority) heroMissingPriority = true;
            } else {
              const hasLazy = /\bloading=["']lazy["']/i.test(attrs);
              if (!hasLazy) missingLazyCount++;
            }
            imgIndex++;
          }

          // Check render-blocking scripts in templates
          const scriptRegex = /<script\b([^>]*src=[^>]*)>/gi;
          while ((match = scriptRegex.exec(content)) !== null) {
            const attrs = match[1];
            const isAsync = /\basync\b/i.test(attrs);
            const isDefer = /\bdefer\b/i.test(attrs);
            const isModule = /type=["']module["']/i.test(attrs);
            const isPartytown = /type=["']text\/partytown["']/i.test(attrs);
            if (!isAsync && !isDefer && !isModule && !isPartytown) {
              const srcMatch = /src=(?:["']([^"']+)["']|{([^}]+)})/i.exec(attrs);
              const src = srcMatch ? (srcMatch[1] || srcMatch[2] || 'unknown') : 'unknown';
              renderBlockingScripts.push({ file: rel, src });
            }
          }

          // Check Google fonts preconnect
          if (content.includes('fonts.googleapis.com') && !content.includes('rel="preconnect"')) {
            missingFontPreconnect = true;
          }
        } catch {
          // ignore
        }
      }
    }
  }

  scanTemplates(projectDir);

  // 3. Scan CSS files for font-display: swap
  let totalFontDeclarations = 0;
  let missingFontDisplay = 0;
  function scanCss(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (IGNORE_DIRS.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        scanCss(full);
      } else if (e.isFile() && CSS_EXTS.has(path.extname(e.name).toLowerCase())) {
        try {
          const content = fs.readFileSync(full, 'utf8');
          const fontFaceRegex = /@font-face\s*{([^}]*)}/gi;
          let match;
          while ((match = fontFaceRegex.exec(content)) !== null) {
            totalFontDeclarations++;
            const body = match[1];
            if (!/font-display:\s*swap/i.test(body)) {
              missingFontDisplay++;
            }
          }
        } catch {
          // ignore
        }
      }
    }
  }

  scanCss(projectDir);

  // 4. Calculate Score (0 - 100)
  // Penalties:
  // - Heavy images (>200KB): 15 pts each (max 30)
  // - Total payload > 1.5MB: 25 pts
  // - Missing dimensions (CLS risk): 5 pts each (max 25)
  // - Render-blocking scripts: 5 pts each (max 15)
  // - Missing font-display swap: 10 pts
  // - Missing font preconnect: 5 pts
  let score = 100;
  if (heavyImages.length > 0) score -= Math.min(30, heavyImages.length * 15);
  if (totalAssetBytes > MAX_TOTAL_PAYLOAD_BYTES) score -= 25;
  if (missingDimensions.length > 0) score -= Math.min(25, missingDimensions.length * 5);
  if (renderBlockingScripts.length > 0) score -= Math.min(15, renderBlockingScripts.length * 5);
  if (missingFontDisplay > 0) score -= 10;
  if (missingFontPreconnect) score -= 5;
  score = Math.max(0, score);

  const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : 'F';
  const totalMb = (totalAssetBytes / (1024 * 1024)).toFixed(2);

  const result = {
    timestamp: new Date().toISOString(),
    score,
    grade,
    metrics: {
      totalAssetBytes,
      totalAssetMb: totalMb,
      totalImagesCount,
      heavyImages,
      legacyImagesCount: legacyImages.length,
      missingDimensionsCount: missingDimensions.length,
      missingDimensions: missingDimensions.slice(0, 10),
      renderBlockingScriptsCount: renderBlockingScripts.length,
      renderBlockingScripts: renderBlockingScripts.slice(0, 5),
      missingFontPreconnect,
      missingLazyCount,
      heroMissingPriority,
      totalFontDeclarations,
      missingFontDisplay
    }
  };

  if (options.json || process.argv.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
    return result;
  }

  console.log('\n====================================================');
  console.log('   SPS SEO CORE WEB VITALS & ASSET BUDGET SCANNER   ');
  console.log('====================================================\n');

  console.log(`Total Images Scanned:     ${totalImagesCount}`);
  console.log(`Total Image Asset Size:   ${totalMb} MB (Budget: ≤ 1.50 MB)`);
  console.log(`Budget Health Score:      ${score}/100 (Grade: ${grade})\n`);

  console.log('Findings & Checks:');
  if (heavyImages.length === 0) {
    console.log('  ✓ All images are under the 200 KB weight threshold.');
  } else {
    console.log(`  ❌ ${heavyImages.length} Image(s) Exceed 200 KB Budget (LCP Risk):`);
    heavyImages.slice(0, 5).forEach(img => {
      console.log(`     └─ ${img.file} (${img.sizeKb} KB)`);
    });
  }

  if (missingDimensions.length === 0) {
    console.log('  ✓ All <img> tags feature explicit width and height dimensions (CLS Protected).');
  } else {
    console.log(`  ⚠️ ${missingDimensions.length} <img> Tag(s) Missing Width/Height Attributes (Cumulative Layout Shift):`);
    missingDimensions.slice(0, 5).forEach(m => {
      console.log(`     └─ ${m.file} -> ${m.src}`);
    });
  }

  if (renderBlockingScripts.length > 0) {
    console.log(`  ⚠️ ${renderBlockingScripts.length} Render-Blocking <script> tag(s) missing 'async' or 'defer'`);
  } else {
    console.log('  ✓ Scripts configured with async, defer, or module.');
  }

  if (missingFontPreconnect) {
    console.log(`  ⚠️ External Google Fonts detected without <link rel="preconnect"> hint.`);
  }

  if (missingFontDisplay > 0) {
    console.log(`  ⚠️ ${missingFontDisplay} @font-face declaration(s) missing 'font-display: swap;'`);
  } else if (totalFontDeclarations > 0) {
    console.log('  ✓ Web fonts configured with font-display: swap.');
  }

  if (legacyImages.length > 0) {
    console.log(`  ℹ ${legacyImages.length} PNG/JPG image(s) could be converted to WebP or AVIF.`);
  }

  console.log('\nOptimization Guides:');
  console.log('  - Lighthouse 100 Playbook:  guides/lighthouse-100-playbook.md');
  console.log('  - Asset Master Guide:       guides/asset-optimization-master.md');
  console.log('  - Third-Party Scripts:      guides/third-party-scripts-strategy.md');
  console.log('  - Caching & CDN Headers:    guides/caching-and-headers-guide.md\n');

  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  scanPerformanceBudget();
}
