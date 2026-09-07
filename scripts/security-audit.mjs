#!/usr/bin/env node

/**
 * SPS SEO Security & Hardening Audit
 * Version: 1.3.0
 *
 * Static + optional live security checks across the codebase:
 *  - Live HTTP header probe (when a target URL is provided) with VALUE
 *    validation: HSTS strength (max-age/includeSubDomains/preload),
 *    nosniff, Referrer-Policy strictness, CSP quality (unsafe-eval,
 *    wildcard script-src, frame-ancestors vs X-Frame-Options)
 *  - Cookie flag audit (Secure / HttpOnly / SameSite on Set-Cookie)
 *  - COOP / COEP / CORP isolation headers
 *  - CORS wildcard detection (Access-Control-Allow-Origin: * + credentials)
 *  - Live debug/admin endpoint probe (/.env, /.git, /actuator, /graphql ...)
 *  - security.txt (RFC 9116) presence
 *  - Source-map exposure (productionBrowserSourceMaps, .map files)
 *  - Exposed sensitive files in public/
 *  - XSS sinks in templates (dangerouslySetInnerHTML, v-html, {@html}, [innerHTML])
 *  - Dangerous JS patterns (eval, new Function, setTimeout(string), document.write)
 *  - Mixed-content / http:// references in templates
 *
 * Output: deterministic 0–100 Security Score and an actionable findings list.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanSecurityAndBestPractices } from './security-check.mjs';
import { captureConsole } from './lib/core.mjs';

const CWD = process.cwd();

const IGNORE_DIRS = new Set([
  'node_modules', '.git', '.next', '.nuxt', '.svelte-kit', '.astro',
  'dist', 'build', 'out', '.cache', 'coverage', '.gemini', 'scratch',
  '.sps', '.agents', 'public',
  // Test fixtures intentionally contain insecure patterns — not real code
  'tests', 'test', '__tests__', 'fixtures', 'spec'
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
  // 1. Sensitive files present in web-served directories (recursive)
  // ─────────────────────────────────────────────────────────────────
  const publicDir = path.join(projectDir, 'public');
  const SERVED_DIR_NAMES = new Set(['public', 'static', 'dist', 'build', 'out']);
  function scanServedDirs(dir, relBase = '') {
    if (!fs.existsSync(dir)) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      const full = path.join(dir, e.name);
      const rel = relBase ? `${relBase}/${e.name}` : e.name;
      if (e.isDirectory()) { scanServedDirs(full, rel); continue; }
      if (!e.isFile()) continue;
      // Any .env* anywhere inside a served dir is critical
      if (/^\.env(\..+)?$/.test(e.name)) {
        findings.push({
          severity: 'critical',
          category: 'exposed-file',
          file: path.relative(projectDir, full),
          msg: `Environment file inside a web-served directory: ${rel}`,
          fix: `Delete or move ${rel} out of the served directory and add it to .gitignore.`
        });
        penalize(25, 'critical');
      }
      // Key material / DB dumps / backup files
      if (/\.(pem|key|p12|pfx|sql|sqlite|sqlite3|db|dump|bak|backup|swp)$/.test(e.name) ||
          /^(id_rsa|id_ed25519|id_ecdsa)(\.pub)?$/.test(e.name) ||
          /^service-account.*\.json$/.test(e.name) || /^credentials.*\.json$/.test(e.name)) {
        findings.push({
          severity: 'critical',
          category: 'exposed-file',
          file: path.relative(projectDir, full),
          msg: `Sensitive file type inside a web-served directory: ${rel}`,
          fix: `Remove ${rel} from the served directory; if it was ever deployed, rotate the credential.`
        });
        penalize(20, 'critical');
      }
      // Root config/lock/docs files only flagged at top level (legacy list)
      if (!rel.includes('/')) {
        const match = SENSITIVE_PATHS.find(s => s === e.name);
        if (match) {
          findings.push({
            severity: 'high',
            category: 'exposed-file',
            file: path.relative(projectDir, full),
            msg: `Build/internal config exposed in public/: ${rel}`,
            fix: `Move ${rel} out of public/.`
          });
          penalize(12, 'high');
        }
      }
    }
  }
  scanServedDirs(publicDir);

  // ─────────────────────────────────────────────────────────────────
  // 1b. Source maps shipped for production
  // ─────────────────────────────────────────────────────────────────
  const sourcemapSignals = [];
  for (const cfg of ['next.config.js', 'next.config.mjs', 'next.config.ts']) {
    const p = path.join(projectDir, cfg);
    if (fs.existsSync(p)) {
      const c = fs.readFileSync(p, 'utf8');
      if (/productionBrowserSourceMaps\s*:\s*true/.test(c)) {
        sourcemapSignals.push(`${cfg}: productionBrowserSourceMaps: true`);
      }
    }
  }
  // .map files inside build output dirs that get deployed
  for (const buildDir of ['dist', 'build', 'out']) {
    const bd = path.join(projectDir, buildDir);
    if (fs.existsSync(bd)) {
      let mapCount = 0;
      (function countMaps(d) {
        let entries;
        try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
        for (const e of entries) {
          const f = path.join(d, e.name);
          if (e.isDirectory()) countMaps(f);
          else if (e.isFile() && e.name.endsWith('.map')) mapCount++;
        }
      })(bd);
      if (mapCount > 0) sourcemapSignals.push(`${buildDir}/ contains ${mapCount} .map file(s)`);
    }
  }
  if (sourcemapSignals.length > 0) {
    findings.push({
      severity: 'medium',
      category: 'source-maps',
      file: sourcemapSignals[0],
      msg: `Source maps may ship to production: ${sourcemapSignals.join('; ')}`,
      fix: 'Disable source maps in production builds (original source code + secrets-in-comments become public).'
    });
    penalize(5, 'medium');
  }

  // ─────────────────────────────────────────────────────────────────
  // 1c. security.txt (RFC 9116) presence
  // ─────────────────────────────────────────────────────────────────
  const securityTxtExists =
    fs.existsSync(path.join(projectDir, 'public/.well-known/security.txt')) ||
    fs.existsSync(path.join(projectDir, '.well-known/security.txt')) ||
    fs.existsSync(path.join(projectDir, 'static/.well-known/security.txt'));
  if (!securityTxtExists) {
    findings.push({
      severity: 'low',
      category: 'security-txt',
      file: null,
      msg: 'Missing /.well-known/security.txt (RFC 9116) — security researchers have no documented contact channel.',
      fix: 'Add public/.well-known/security.txt with Contact: and Expires: fields. See guides/security-best-practices.md.'
    });
    penalize(2, 'low');
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

  // Sinks found in the scanner's own source (regex pattern definitions,
  // docstrings) are not real code — exclude self + companion engine.
  const SELF_FILES = new Set([
    path.resolve(fileURLToPath(import.meta.url)),
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'security-check.mjs'),
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'secrets-scan.mjs'),
  ]);

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
        if (SELF_FILES.has(path.resolve(full))) continue;
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
      else if (e.isFile() && /\.(ts|js|mjs|cjs|tsx|jsx|html|htm|astro|vue|svelte)$/i.test(e.name)) {
        if (SELF_FILES.has(path.resolve(full))) continue;
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
        // Look for http:// in src/href/import/url() contexts (avoid code comments).
        // NOTE: the line-comment stripper must be anchored (^ or non-colon) so
        // `http://` and `https://` URL schemes are never truncated.
        const stripped = content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '');
        const httpOnly = (stripped.match(/['"`(]http:\/\/[^'"`)\s]+/g) || [])
          // XML namespace identifiers are names, not fetchable resources
          .filter(u => !/w3\.org|sitemaps\.org|schemas\.(?:sitemaps\.org|openxmlformats\.org)|schema\.org|localhost|127\.0\.0\.1|purl\.org|xmlns/i.test(u));
        if (httpOnly.length > 0) {
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
    await probeDebugEndpoints(targetUrl, findings, (amt, sev) => penalize(amt, sev));
  } else {
    findings.push({
      severity: 'info',
      category: 'headers',
      file: null,
      msg: 'Live HTTP header probe skipped. Re-run with --url https://yoursite.com to verify CSP, HSTS, cookies, COOP/COEP/CORP, CORS, and exposed debug endpoints.',
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

// [v1.4 composed] Merge the deprecated standalone companion engine into this unified report.
  try {
    const jsonMode = options.json || process.argv.includes('--json');
    result.companion = jsonMode
      ? captureConsole(() => scanSecurityAndBestPractices({ json: true })).result
      : scanSecurityAndBestPractices({});
  } catch (e) {
    result.companion = { error: e.message };
  }

  if (options.json || process.argv.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
    return result;
  }

  printConsole(result);
  return result;
}

async function probeHeaders(url) {
  const report = { url, headers: {}, cookies: [], missing: [], recommendations: [] };
  const baseHeaders = { 'User-Agent': 'SPS-SEO-SecurityAudit/1.3 (+security)' };
  try {
    // HEAD first; fall back to GET because some CDNs (and all cookie-setting
    // flows) return different header sets for HEAD.
    let res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
      headers: baseHeaders
    });
    for (const [k, v] of res.headers.entries()) report.headers[k.toLowerCase()] = v;
    report.status = res.status;

    if (!report.headers['set-cookie'] || !report.headers['content-security-policy']) {
      const getRes = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(8000),
        headers: baseHeaders
      });
      for (const [k, v] of getRes.headers.entries()) {
        if (k.toLowerCase() === 'set-cookie') {
          report.cookies.push(v);
        } else if (!report.headers[k.toLowerCase()]) {
          report.headers[k.toLowerCase()] = v;
        }
      }
      // Node fetch hides repeated set-cookie in headers.getSetCookie()
      try {
        for (const c of getRes.headers.getSetCookie?.() || []) {
          if (!report.cookies.includes(c)) report.cookies.push(c);
        }
      } catch { /* older runtimes */ }
      // Drain body to free the socket
      try { await getRes.arrayBuffer(); } catch { /* ignore */ }
    }
  } catch (e) {
    report.error = e.message;
    return report;
  }
  return report;
}

// Probe common debug/admin/exposed paths. Any status other than
// 401/403/404/410 means the path answers — a potential exposure.
const DEBUG_PROBE_PATHS = [
  { path: '/.env', severity: 'critical', label: 'Environment file' },
  { path: '/.git/config', severity: 'critical', label: 'Git repository metadata' },
  { path: '/.git/HEAD', severity: 'critical', label: 'Git repository metadata' },
  { path: '/.env.local', severity: 'critical', label: 'Environment file' },
  { path: '/server-status', severity: 'high', label: 'Apache server-status' },
  { path: '/debug/vars', severity: 'high', label: 'Go expvar debug endpoint' },
  { path: '/actuator/env', severity: 'high', label: 'Spring Boot actuator env' },
  { path: '/phpmyadmin/', severity: 'medium', label: 'phpMyAdmin' },
  { path: '/wp-login.php', severity: 'info', label: 'WordPress login' },
];

async function probeDebugEndpoints(baseUrl, findings, penalize) {
  const reachable = [];
  let base;
  try { base = new URL(baseUrl); } catch { return; }
  for (const { path: p, severity, label } of DEBUG_PROBE_PATHS) {
    try {
      const res = await fetch(new URL(p, base.origin), {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(6000),
        headers: { 'User-Agent': 'SPS-SEO-SecurityAudit/1.3 (+security)' }
      });
      // Drain body
      try { await res.arrayBuffer(); } catch { /* ignore */ }
      if (![401, 403, 404, 405, 410].includes(res.status)) {
        reachable.push({ path: p, status: res.status, severity, label });
      }
    } catch { /* network error — skip */ }
  }
  for (const r of reachable) {
    findings.push({
      severity: r.severity,
      category: 'exposed-endpoint',
      file: `${base.origin}${r.path}`,
      msg: `${r.label} responds with HTTP ${r.status} — may be publicly exposed.`,
      fix: `Block or authenticate ${r.path} at the server/WAF layer. Verify the response content is not sensitive.`
    });
    penalize(r.severity === 'critical' ? 20 : r.severity === 'high' ? 10 : 4, r.severity);
  }

  // security.txt live check (RFC 9116)
  try {
    const res = await fetch(new URL('/.well-known/security.txt', base.origin), {
      signal: AbortSignal.timeout(6000),
      headers: { 'User-Agent': 'SPS-SEO-SecurityAudit/1.3 (+security)' }
    });
    try { await res.arrayBuffer(); } catch { /* ignore */ }
    if (res.status === 200) {
      findings.push({
        severity: 'info',
        category: 'security-txt',
        file: `${base.origin}/.well-known/security.txt`,
        msg: 'security.txt is published (RFC 9116 compliant).',
        fix: null
      });
    }
  } catch { /* offline — skip */ }
}

function applyHeaderFindings(report, findings, penalize) {
  if (report.error) {
    findings.push({
      severity: 'info',
      category: 'header',
      file: report.url,
      msg: `Live probe failed: ${report.error}`,
      fix: 'Verify the URL is reachable, then re-run.'
    });
    return;
  }
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

  // ── Header VALUE validation (presence alone is not enough) ──────
  const hsts = report.headers['strict-transport-security'];
  if (hsts) {
    const maxAge = /max-age=(\d+)/i.exec(hsts);
    if (!maxAge || parseInt(maxAge[1], 10) < 15552000) {
      findings.push({
        severity: 'medium', category: 'header', file: report.url,
        msg: `HSTS max-age too short (${maxAge ? maxAge[1] : 'absent'}s) — recommend ≥ 15552000 (6 months).`,
        fix: 'Set Strict-Transport-Security: max-age=63072000; includeSubDomains; preload'
      });
      penalize(4, 'medium');
    }
    if (!/includeSubDomains/i.test(hsts)) {
      findings.push({
        severity: 'low', category: 'header', file: report.url,
        msg: 'HSTS missing includeSubDomains — subdomains stay unprotected.',
        fix: 'Append ; includeSubDomains; preload'
      });
      penalize(1, 'low');
    }
  }

  const nosniff = report.headers['x-content-type-options'];
  if (nosniff && !/nosniff/i.test(nosniff)) {
    findings.push({
      severity: 'medium', category: 'header', file: report.url,
      msg: `X-Content-Type-Options has invalid value "${nosniff}" — must be nosniff.`,
      fix: 'Set exactly: X-Content-Type-Options: nosniff'
    });
    penalize(3, 'medium');
  }

  const referrerPolicy = report.headers['referrer-policy'];
  if (referrerPolicy && /unsafe-url|no-referrer-when-downgrade/i.test(referrerPolicy)) {
    findings.push({
      severity: 'low', category: 'header', file: report.url,
      msg: `Weak Referrer-Policy "${referrerPolicy}" — leaks full URLs cross-origin.`,
      fix: 'Use strict-origin-when-cross-origin or no-referrer.'
    });
    penalize(2, 'low');
  }

  // Deprecated header flag
  if (report.headers['x-xss-protection']) {
    findings.push({
      severity: 'low', category: 'header', file: report.url,
      msg: 'X-XSS-Protection is deprecated and ignored by modern browsers — remove it and rely on CSP.',
      fix: 'Delete the X-XSS-Protection header.'
    });
    penalize(0.5, 'low');
  }

  // ── Isolation headers (COOP / COEP / CORP) ──────────────────────
  const isolation = {
    'cross-origin-opener-policy': { sev: 'low', label: 'COOP (Cross-Origin-Opener-Policy)' },
    'cross-origin-embedder-policy': { sev: 'low', label: 'COEP (Cross-Origin-Embedder-Policy)' },
    'cross-origin-resource-policy': { sev: 'low', label: 'CORP (Cross-Origin-Resource-Policy)' },
  };
  for (const [h, conf] of Object.entries(isolation)) {
    if (!report.headers[h]) {
      findings.push({
        severity: conf.sev, category: 'header', file: report.url,
        msg: `Missing ${conf.label} — cross-origin isolation not enforced (Spectre-class mitigations, embed protection).`,
        fix: `Set the ${h} header (e.g. same-origin). See guides/security-best-practices.md.`
      });
      penalize(1.5, conf.sev);
    }
  }

  // ── CORS wildcard detection ─────────────────────────────────────
  const acao = report.headers['access-control-allow-origin'];
  if (acao) {
    const allowCreds = /true/i.test(report.headers['access-control-allow-credentials'] || '');
    if (acao.trim() === '*' && allowCreds) {
      findings.push({
        severity: 'critical', category: 'header', file: report.url,
        msg: 'CORS: Access-Control-Allow-Origin: * combined with Allow-Credentials: true — any site can make credentialed requests.',
        fix: 'Echo a strict origin allowlist instead of * when credentials are enabled.'
      });
      penalize(15, 'critical');
    } else if (acao.trim() === '*') {
      findings.push({
        severity: 'low', category: 'header', file: report.url,
        msg: 'CORS: Access-Control-Allow-Origin: * — acceptable for public static assets, avoid for APIs.',
        fix: 'Restrict to the origins that actually need access.'
      });
      penalize(1, 'low');
    }
  }

  // ── Cookie flag audit ───────────────────────────────────────────
  for (const cookie of report.cookies) {
    const name = (cookie.split(';')[0] || '').split('=')[0]?.trim() || 'unknown';
    const lower = cookie.toLowerCase();
    const problems = [];
    if (!/;\s*httponly/i.test(cookie)) problems.push('HttpOnly missing (XSS can steal the session)');
    if (!/;\s*secure/i.test(cookie)) problems.push('Secure missing (sent over plain HTTP)');
    if (!/;\s*samesite=(strict|lax)/i.test(lower)) problems.push('SameSite missing/None (CSRF exposure)');
    if (problems.length === 0) continue;
    findings.push({
      severity: 'high',
      category: 'cookie',
      file: report.url,
      msg: `Cookie "${name}": ${problems.join('; ')}.`,
      fix: `Set Secure; HttpOnly; SameSite=Lax (or Strict) on the ${name} cookie.`
    });
    penalize(4 * problems.length, 'high');
  }

  // ── CSP quality checks ──────────────────────────────────────────
  const csp = report.headers['content-security-policy'];
  if (csp) {
    if (/unsafe-inline/i.test(csp) && !/nonce-/i.test(csp)) {
      findings.push({
        severity: 'medium',
        category: 'header',
        file: report.url,
        msg: 'CSP allows unsafe-inline without a nonce — weak XSS containment.',
        fix: 'Replace unsafe-inline with nonce-{random} or hash-{sha256} strategies.'
      });
      penalize(5, 'medium');
    }
    if (/unsafe-eval/i.test(csp)) {
      findings.push({
        severity: 'medium',
        category: 'header',
        file: report.url,
        msg: 'CSP allows unsafe-eval — dynamic code execution defeats XSS protections.',
        fix: 'Remove unsafe-eval; fix libraries that require it (Vue 2, old webpack devtool builds).'
      });
      penalize(5, 'medium');
    }
    const scriptSrc = /script-src[^;]*/i.exec(csp)?.[0] || csp;
    if (/\*/.test(scriptSrc) || /https?:\/\//i.test(scriptSrc.replace(/'[^']*'/g, ''))) {
      findings.push({
        severity: 'medium',
        category: 'header',
        file: report.url,
        msg: 'CSP script-src contains wildcards or plain hosts — allows loading scripts from arbitrary origins.',
        fix: 'Pin exact origins and use nonces or hashes for inline scripts.'
      });
      penalize(4, 'medium');
    }
    if (!/frame-ancestors/i.test(csp) && !report.headers['x-frame-options']) {
      findings.push({
        severity: 'medium', category: 'header', file: report.url,
        msg: 'Neither CSP frame-ancestors nor X-Frame-Options present — clickjacking possible.',
        fix: "Add frame-ancestors 'self' to CSP."
      });
      penalize(5, 'medium');
    } else if (/frame-ancestors/i.test(csp) && report.headers['x-frame-options']) {
      findings.push({
        severity: 'info', category: 'header', file: report.url,
        msg: 'Both CSP frame-ancestors and X-Frame-Options set — X-Frame-Options is redundant for modern browsers.',
        fix: 'Consider removing X-Frame-Options; frame-ancestors supersedes it.'
      });
    }
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

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  runSecurityAudit().catch(err => {
    console.error('Security audit error:', err);
    process.exit(1);
  });
}
