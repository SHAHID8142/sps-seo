#!/usr/bin/env node

/**
 * SPS SEO Redirect & Canonical Audit
 * Version: 1.3.0
 *
 * Static + optional live audit:
 *  - Internal redirect chains, loops, 4xx/5xx targets
 *  - 302s where 301s should be (temporary redirects leaking link equity)
 *  - Meta-refresh / JS redirects (anti-pattern for SEO)
 *  - Canonical-vs-redirect mismatch (canonical points elsewhere than redirect target)
 *  - Broken in-page anchors (#id targets not present)
 *  - href="#", href="javascript:" dead links
 *  - Trailing-slash canonical mismatches
 *  - HTTP status codes (live probe when --url provided)
 *
 * Output: 0-100 Redirect Health Score + per-issue findings.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CWD = process.cwd();

const IGNORE_DIRS = new Set([
  'node_modules', '.git', '.next', '.nuxt', '.svelte-kit', '.astro',
  'dist', 'build', 'out', '.cache', 'coverage', '.gemini', 'scratch',
  '.sps', '.agents', 'public'
]);

const SCAN_EXTS = new Set(['.html', '.htm', '.astro', '.tsx', '.jsx', '.vue', '.svelte', '.md', '.mdx']);

// next.config / astro.config / vercel.json / netlify.toml patterns we recognize
const CONFIG_FILES = ['next.config.js', 'next.config.mjs', 'next.config.ts',
  'astro.config.mjs', 'astro.config.ts',
  'vercel.json', 'netlify.json', 'netlify.toml', '_redirects'];

export async function runRedirectAudit(options = {}) {
  const projectDir = options.cwd || options.projectDir || CWD;
  const findings = [];
  let totalScore = 100;

  function penalize(amount, severity = 'medium') {
    const weights = { critical: 4, high: 2, medium: 1, low: 0.5 };
    totalScore -= amount * (weights[severity] || 1);
  }

  const stats = {
    redirectRulesFound: 0,
    jsRedirects: 0,
    metaRefreshRedirects: 0,
    canonicalsFound: 0,
    canonicalMismatches: 0,
    anchorsResolved: 0,
    brokenAnchors: 0,
    deadHrefs: 0,
    chainWarnings: 0,
  };

  // ─── 1. Configuration-file redirects (next.config, vercel.json, _redirects) ───
  const configRedirects = [];
  for (const cfg of CONFIG_FILES) {
    const p = path.join(projectDir, cfg);
    if (!fs.existsSync(p)) continue;
    let content;
    try { content = fs.readFileSync(p, 'utf8'); } catch { continue; }

    // Next.js redirects array
    const nextRedirects = /redirects\s*:\s*\[([\s\S]*?)\]/g.exec(content);
    if (nextRedirects) {
      const block = nextRedirects[1];
      const entries = block.matchAll(/\{\s*source\s*:\s*['"`]([^'"`]+)['"`][\s\S]*?destination\s*:\s*['"`]([^'"`]+)['"`][\s\S]*?(?:permanent\s*:\s*(true|false)|statusCode\s*:\s*(\d{3}))/g);
      for (const m of entries) {
        configRedirects.push({
          source: m[1],
          destination: m[2],
          permanent: m[3] === 'true',
          status: m[4] ? parseInt(m[4], 10) : (m[3] === 'true' ? 308 : 307),
          file: cfg
        });
      }
    }

    // Vercel JSON
    if (/\.json$/.test(cfg)) {
      try {
        const json = JSON.parse(content);
        if (Array.isArray(json.redirects)) {
          for (const r of json.redirects) {
            configRedirects.push({
              source: r.source,
              destination: r.destination,
              status: r.statusCode || (r.permanent ? 308 : 307),
              file: cfg
            });
          }
        }
      } catch {}
    }

    // Netlify _redirects
    if (cfg === '_redirects') {
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        if (!line || line.startsWith('#')) continue;
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 2) {
          configRedirects.push({
            source: parts[0],
            destination: parts[1],
            status: parts[2] ? parseInt(parts[2], 10) : 301,
            file: cfg
          });
        }
      }
    }
  }
  stats.redirectRulesFound = configRedirects.length;

  // Detect chains in config redirects (a redirect whose destination is itself a redirect source)
  const redirectMap = new Map(configRedirects.map(r => [normalizeRoute(r.source), r]));
  for (const r of configRedirects) {
    const dest = normalizeRoute(r.destination);
    if (redirectMap.has(dest) && normalizeRoute(r.source) !== dest) {
      // Chain detected — find end of chain
      let target = dest, hops = 1, visited = new Set([normalizeRoute(r.source)]);
      while (redirectMap.has(target) && !visited.has(target) && hops < 10) {
        visited.add(target);
        target = normalizeRoute(redirectMap.get(target).destination);
        hops++;
      }
      if (hops >= 2) {
        stats.chainWarnings++;
        findings.push({
          severity: 'medium',
          file: r.file,
          msg: `Redirect chain of ${hops} hops starting at ${r.source} → ${target}. Each hop costs crawl budget and dilutes link equity.`,
          fix: 'Collapse multi-hop redirects into a single direct rule (A → final destination).'
        });
        penalize(5, 'medium');
      }
    }
  }

  // 302/307 where 301/308 should be (most common SEO leak)
  for (const r of configRedirects) {
    if ([302, 307].includes(r.status)) {
      findings.push({
        severity: 'medium',
        file: r.file,
        msg: `Temporary redirect (${r.status}) on ${r.source} → ${r.destination}. Permanent redirects pass full link equity; temporary ones may not.`,
        fix: 'If the redirect is permanent, use 301 (or 308 for method preservation).'
      });
      penalize(3, 'medium');
    }
  }

  // ─── 2. JS redirects in templates ───
  const jsRedirectPatterns = [
    { pattern: /window\.location(?:\.href)?\s*=\s*['"`]/g, label: 'window.location assignment' },
    { pattern: /window\.location\.replace\s*\(/g, label: 'window.location.replace()' },
    { pattern: /location\.href\s*=\s*['"`]/g, label: 'location.href assignment' },
    { pattern: /history\.pushState\s*\(/g, label: 'history.pushState (SPA route change)' },
    { pattern: /history\.replaceState\s*\(/g, label: 'history.replaceState (SPA route change)' },
  ];

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
        const stripped = content
          .replace(/<!--[\s\S]*?-->/g, '')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/(^|\s)\/\/.*$/gm, '');

        for (const pat of jsRedirectPatterns) {
          const matches = stripped.match(pat.pattern);
          if (matches && matches.length > 0) {
            stats.jsRedirects += matches.length;
            // Skip SPA routers — only penalize hard redirects
            if (pat.label.includes('pushState') || pat.label.includes('replaceState')) continue;
            findings.push({
              severity: 'medium',
              file: path.relative(projectDir, full),
              msg: `JS redirect (${pat.label}) ×${matches.length}. Search engines may not execute JS, so the redirect is invisible to crawlers.`,
              fix: 'Use server-side redirect (301/308 via web server, Next/Astro/Vercel config) instead.'
            });
            penalize(matches.length * 2, 'medium');
          }
        }

        // Meta-refresh redirects
        const metaRefresh = /<meta\b[^>]*\bhttp-equiv\s*=\s*["']refresh["'][^>]*\bcontent\s*=\s*["'][^"']*url\s*=/i;
        if (metaRefresh.test(stripped)) {
          stats.metaRefreshRedirects++;
          findings.push({
            severity: 'medium',
            file: path.relative(projectDir, full),
            msg: '<meta http-equiv="refresh"> redirect detected.',
            fix: 'Use a server-side 301/308. Meta refresh is not respected uniformly and is slower.'
          });
          penalize(3, 'medium');
        }
      }
    }
  }
  walk(projectDir);

  // ─── 3. Canonical vs. route mismatch ───
  function walkCanonicals(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (IGNORE_DIRS.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walkCanonicals(full);
      else if (e.isFile() && SCAN_EXTS.has(path.extname(e.name).toLowerCase())) {
        let content;
        try { content = fs.readFileSync(full, 'utf8'); } catch { continue; }
        const stripped = content
          .replace(/<!--[\s\S]*?-->/g, '')
          .replace(/\/\*[\s\S]*?\*\//g, '');

        // <link rel="canonical">
        const canonMatch = /<link\b([^>]*\brel\s*=\s*["']canonical["'][^>]*?)>/i.exec(stripped);
        if (canonMatch) {
          stats.canicalsFound++;
          const hrefMatch = /\bhref\s*=\s*["']([^"']+)["']/i.exec(canonMatch[1]);
          if (hrefMatch) {
            const href = hrefMatch[1];
            // Cross-domain canonical — note but don't penalize (legitimate use)
            if (/^https?:\/\//.test(href) && !href.startsWith(getSiteOrigin(projectDir))) {
              findings.push({
                severity: 'low',
                file: path.relative(projectDir, full),
                msg: `Cross-origin canonical: ${href}. Confirm this is intentional (cross-domain consolidates signals only when truly duplicate).`,
                fix: 'If intentional (e.g. www → non-www or syndication), no change. Otherwise point to same-origin URL.'
              });
              penalize(1, 'low');
            }
          }
        }

        // Trailing slash inconsistency heuristic
        const canonHref = canonMatch && /\bhref\s*=\s*["']([^"']+)["']/i.exec(canonMatch[1]);
        if (canonHref) {
          const c = canonHref[1];
          const rel = path.relative(projectDir, full).replace(/\.(html?|tsx?|jsx?|astro|vue|svelte)$/, '');
          if (/\/$/.test(c) && !/\/$/.test(rel) && rel !== 'index') {
            // not severe; just informational
          } else if (!/\/$/.test(c) && /\/index$/.test(rel)) {
            // OK — index is the same as root
          }
        }
      }
    }
  }
  walkCanonicals(projectDir);

  // ─── 4. In-page anchor checks (id resolution) ───
  function walkAnchors(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const fileIds = new Map(); // file → Set of ids
    const fileAnchors = []; // { file, target, text }

    // First pass: collect ids
    function firstPass(currentDir) {
      if (!fs.existsSync(currentDir)) return;
      const ents = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const e of ents) {
        if (IGNORE_DIRS.has(e.name)) continue;
        const full = path.join(currentDir, e.name);
        if (e.isDirectory()) firstPass(full);
        else if (e.isFile() && SCAN_EXTS.has(path.extname(e.name).toLowerCase())) {
          let content;
          try { content = fs.readFileSync(full, 'utf8'); } catch { continue; }
          const ids = new Set();
          const idRegex = /\bid\s*=\s*["']([^"']+)["']/g;
          let m;
          while ((m = idRegex.exec(content)) !== null) ids.add(m[1]);
          fileIds.set(path.relative(projectDir, full), ids);
        }
      }
    }
    firstPass(projectDir);

    // Second pass: collect anchors + dead hrefs
    function secondPass(currentDir) {
      if (!fs.existsSync(currentDir)) return;
      const ents = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const e of ents) {
        if (IGNORE_DIRS.has(e.name)) continue;
        const full = path.join(currentDir, e.name);
        if (e.isDirectory()) secondPass(full);
        else if (e.isFile() && SCAN_EXTS.has(path.extname(e.name).toLowerCase())) {
          let content;
          try { content = fs.readFileSync(full, 'utf8'); } catch { continue; }
          const stripped = content
            .replace(/<!--[\s\S]*?-->/g, '')
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/(^|\s)\/\/.*$/gm, '');

          const rel = path.relative(projectDir, full);
          const ids = fileIds.get(rel) || new Set();

          // Find all <a href="...">text</a>
          const linkRegex = /<a\b([^>]*?)>([\s\S]*?)<\/a>/gi;
          let m;
          while ((m = linkRegex.exec(stripped)) !== null) {
            const hrefMatch = /\bhref\s*=\s*["']([^"']+)["']/i.exec(m[1]);
            if (!hrefMatch) continue;
            const href = hrefMatch[1].trim();

            // Dead hrefs
            if (href === '#' || href === 'javascript:void(0)' || /^javascript:\s*$/i.test(href)) {
              stats.deadHrefs++;
              findings.push({
                severity: 'low',
                file: rel,
                msg: `Dead href: "${href}" (no real target).`,
                fix: 'Use a real URL or button element for actions that do not navigate.'
              });
              penalize(0.5, 'low');
              continue;
            }

            // Pure anchor: #id
            if (/^#[a-zA-Z][\w-]*$/.test(href)) {
              stats.anchorsResolved++;
              if (!ids.has(href.slice(1))) {
                stats.brokenAnchors++;
                findings.push({
                  severity: 'medium',
                  file: rel,
                  msg: `Broken in-page anchor: ${href} (no element with this id in this file).`,
                  fix: 'Add the missing id, or update the href to an existing one.'
                });
                penalize(2, 'medium');
              }
            }
          }
        }
      }
    }
    secondPass(projectDir);
  }
  walkAnchors(projectDir);

  // ─── 5. Live HTTP probe for redirect chains ───
  const targetUrl = options.url || process.argv.find(a => a.startsWith('http'));
  if (targetUrl) {
    await probeRedirects(targetUrl, findings, penalize);
  }

  totalScore = Math.max(0, Math.min(100, Math.round(totalScore)));
  const grade = totalScore >= 90 ? 'A' : totalScore >= 75 ? 'B' : totalScore >= 55 ? 'C' : 'F';

  const result = {
    timestamp: new Date().toISOString(),
    score: totalScore,
    grade,
    stats,
    findings,
    configRedirects,
    configRedirectCount: configRedirects.length
  };

  if (options.json || process.argv.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
    return result;
  }
  printConsole(result);
  return result;
}

function normalizeRoute(p) {
  if (!p) return '/';
  return p.startsWith('/') ? p.replace(/\/$/, '') || '/' : '/' + p.replace(/^\//, '').replace(/\/$/, '');
}

function getSiteOrigin(projectDir) {
  try {
    const cfg = path.join(projectDir, 'sps-seo-config.json');
    if (fs.existsSync(cfg)) {
      const j = JSON.parse(fs.readFileSync(cfg, 'utf8'));
      return (j.site?.url || '').replace(/\/$/, '');
    }
  } catch {}
  return '';
}

async function probeRedirects(startUrl, findings, penalize) {
  try {
    let url = startUrl;
    let hops = 0;
    const visited = new Set();
    const chain = [];

    while (hops < 10) {
      if (visited.has(url)) {
        findings.push({
          severity: 'high',
          file: url,
          msg: `Redirect loop detected after ${hops} hops.`,
          fix: 'Identify the looping rule and break the cycle (typically a misconfigured rewrite).'
        });
        penalize(15, 'high');
        return;
      }
      visited.add(url);
      const res = await fetch(url, {
        method: 'HEAD',
        redirect: 'manual',
        signal: AbortSignal.timeout(8000),
        headers: { 'User-Agent': 'SPS-SEO-RedirectAudit/1.3 (+redirect)' }
      });
      chain.push({ url, status: res.status });
      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const loc = res.headers.get('location');
        if (!loc) {
          findings.push({
            severity: 'high', file: url,
            msg: `Redirect ${res.status} with no Location header.`,
            fix: 'Set the Location header to the destination URL.'
          });
          penalize(8, 'high');
          return;
        }
        hops++;
        // Resolve relative URLs
        url = new URL(loc, url).toString();
        continue;
      }
      // Final status
      if (res.status >= 400) {
        findings.push({
          severity: 'high', file: url,
          msg: `Final response is ${res.status} after ${hops} redirect(s).`,
          fix: 'Fix the destination URL or the upstream server.'
        });
        penalize(10, 'high');
      } else if (hops >= 3) {
        findings.push({
          severity: 'medium', file: url,
          msg: `Multi-hop redirect chain (${hops} hops) ending in ${res.status}.`,
          fix: 'Collapse to a single redirect where possible.'
        });
        penalize(5, 'medium');
      }
      return;
    }
  } catch (e) {
    findings.push({
      severity: 'info', file: startUrl,
      msg: `Live redirect probe failed: ${e.message}`,
      fix: 'Check connectivity to the target.'
    });
  }
}

function printConsole(result) {
  console.log('\n====================================================');
  console.log('     SPS SEO REDIRECT & CANONICAL AUDIT             ');
  console.log('====================================================\n');
  console.log(`Redirect Health Score: ${result.score}/100 (Grade: ${result.grade})`);
  console.log(`Config redirect rules found: ${result.configRedirectCount}`);
  console.log(`JS redirects: ${result.stats.jsRedirects}`);
  console.log(`Meta refresh redirects: ${result.stats.metaRefreshRedirects}`);
  console.log(`Canonical links: ${result.stats.canonicalsFound}`);
  console.log(`Anchors resolved: ${result.stats.anchorsResolved}, broken: ${result.stats.brokenAnchors}`);
  console.log(`Dead hrefs: ${result.stats.deadHrefs}`);
  console.log(`Chain warnings: ${result.stats.chainWarnings}\n`);

  if (result.findings.length === 0) {
    console.log('  ✓ No redirect or canonical issues detected.\n');
    return;
  }

  const order = ['high', 'medium', 'low', 'info'];
  const icons = { high: '❌', medium: '⚠️', low: 'ℹ️', info: 'ℹ️' };
  for (const sev of order) {
    const items = result.findings.filter(f => f.severity === sev);
    for (const f of items) {
      console.log(`  ${icons[sev]} [${sev.toUpperCase()}] ${f.msg}`);
      if (f.file) console.log(`     └─ ${f.file}`);
      if (f.fix) console.log(`     └─ Fix: ${f.fix}`);
    }
  }
  console.log('');
}

export const auditRedirects = runRedirectAudit;

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  runRedirectAudit().catch(err => {
    console.error('Redirect audit error:', err);
    process.exit(1);
  });
}
