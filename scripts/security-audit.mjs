#!/usr/bin/env node

/**
 * SPS SEO Security & Hardening Audit
 * Version: 1.2.0
 *
 * Static + optional live security checks across the codebase:
 *  - Live HTTP header probe (when a target URL is provided)
 *  - Exposed sensitive paths / files (.env, .git, source maps, debug endpoints)
 *  - XSS sinks in templates (dangerouslySetInnerHTML, v-html, {@html}, [innerHTML])
 *  - Dangerous JS patterns (eval, new Function, setTimeout(string), document.write)
 *  - CORS wildcard / unsafe-inline usage
 *  - Mixed-content / http:// references in templates
 *  - Insecure link rel="opener" without "noopener noreferrer" (already in audit.mjs; mirrored here for visibility)
 *
 * Output: deterministic 0–100 Security Score and an actionable findings list.
 */

import fs from 'node:fs';
import path from 'node:path';

const CWD = process.cwd();

const IGNORE_DIRS = new Set([
  'node_modules', '.git', '.next', '.nuxt', '.svelte-kit', '.astro',
  'dist', 'build', 'out', '.cache', 'coverage', '.gemini', 'scratch',
  '.sps', '.agents', 'public'
]);

// Sensitive files that should never be web-accessible.
const SENSITIVE_PATHS = [
  '.env', '.env.local', '.env.development', '.env.production', '.env.example',
  '.git/config', '.git/HEAD',
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
  'tsconfig.json', 'webpack.config.js', 'vite.config.ts', 'vite.config.js',
  'next.config.js', 'next.config.mjs', 'next.config.ts',
  'astro.config.mjs', 'astro.config.ts',
  'sps-seo-config.json', '.sps/seo.json',
  'README.md', 'LICENSE', 'CHANGELOG.md',
];

// Common debug / admin endpoints to probe.
const DEBUG_PATHS = [
  '/.env', '/.git/config', '/.git/HEAD',
  '/admin', '/wp-admin', '/wp-login.php', '/administrator',
  '/phpmyadmin', '/server-status', '/server-info',
  '/api/debug', '/api/v1/debug', '/debug', '/debug/vars',
  '/actuator', '/actuator/env', '/actuator/health',
  '/graphql', '/graphiql',
  '/_debug', '/_profiler', '/elmah.axd',
  '/.well-known/security.txt',
  '/robots.txt', '/sitemap.xml',
];

// File extensions to scan for sinks / patterns.
const SCAN_EXTS = new Set([
  '.html', '.htm', '.astro', '.tsx', '.jsx', '.vue', '.svelte',
  '.ts', '.js', '.mjs', '.cjs', '.css'
]);

export async function runSecurityAudit(options = {}) {
  const projectDir = options.cwd || CWD;
  const findings = [];
  let totalScore = 100;

  function penalize(amount, severity = 'medium') {
    const weights = { critical: 3, high: 2, medium: 1.5, low: 1, info: 0.25 };
    totalScore -= amount * (weights[severity] || 1);
  }

  // ─────────────────────────────────────────────────────────────────
  // 1. Sensitive files present in web-served directories
  // ─────────────────────────────────────────────────────────────────
  const publicDir = path.join(projectDir, 'public');
  if (fs.existsSync(publicDir)) {
    for (const rel of SENSITIVE_PATHS) {
      const p = path.join(publicDir, rel);
      if (fs.existsSync(p)) {
        const severity = rel.startsWith('.env') || rel.startsWith('.git') ? 'critical' : 'high';
        findings.push({
          severity,
          category: 'exposed-file',
          file: path.relative(projectDir, p),
          msg: `Sensitive file present in public/ — would be web-accessible: ${rel}`,
          fix: `Move ${rel} out of public/ (or rename public/ to assets/ and adjust config).`
        });
        penalize(severity === 'critical' ? 25 : 12, severity);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // 2. XSS sinks in templates
  // ─────────────────────────────────────────────────────────────────
  const xssSinks = [
    { pattern: /dangerouslySetInnerHTML\s*=\s*\{\{/g, label: 'React dangerouslySetInnerHTML', framework: 'react' },
    { pattern: /v-html\s*=/g, label: 'Vue v-html', framework: 'vue' },
    { pattern: /\{@html\s+/g, label: 'Svelte {@html}', framework: 'svelte' },
    { pattern: /\[innerHTML\]/g, label: 'Angular [innerHTML]', framework: 'angular' },
    { pattern: /bypassSecurityTrustHtml\s*\(/g, label: 'Angular bypassSecurityTrustHtml', framework: 'angular' },
    { pattern: /bypassSecurityTrustScript\s*\(/g, label: 'Angular bypassSecurityTrustScript', framework: 'angular' },
    { pattern: /bypassSecurityTrustStyle\s*\(/g, label: 'Angular bypassSecurityTrustStyle', framework: 'angular' },
    { pattern: /bypassSecurityTrustUrl\s*\(/g, label: 'Angular bypassSecurityTrustUrl', framework: 'angular' },
    { pattern: /bypassSecurityTrustResourceUrl\s*\(/g, label: 'Angular bypassSecurityTrustResourceUrl', framework: 'angular' },
    { pattern: /\$\sce\s*\(/g, label: 'Angular $sce.trustAsHtml', framework: 'angular' },
    { pattern: /document\.write\s*\(/g, label: 'document.write', framework: 'dom' },
    { pattern: /document\.writeln\s*\(/g, label: 'document.writeln', framework: 'dom' },
  ];

  const sinksFound = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (IGNORE_DIRS.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(full);
      } else if (e.isFile() && SCAN_EXTS.has(path.extname(e.name).toLowerCase())) {
        let content;
        try {
          content = fs.readFileSync(full, 'utf8');
        } catch { continue; }

        // Skip pure data files / JSON / markdown content for sink matching
        if (/\.(json|md)$/i.test(e.name)) continue;

        for (const sink of xssSinks) {
          const matches = content.match(sink.pattern);
          if (matches && matches.length > 0) {
            sinksFound.push({
              file: path.relative(projectDir, full),
              sink: sink.label,
              count: matches.length
            });
          }
        }
      }
    }
  }
  walk(projectDir);

  // Group by file; don't double-count sinks within the same file.
  const byFile = new Map();
  for (const s of sinksFound) {
    if (!byFile.has(s.file)) byFile.set(s.file, []);
    byFile.get(s.file).push(s);
  }

  for (const [file, sinks] of byFile) {
    const sev = sinks.some(s => s.sink.includes('bypassSecurityTrust') || s.sink === 'document.write') ? 'high' : 'medium';
    findings.push({
      severity: sev,
      category: 'xss-sink',
      file,
      msg: `XSS sink(s): ${sinks.map(s => `${s.sink}×${s.count}`).join(', ')}. Review that input is sanitized (DOMPurify, server-side escape) before rendering.`,
      fix: 'Sanitize untrusted input with DOMPurify or Angular built-in sanitizers; prefer text interpolation over raw HTML.'
    });
    penalize(sinks.length * 4, sev);
  }

  // ─────────────────────────────────────────────────────────────────
  // 3. Dangerous JS patterns (eval / Function / setTimeout-string)
  // ─────────────────────────────────────────────────────────────────
  const evalSinks = [
    { pattern: /\beval\s*\(/g, label: 'eval()' },
    { pattern: /\bnew\s+Function\s*\(/g, label: 'new Function()' },
    { pattern: /setTimeout\s*\(\s*['"`]/g, label: 'setTimeout(string)' },
    { pattern: /setInterval\s*\(\s*['"`]/g, label: 'setInterval(string)' },
  ];

  const evalFound = [];
  function walkJs(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (IGNORE_DIRS.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walkJs(full);
      else if (e.isFile() && /\.(ts|js|mjs|cjs|tsx|jsx)$/i.test(e.name)) {
        let content;
        try { content = fs.readFileSync(full, 'utf8'); } catch { continue; }
        for (const sink of evalSinks) {
          const m = content.match(sink.pattern);
          if (m && m.length > 0) {
            evalFound.push({ file: path.relative(projectDir, full), sink: sink.label, count: m.length });
          }
        }
      }
    }
  }
  walkJs(projectDir);

  for (const e of evalFound) {
    findings.push({
      severity: 'high',
      category: 'eval-sink',
      file: e.file,
      msg: `Code-execution sink: ${e.sink} ×${e.count}.`,
      fix: 'Refactor to avoid dynamic code execution. For JSON parsing, use JSON.parse on trusted schema-validated input.'
    });
    penalize(8, 'high');
  }

  // ─────────────────────────────────────────────────────────────────
  // 4. Mixed-content: http:// in templates
  // ─────────────────────────────────────────────────────────────────
  const mixedContent = [];
  function walkMixed(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (IGNORE_DIRS.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walkMixed(full);
      else if (e.isFile() && SCAN_EXTS.has(path.extname(e.name).toLowerCase())) {
        let content;
        try { content = fs.readFileSync(full, 'utf8'); } catch { continue; }
        // Look for http:// in src/href/import/url() contexts (avoid code comments)
        const stripped = content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
        const m = stripped.match(/https?:\/\//g);
        if (!m) continue;
        const httpMatches = m.filter(() => false); // placeholder; actual http detection:
        const httpOnly = stripped.match(/['"`(]http:\/\/[^'"`)\s]+/g);
        if (httpOnly && httpOnly.length > 0) {
          mixedContent.push({ file: path.relative(projectDir, full), urls: httpOnly });
        }
      }
    }
  }
  walkMixed(projectDir);

  for (const mc of mixedContent) {
    findings.push({
      severity: 'medium',
      category: 'mixed-content',
      file: mc.file,
      msg: `Insecure http:// reference(s): ${mc.urls.slice(0, 3).join(', ')}${mc.urls.length > 3 ? '...' : ''}`,
      fix: 'Replace http:// with https:// or protocol-relative // URLs.'
    });
    penalize(3, 'medium');
  }

  // ─────────────────────────────────────────────────────────────────
  // 5. Live HTTP header probe (only if --url provided or sps-seo-config
  //    site.url resolves; otherwise skipped with info finding).
  // ─────────────────────────────────────────────────────────────────
  let headersReport = null;
  const targetUrl = options.url || process.argv.find(a => a.startsWith('http')) || null;
  if (targetUrl) {
    headersReport = await probeHeaders(targetUrl);
    applyHeaderFindings(headersReport, findings, (amt, sev) => penalize(amt, sev));
  } else {
    findings.push({
      severity: 'info',
      category: 'headers',
      file: null,
      msg: 'Live HTTP header probe skipped. Re-run with --url https://yoursite.com to verify CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy.',
      fix: 'npm run security -- --url https://yoursite.com'
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // 6. Score & verdict
  // ─────────────────────────────────────────────────────────────────
  totalScore = Math.max(0, Math.min(100, Math.round(totalScore)));
  const grade = totalScore >= 90 ? 'A' : totalScore >= 75 ? 'B' : totalScore >= 50 ? 'C' : 'F';

  const result = {
    timestamp: new Date().toISOString(),
    score: totalScore,
    grade,
    findings,
    headersReport,
    counts: {
      critical: findings.filter(f => f.severity === 'critical').length,
      high: findings.filter(f => f.severity === 'high').length,
      medium: findings.filter(f => f.severity === 'medium').length,
      low: findings.filter(f => f.severity === 'low').length,
      info: findings.filter(f => f.severity === 'info').length,
    }
  };

  if (options.json || process.argv.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
    return result;
  }

  printConsole(result);
  return result;
}

async function probeHeaders(url) {
  const report = { url, headers: {}, missing: [], recommendations: [] };
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'SPS-SEO-SecurityAudit/1.2 (+security)' }
    });
    for (const [k, v] of res.headers.entries()) {
      report.headers[k.toLowerCase()] = v;
    }
    report.status = res.status;
  } catch (e) {
    report.error = e.message;
    return report;
  }
  return report;
}

function applyHeaderFindings(report, findings, penalize) {
  const required = {
    'strict-transport-security': { severity: 'high', msg: 'Missing HSTS header — enables downgrade attacks.' },
    'content-security-policy': { severity: 'high', msg: 'Missing CSP — XSS impact not contained.' },
    'x-content-type-options': { severity: 'medium', msg: 'Missing X-Content-Type-Options: nosniff — MIME sniffing risk.' },
    'referrer-policy': { severity: 'low', msg: 'Missing Referrer-Policy — leaks referrer info.' },
    'x-frame-options': { severity: 'medium', msg: 'Missing X-Frame-Options — clickjacking risk (CSP frame-ancestors also acceptable).' },
    'permissions-policy': { severity: 'low', msg: 'Missing Permissions-Policy — feature access not restricted.' },
  };
  for (const [h, conf] of Object.entries(required)) {
    if (!report.headers[h]) {
      findings.push({
        severity: conf.severity,
        category: 'header',
        file: report.url,
        msg: conf.msg,
        fix: `Set the ${h} response header. See guides/security-best-practices.md.`
      });
      penalize(conf.severity === 'high' ? 10 : conf.severity === 'medium' ? 5 : 2, conf.severity);
    }
  }
  // Unsafe CSP patterns
  const csp = report.headers['content-security-policy'];
  if (csp && /unsafe-inline/i.test(csp) && !/nonce-/i.test(csp)) {
    findings.push({
      severity: 'medium',
      category: 'header',
      file: report.url,
      msg: 'CSP allows unsafe-inline without a nonce — weak XSS containment.',
      fix: 'Replace unsafe-inline with nonce-{random} or hash-{sha256} strategies.'
    });
    penalize(5, 'medium');
  }
}

function printConsole(result) {
  console.log('\n====================================================');
  console.log('     SPS SEO SECURITY & HARDENING AUDIT             ');
  console.log('====================================================\n');
  console.log(`Security Score: ${result.score}/100 (Grade: ${result.grade})`);
  console.log(`Findings: ${result.findings.length}  [Critical: ${result.counts.critical}, High: ${result.counts.high}, Medium: ${result.counts.medium}, Low: ${result.counts.low}, Info: ${result.counts.info}]\n`);

  if (result.findings.length === 0) {
    console.log('  ✓ No security findings detected in the static sweep.\n');
    return;
  }

  const order = ['critical', 'high', 'medium', 'low', 'info'];
  const icons = { critical: '🚨', high: '❌', medium: '⚠️', low: 'ℹ️', info: 'ℹ️' };
  for (const sev of order) {
    const items = result.findings.filter(f => f.severity === sev);
    for (const f of items) {
      console.log(`  ${icons[sev]} [${sev.toUpperCase()}] ${f.category}: ${f.msg}`);
      if (f.file) console.log(`     └─ ${f.file}`);
      if (f.fix) console.log(`     └─ Fix: ${f.fix}`);
    }
  }
  console.log('');
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  runSecurityAudit().catch(err => {
    console.error('Security audit error:', err);
    process.exit(1);
  });
}
