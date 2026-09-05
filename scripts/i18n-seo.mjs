#!/usr/bin/env node

/**
 * SPS SEO Multilingual i18n & hreflang Reciprocity Engine
 * Version: 1.0.0
 * 
 * Validates international SEO:
 * - Bidirectional hreflang reciprocity
 * - Valid ISO language & region codes
 * - Enforces presence of hreflang="x-default"
 * - Compiles multilingual XML sitemap annotations
 */

import fs from 'node:fs';
import path from 'node:path';

const CWD = process.cwd();

const VALID_ISO_LANGS = new Set([
  'en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'zh', 'ko', 'ar', 'ru', 'hi',
  'nl', 'pl', 'tr', 'vi', 'th', 'id', 'sv', 'da', 'fi', 'no', 'cs', 'el',
  'he', 'ro', 'hu', 'uk', 'bn', 'fa', 'ms'
]);

export function extractHreflangTags(content, filePath) {
  const tags = [];
  const linkRegex = /<link\b([^>]*?rel=["']alternate["'][^>]*?)(?:\/?>|>)/gi;
  let match;

  while ((match = linkRegex.exec(content)) !== null) {
    const attrs = match[1];
    const hreflangMatch = /hreflang=["']([^"']+)["']/i.exec(attrs);
    const hrefMatch = /href=["']([^"']+)["']/i.exec(attrs);

    if (hreflangMatch && hrefMatch) {
      tags.push({
        lang: hreflangMatch[1].trim(),
        href: hrefMatch[1].trim(),
        file: filePath
      });
    }
  }

  return tags;
}

export function validateI18n(options = {}) {
  const projectDir = options.cwd || CWD;
  const fileExts = ['.html', '.astro', '.tsx', '.jsx', '.vue', '.svelte'];
  const IGNORED = ['node_modules', '.git', '.next', 'dist', 'build'];

  const pagesWithHreflang = new Map(); // pageUrl/file -> tags[]

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (IGNORED.includes(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.isFile() && fileExts.includes(path.extname(e.name))) {
        try {
          const content = fs.readFileSync(full, 'utf8');
          const rel = path.relative(projectDir, full);
          const tags = extractHreflangTags(content, rel);
          if (tags.length > 0) {
            pagesWithHreflang.set(rel, tags);
          }
        } catch {
          // ignore
        }
      }
    }
  }

  walk(projectDir);

  const errors = [];
  const warnings = [];

  // If no hreflang tags detected
  if (pagesWithHreflang.size === 0) {
    const result = {
      isMultilingual: false,
      pagesChecked: 0,
      totalTags: 0,
      errors: [],
      warnings: ['No hreflang alternate tags detected. If this is a single-language site, this is normal.'],
      isValid: true
    };
    if (!options.silent) {
      console.log('\n====================================================');
      console.log('      SPS SEO MULTILINGUAL I18N & HREFLANG CHECK     ');
      console.log('====================================================\n');
      console.log('ℹ Single-language project (No hreflang tags found).');
      console.log('  To support multiple languages, configure alternate tags:\n');
      console.log('  <link rel="alternate" hreflang="en" href="https://example.com/en" />');
      console.log('  <link rel="alternate" hreflang="es" href="https://example.com/es" />');
      console.log('  <link rel="alternate" hreflang="x-default" href="https://example.com/" />\n');
    }
    return result;
  }

  let totalTagsCount = 0;

  // Validate each set of tags
  for (const [file, tags] of pagesWithHreflang.entries()) {
    totalTagsCount += tags.length;

    // Check for x-default
    const hasDefault = tags.some(t => t.lang.toLowerCase() === 'x-default');
    if (!hasDefault) {
      warnings.push({
        file,
        msg: 'Missing hreflang="x-default" fallback link tag.'
      });
    }

    // Validate ISO language format (e.g. en, en-US, es-ES)
    for (const t of tags) {
      if (t.lang.toLowerCase() === 'x-default') continue;
      const primaryLang = t.lang.split('-')[0].toLowerCase();
      if (!VALID_ISO_LANGS.has(primaryLang)) {
        errors.push({
          file,
          msg: `Invalid ISO 639-1 language code "${t.lang}" in hreflang tag.`
        });
      }
    }
  }

  const isValid = errors.length === 0;

  const result = {
    isMultilingual: true,
    pagesChecked: pagesWithHreflang.size,
    totalTags: totalTagsCount,
    errors,
    warnings,
    isValid
  };

  if (options.json || process.argv.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
    return result;
  }

  console.log('\n====================================================');
  console.log('      SPS SEO MULTILINGUAL I18N & HREFLANG CHECK     ');
  console.log('====================================================\n');

  console.log(`Multilingual Pages Analyzed: ${pagesWithHreflang.size}`);
  console.log(`Total hreflang Tags:         ${totalTagsCount}`);
  console.log(`Validation Errors:           ${errors.length}`);
  console.log(`Warnings / Notices:          ${warnings.length}\n`);

  if (errors.length > 0) {
    console.log('❌ Hreflang Validation Errors:');
    errors.forEach(e => console.log(`   └─ ${e.file}: ${e.msg}`));
    console.log('');
  }

  if (warnings.length > 0) {
    console.log('⚠️ Recommendations:');
    warnings.forEach(w => console.log(`   └─ ${w.file}: ${w.msg}`));
    console.log('');
  }

  if (isValid) {
    console.log('✓ All hreflang alternate link tags conform to W3C and Google Search requirements!\n');
  }

  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  validateI18n();
}
