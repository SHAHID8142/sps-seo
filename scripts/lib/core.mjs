/**
 * SPS SEO Shared Core Library
 * Version: 1.4.0
 *
 * Zero-dependency shared utilities for all SPS SEO tools:
 *  - VERSION            single source of truth (read from ../../VERSION)
 *  - IGNORE_DIRS        canonical directory exclusion set
 *  - CONTENT_EXTS       canonical scannable content extensions
 *  - walkFiles()        consistent project file walker
 *  - loadConfig()       sps-seo-config.json loader with validation
 *  - captureConsole()   safely compose sub-tool output (JSON-safe)
 *  - isMain()           cross-platform (Windows-safe) entrypoint guard
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LIB_DIR = path.dirname(fileURLToPath(import.meta.url));

// Single source of truth for the skill version
export const VERSION = (() => {
  try {
    return fs.readFileSync(path.resolve(LIB_DIR, '../../VERSION'), 'utf8').trim();
  } catch {
    return '0.0.0';
  }
})();

// Canonical ignored directories — every scanner must use this set so that
// all tools analyze the exact same file universe (deterministic parity).
export const IGNORE_DIRS = new Set([
  'node_modules', '.git', '.next', '.nuxt', '.svelte-kit', '.astro',
  'dist', 'build', 'out', '.cache', '.turbo', 'coverage',
  '.gemini', 'scratch', '.sps', '.agents', '.vercel', '.netlify'
]);

// Canonical scannable content extensions (HTML/templates + Markdown)
export const CONTENT_EXTS = [
  '.html', '.htm', '.astro', '.tsx', '.jsx', '.vue', '.svelte', '.md', '.mdx'
];

/**
 * Walk a project directory collecting files whose extension matches.
 * @param {string} dir
 * @param {{exts?: string[], ignoreDirs?: Set<string>, extraIgnore?: Set<string>}} opts
 * @returns {string[]}
 */
export function walkFiles(dir, opts = {}) {
  const exts = opts.exts || CONTENT_EXTS;
  const ignore = opts.ignoreDirs || IGNORE_DIRS;
  const extraIgnore = opts.extraIgnore || new Set();
  const results = [];

  function walk(current) {
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (ignore.has(entry.name) || extraIgnore.has(entry.name)) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && exts.includes(path.extname(entry.name).toLowerCase())) {
        results.push(full);
      }
    }
  }

  walk(dir);
  return results;
}

/**
 * Load sps-seo-config.json (or .sps/seo.json fallback) with shape validation.
 * @param {string} projectDir
 * @returns {{config: object|null, errors: string[], warnings: string[]}}
 */
export function loadConfig(projectDir) {
  const candidates = [
    path.join(projectDir, 'sps-seo-config.json'),
    path.join(projectDir, '.sps', 'seo.json')
  ];
  const errors = [];
  const warnings = [];
  let config = null;

  const found = candidates.find(p => fs.existsSync(p));
  if (!found) {
    warnings.push('No sps-seo-config.json found — run `npm run init` to generate one.');
    return { config, errors, warnings };
  }

  try {
    config = JSON.parse(fs.readFileSync(found, 'utf8'));
  } catch (e) {
    errors.push(`Invalid JSON in ${path.relative(projectDir, found)}: ${e.message}`);
    return { config: null, errors, warnings };
  }

  // Shape validation (typos in keys are silently ignored by tools — surface them)
  const knownTop = new Set(['site', 'metadata', 'targeting', 'technical', 'aiBotPolicy', 'performance']);
  for (const key of Object.keys(config)) {
    if (!knownTop.has(key)) warnings.push(`Unknown top-level config key "${key}" (typo?)`);
  }
  if (config.site && typeof config.site.url === 'string' && !/^https?:\/\//.test(config.site.url)) {
    errors.push('site.url must be an absolute http(s) URL');
  }
  if (config.site && config.site.url && /\/$/.test(config.site.url)) {
    warnings.push('site.url should not have a trailing slash');
  }
  if (config.metadata && !Array.isArray(config.metadata.keywords)) {
    warnings.push('metadata.keywords should be an array of strings');
  }

  return { config, errors, warnings };
}

/**
 * Extract HTML headings with precise open/close pairing — WITHOUT regex
 * backreferences. Some V8 builds (e.g. Node 26.8.1) silently fail to match
 * `/<h([1-6])[^>]*>[^<]*<\/\1>/`-style patterns, so pairing is done via
 * indexOf for full cross-version determinism.
 * @param {string} content raw HTML/template content
 * @param {{minLevel?: number, maxLevel?: number}} opts
 * @returns {{level: number, text: string, line: number}[]}
 */
export function extractHtmlHeadings(content, opts = {}) {
  const minLevel = opts.minLevel || 1;
  const maxLevel = opts.maxLevel || 6;
  const headings = [];
  const openRegex = new RegExp(`<h([${minLevel}-${maxLevel}])\\b[^>]*>`, 'gi');
  let m;
  while ((m = openRegex.exec(content)) !== null) {
    const level = parseInt(m[1], 10);
    const closeTag = '</h' + level + '>';
    const lowerFrom = content.slice(m.index + m[0].length).toLowerCase();
    const relEnd = lowerFrom.indexOf(closeTag);
    if (relEnd === -1) continue; // unclosed heading — skip
    const inner = content.slice(m.index + m[0].length, m.index + m[0].length + relEnd);
    const text = inner.replace(/<[^>]+>/g, '').trim();
    headings.push({
      level,
      text,
      line: content.slice(0, m.index).split('\n').length,
      start: m.index,
      end: m.index + m[0].length + relEnd + closeTag.length
    });
    openRegex.lastIndex = m.index + m[0].length + relEnd + closeTag.length;
  }
  return headings;
}

/**
 * Capture console.log output of a function into a string buffer.
 * Used when composing legacy companion tools into a canonical report so
 * the parent tool can keep a clean single-JSON stdout contract.
 * @param {() => any} fn
 * @returns {{result: any, output: string}}
 */
export function captureConsole(fn) {
  const orig = console.log;
  const buf = [];
  console.log = (...args) => buf.push(args.map(a => typeof a === 'string' ? a : String(a)).join(' '));
  try {
    return { result: fn(), output: buf.join('\n') };
  } finally {
    console.log = orig;
  }
}

/**
 * Windows-safe entrypoint guard: true when this module is the executed script.
 * @param {string} importMetaUrl
 */
export function isMain(importMetaUrl) {
  try {
    return !!process.argv[1] &&
      path.resolve(process.argv[1]) === path.resolve(fileURLToPath(importMetaUrl));
  } catch {
    return false;
  }
}
