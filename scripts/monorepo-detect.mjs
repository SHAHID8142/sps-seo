#!/usr/bin/env node

/**
 * SPS SEO — Monorepo Structure Detector
 * Version: 1.4.0
 *
 * Detects monorepo architectures and enumerates all scannable packages:
 *  - pnpm workspaces (pnpm-workspace.yaml)
 *  - npm/yarn workspaces (package.json "workspaces")
 *  - Nx (nx.json + project.json files)
 *  - Turborepo (turbo.json)
 *  - Lerna (lerna.json)
 *  - Rush (rush.json)
 *  - Bazel (WORKSPACE / MODULE.bazel)
 *  - Cargo workspace (Cargo.toml [workspace])
 *  - Gradle (settings.gradle)
 *
 * Outputs a JSON manifest of detected packages with their root paths,
 * framework hints, and scannable file counts so other tools can fan out.
 *
 * Usage:
 *   npm run monorepo                  (auto-detect from cwd)
 *   npm run monorepo -- --json        (JSON output)
 *   npm run monorepo -- --scan        (also count scannable files per package)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMain, walkFiles, CONTENT_EXTS } from './lib/core.mjs';

function argValue(name, fallback) {
  const idx = process.argv.indexOf(name);
  return idx > -1 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback;
}

const MONOREPO_SIGNALS = [
  { type: 'pnpm-workspace', file: 'pnpm-workspace.yaml', weight: 3 },
  { type: 'nx', file: 'nx.json', weight: 3 },
  { type: 'turborepo', file: 'turbo.json', weight: 3 },
  { type: 'lerna', file: 'lerna.json', weight: 2 },
  { type: 'rush', file: 'rush.json', weight: 3 },
  { type: 'bazel', file: 'WORKSPACE', weight: 2 },
  { type: 'bazel-module', file: 'MODULE.bazel', weight: 2 },
  { type: 'cargo', file: 'Cargo.toml', weight: 1 },
  { type: 'gradle', file: 'settings.gradle', weight: 2 },
  { type: 'gradle-kts', file: 'settings.gradle.kts', weight: 2 },
];

const FRAMEWORK_HINTS = [
  { type: 'next', file: 'next.config.js', alt: 'next.config.mjs', alt2: 'next.config.ts' },
  { type: 'astro', file: 'astro.config.mjs', alt: 'astro.config.ts', alt2: 'astro.config.js' },
  { type: 'nuxt', file: 'nuxt.config.ts', alt: 'nuxt.config.js' },
  { type: 'sveltekit', file: 'svelte.config.js' },
  { type: 'remix', file: 'remix.config.js' },
  { type: 'vite', file: 'vite.config.ts', alt: 'vite.config.js' },
  { type: 'gatsby', file: 'gatsby-config.js', alt: 'gatsby-config.ts' },
  { type: 'docusaurus', file: 'docusaurus.config.js', alt: 'docusaurus.config.ts' },
  { type: 'expo', file: 'app.json' },
  { type: 'laravel', file: 'composer.json' },
  { type: 'django', file: 'manage.py' },
  { type: 'rails', file: 'Gemfile' },
  { type: 'express', file: null, hint: (pkg) => pkg.dependencies?.express || pkg.devDependencies?.express },
  { type: 'fastify', file: null, hint: (pkg) => pkg.dependencies?.fastify || pkg.devDependencies?.fastify },
];

function detectFrameworks(pkgDir) {
  const found = [];
  for (const f of FRAMEWORK_HINTS) {
    if (f.file && fs.existsSync(path.join(pkgDir, f.file))) {
      found.push(f.type); continue;
    }
    if (f.alt && fs.existsSync(path.join(pkgDir, f.alt))) {
      found.push(f.type); continue;
    }
    if (f.alt2 && fs.existsSync(path.join(pkgDir, f.alt2))) {
      found.push(f.type); continue;
    }
    if (f.hint) {
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
        if (f.hint(pkg)) found.push(f.type);
      } catch { /* ignore */ }
    }
  }
  return found;
}

function readPackageJson(pkgDir) {
  try { return JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8')); }
  catch { return null; }
}
function detectPackages(projectDir, type) {
  const packages = [];
  switch (type) {
    case 'pnpm-workspace': {
      try {
        const content = fs.readFileSync(path.join(projectDir, 'pnpm-workspace.yaml'), 'utf8');
        const match = content.match(/packages:\s*\n((?:\s*-\s*['"]?[^'")\n]+['"]?\s*\n?)*)/);
        if (match) {
          const globs = match[1].split('\n').map(l => l.replace(/^\s*-\s*['"]?/, '').replace(/['"]?\s*$/, '').trim()).filter(Boolean);
          for (const glob of globs) expandGlob(projectDir, glob, packages);
        }
      } catch { /* ignore */ }
      break;
    }
    case 'npm-workspaces':
    case 'yarn-workspaces': {
      const pkg = readPackageJson(projectDir);
      const workspaces = pkg?.workspaces || (pkg?.workspaces?.packages || []);
      const globs = Array.isArray(workspaces) ? workspaces : (workspaces.packages || []);
      for (const glob of globs) expandGlob(projectDir, glob, packages);
      break;
    }
    case 'nx': {
      for (const pkgDir of findProjectJsons(projectDir)) {
        packages.push({ path: pkgDir, name: readPackageJson(pkgDir)?.name || path.basename(pkgDir), frameworks: detectFrameworks(pkgDir) });
      }
      break;
    }
    case 'turborepo': {
      for (const scanDir of ['apps', 'packages', 'services', 'sites']) {
        const full = path.join(projectDir, scanDir);
        if (fs.existsSync(full) && fs.statSync(full).isDirectory()) {
          for (const d of fs.readdirSync(full, { withFileTypes: true }).filter(d => d.isDirectory())) {
            const pkgDir = path.join(full, d.name);
            if (fs.existsSync(path.join(pkgDir, 'package.json'))) {
              packages.push({ path: pkgDir, name: readPackageJson(pkgDir)?.name || d.name, frameworks: detectFrameworks(pkgDir) });
            }
          }
        }
      }
      break;
    }
    case 'lerna': {
      try {
        const lerna = JSON.parse(fs.readFileSync(path.join(projectDir, 'lerna.json'), 'utf8'));
        for (const glob of (lerna.packages || ['packages/*'])) expandGlob(projectDir, glob, packages);
      } catch { /* ignore */ }
      break;
    }
    case 'rush': {
      try {
        const rush = JSON.parse(fs.readFileSync(path.join(projectDir, 'rush.json'), 'utf8'));
        for (const proj of (rush.projects || [])) {
          const pkgDir = path.join(projectDir, proj.projectFolder);
          if (fs.existsSync(pkgDir)) packages.push({ path: pkgDir, name: proj.packageName || path.basename(pkgDir), frameworks: detectFrameworks(pkgDir) });
        }
      } catch { /* ignore */ }
      break;
    }
    default: break;
  }
  return packages;
}

function expandGlob(projectDir, glob, packages) {
  const base = glob.replace(/\/\*$/, '').replace(/\*/g, '');
  const fullBase = path.join(projectDir, base);
  if (fs.existsSync(fullBase) && fs.statSync(fullBase).isDirectory()) {
    for (const d of fs.readdirSync(fullBase, { withFileTypes: true }).filter(d => d.isDirectory())) {
      const pkgDir = path.join(fullBase, d.name);
      packages.push({ path: pkgDir, name: readPackageJson(pkgDir)?.name || d.name, frameworks: detectFrameworks(pkgDir) });
    }
  }
}

function findProjectJsons(dir) {
  let results = [];
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return results; }
  for (const entry of entries) {
    if (['node_modules', '.git', 'dist', 'build'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results = results.concat(findProjectJsons(full));
    else if (entry.name === 'project.json') results.push(dir);
  }
  return results;
}

function detectMonorepo(projectDir) {
  const signals = [];
  let totalWeight = 0;
  for (const signal of MONOREPO_SIGNALS) {
    if (fs.existsSync(path.join(projectDir, signal.file))) {
      signals.push(signal.type);
      totalWeight += signal.weight;
    }
  }
  const rootPkg = readPackageJson(projectDir);
  if (rootPkg?.workspaces) {
    const ws = rootPkg.workspaces;
    const globs = Array.isArray(ws) ? ws : (ws.packages || []);
    if (globs.length > 0) { signals.push('npm-workspaces'); totalWeight += 2; }
  }
  let subPackageCount = 0;
  try {
    for (const entry of fs.readdirSync(projectDir, { withFileTypes: true })) {
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        if (fs.existsSync(path.join(projectDir, entry.name, 'package.json'))) subPackageCount++;
      }
    }
  } catch { /* ignore */ }
  if (subPackageCount >= 2 && totalWeight === 0) {
    signals.push('inferred-multi-package');
    totalWeight += 1;
  }
  return { signals, weight: totalWeight, subPackageCount };
}

function analyzeMonorepo(projectDir, options = {}) {
  const jsonOutput = options.json || process.argv.includes('--json');
  const doScan = options.scan || process.argv.includes('--scan');
  const detection = detectMonorepo(projectDir);
  const isMonorepo = detection.weight >= 2 || detection.signals.length > 0;

  if (!isMonorepo) {
    const result = { monorepo: false, reason: 'No monorepo signals detected. This appears to be a single-package project.', root: projectDir };
    if (jsonOutput) { console.log(JSON.stringify(result, null, 2)); return result; }
    console.log('📦 Not a monorepo — single package project.');
    console.log(`   Root: ${projectDir}`);
    console.log('   Tip: Run `sps-seo audit` directly on this directory.');
    return result;
  }

  const primaryType = detection.signals.find(s =>
    ['pnpm-workspace', 'npm-workspaces', 'yarn-workspaces', 'nx', 'turborepo', 'lerna', 'rush'].includes(s)
  ) || detection.signals[0];

  let packages = detectPackages(projectDir, primaryType);
  const seen = new Set();
  packages = packages.filter(p => { if (seen.has(p.path)) return false; seen.add(p.path); return true; });

  if (packages.length === 0) {
    packages.push({ path: projectDir, name: readPackageJson(projectDir)?.name || path.basename(projectDir), frameworks: detectFrameworks(projectDir) });
  }

  if (doScan) {
    for (const pkg of packages) pkg.scannableFiles = walkFiles(pkg.path, { exts: CONTENT_EXTS }).length;
  }

  const frameworksUsed = [...new Set(packages.flatMap(p => p.frameworks))];
  const result = {
    monorepo: true, type: primaryType, signals: detection.signals, root: projectDir,
    packageCount: packages.length, frameworks: frameworksUsed,
    packages: packages.map(p => ({
      name: p.name, path: p.path, frameworks: p.frameworks,
      ...(doScan ? { scannableFiles: p.scannableFiles } : {}),
    })),
  };

  if (jsonOutput) { console.log(JSON.stringify(result, null, 2)); return result; }

  console.log('\n====================================================');
  console.log('        SPS SEO MONOREPO DETECTION REPORT          ');
  console.log('====================================================\n');
  console.log(`Type: ${primaryType}`);
  console.log(`Signals: ${detection.signals.join(', ')}`);
  console.log(`Packages found: ${packages.length}`);
  console.log(`Frameworks detected: ${frameworksUsed.join(', ') || 'none'}`);
  console.log('\nPackages:');
  for (const pkg of packages) {
    const scanInfo = doScan ? ` (${pkg.scannableFiles} scannable files)` : '';
    console.log(`  • ${pkg.name} [${pkg.frameworks.join(', ') || 'unknown'}]${scanInfo}`);
    console.log(`    ${pkg.path}`);
  }
  console.log('\nTip: Run `sps-seo audit` on each package path, or use `sps-seo audit --monorepo` to scan all.\n');
  return result;
}

if (isMain(import.meta.url)) {
  const projectDir = argValue('--dir', process.cwd());
  analyzeMonorepo(projectDir);
}

export { detectMonorepo, detectPackages, detectFrameworks, analyzeMonorepo };

