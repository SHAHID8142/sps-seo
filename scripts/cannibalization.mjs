#!/usr/bin/env node

/**
 * SPS SEO Keyword Cannibalization & Meta Duplication Detector
 * Version: 1.0.0
 * 
 * Identifies:
 * - Duplicate title tags across pages
 * - Duplicate meta descriptions across pages
 * - Overlapping keyword targeting (cannibalization)
 */

import fs from 'node:fs';
import path from 'node:path';

const CWD = process.cwd();

function extractPageMetadata(filePath) {
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }

  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(content) ||
                     /title:\s*["'`]([^"'`]+)["'`]/i.exec(content);
  const title = titleMatch ? titleMatch[1].trim() : null;

  const descMatch = /<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']/i.exec(content) ||
                    /<meta\s+content=["']([\s\S]*?)["']\s+name=["']description["']/i.exec(content) ||
                    /description:\s*["'`]([^"'`]+)["'`]/i.exec(content);
  const description = descMatch ? descMatch[1].trim() : null;

  const h1Match = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(content);
  const h1 = h1Match ? h1Match[1].replace(/<[^>]+>/g, '').trim() : null;

  return { title, description, h1 };
}

export function detectCannibalization(options = {}) {
  const projectDir = options.cwd || CWD;
  const fileExts = ['.html', '.astro', '.tsx', '.jsx', '.vue', '.svelte'];
  const IGNORED = ['node_modules', '.git', '.next', 'dist', 'build'];

  const pages = [];

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
        // Exclude root shell layouts and documents
        if (e.name.startsWith('_') || e.name.includes('layout')) continue;

        const meta = extractPageMetadata(full);
        if (meta && (meta.title || meta.h1)) {
          pages.push({
            file: path.relative(projectDir, full),
            title: meta.title,
            description: meta.description,
            h1: meta.h1
          });
        }
      }
    }
  }

  walk(projectDir);

  // Group by Title
  const titleMap = new Map();
  const descMap = new Map();
  const h1Map = new Map();

  for (const p of pages) {
    if (p.title) {
      const t = p.title.toLowerCase();
      if (!titleMap.has(t)) titleMap.set(t, []);
      titleMap.get(t).push(p.file);
    }
    if (p.description) {
      const d = p.description.toLowerCase();
      if (!descMap.has(d)) descMap.set(d, []);
      descMap.get(d).push(p.file);
    }
    if (p.h1) {
      const h = p.h1.toLowerCase();
      if (!h1Map.has(h)) h1Map.set(h, []);
      h1Map.get(h).push(p.file);
    }
  }

  const duplicateTitles = [];
  for (const [title, files] of titleMap.entries()) {
    if (files.length > 1) duplicateTitles.push({ title, files });
  }

  const duplicateDescriptions = [];
  for (const [desc, files] of descMap.entries()) {
    if (files.length > 1) duplicateDescriptions.push({ desc, files });
  }

  const duplicateH1s = [];
  for (const [h1, files] of h1Map.entries()) {
    if (files.length > 1) duplicateH1s.push({ h1, files });
  }

  const isHealthy = duplicateTitles.length === 0 && duplicateDescriptions.length === 0 && duplicateH1s.length === 0;

  const result = {
    timestamp: new Date().toISOString(),
    pagesAnalyzed: pages.length,
    duplicateTitles,
    duplicateDescriptions,
    duplicateH1s,
    isHealthy
  };

  if (options.json || process.argv.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
    return result;
  }

  console.log('\n====================================================');
  console.log(' SPS SEO CANNIBALIZATION & META DUPLICATION AUDIT   ');
  console.log('====================================================\n');

  console.log(`Pages Analyzed: ${pages.length}\n`);

  if (isHealthy) {
    console.log('✓ All pages feature distinct titles, meta descriptions, and H1 tags.');
    console.log('✓ Zero internal keyword cannibalization detected!\n');
    return result;
  }

  if (duplicateTitles.length > 0) {
    console.log(`❌ ${duplicateTitles.length} Duplicate Title(s) Detected across multiple pages:`);
    duplicateTitles.forEach(d => {
      console.log(`   └─ "${d.title}" used in:`);
      d.files.forEach(f => console.log(`       • ${f}`));
    });
    console.log('');
  }

  if (duplicateDescriptions.length > 0) {
    console.log(`⚠️ ${duplicateDescriptions.length} Duplicate Meta Description(s) Detected:`);
    duplicateDescriptions.forEach(d => {
      console.log(`   └─ "${d.desc.slice(0, 60)}..." used in:`);
      d.files.forEach(f => console.log(`       • ${f}`));
    });
    console.log('');
  }

  if (duplicateH1s.length > 0) {
    console.log(`⚠️ ${duplicateH1s.length} Duplicate H1 Tag(s) Detected:`);
    duplicateH1s.forEach(d => {
      console.log(`   └─ "${d.h1}" used in:`);
      d.files.forEach(f => console.log(`       • ${f}`));
    });
    console.log('');
  }

  console.log('Actionable Advice:');
  console.log('  1. Differentiate titles to target unique long-tail query variations.');
  console.log('  2. Ensure each page has a unique primary H1 focused on its distinct topic.\n');

  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  detectCannibalization();
}
