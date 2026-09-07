#!/usr/bin/env node

/**
 * SPS SEO Secrets & High-Entropy String Scanner
 * Version: 1.3.0
 *
 * Static scan of the codebase for:
 *  - Vendor API key regex patterns (AWS, Azure, GCP, GitHub, OpenAI, Anthropic,
 *    Stripe, Google, Slack, Telegram, Cloudflare, Vercel, Netlify, npm, ...)
 *  - Private key blocks (RSA, OpenSSH, EC, DSA, PGP, PKCS#8 encrypted)
 *  - Database connection strings with embedded credentials
 *  - High-entropy strings (≥ 20 chars, entropy-gated) in likely-secret contexts
 *
 * Intentionally tuned for low false-positive rate:
 *  - Skips node_modules, build outputs, lockfiles, .git
 *  - Skips markdown narrative text (skips .md/.mdx content body)
 *  - Ignores placeholder values ("xxxxx", "your-key-here", "<YOUR_KEY>", env-var refs like ${VAR})
 *  - DOES scan comments (secrets pasted into comments are real leaks)
 *  - DOES scan dotfiles: .env, .env.*, .npmrc, .netrc, .git-credentials
 *  - DOES scan extensionless credential files (id_rsa, .htpasswd, .pgpass)
 *  - DOES scan public/ (hardcoded keys in shipped HTML are real leaks)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// git history helper import is dynamic to keep zero-dep startup fast
function await_import(spec) {
  // Static import already done at top for spawnSync; kept for symmetry
  return { spawnSync };
}

const CWD = process.cwd();

const IGNORE_DIRS = new Set([
  'node_modules', '.git', '.next', '.nuxt', '.svelte-kit', '.astro',
  'dist', 'build', 'out', '.cache', 'coverage', '.gemini', 'scratch',
  '.sps', '.agents', 'seo-preview.html'
]);

const SCAN_EXTS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.html', '.htm', '.astro', '.vue', '.svelte',
  '.json', '.env', '.yml', '.yaml', '.toml',
  '.config.js', '.config.ts', '.config.mjs',
  '.css', '.scss', '.xml', '.sh', '.bash', '.zsh',
  '.pem', '.key', '.p12', '.pfx', '.pub', '.htpasswd', '.pgpass', '.htaccess',
  '.ini', '.conf', '.cfg', '.properties', '.plist', '.xml.release'
]);

// Files scanned by NAME regardless of extension (dotfiles & credential files).
// path.extname('.env.local') returns '.local' and path.extname('.npmrc')
// returns '' — both would be missed by extension matching alone.
const SECRET_FILENAMES = /^(?:\.env(\..+)?|\.npmrc|\.netrc|\.git-credentials|\.htpasswd|\.pgpass|\.gitconfig|\.dockercfg|\.docker\/config\.json|id_rsa(\.pub)?|id_ed25519(\.pub)?|id_ecdsa(\.pub)?|credentials(\.json)?|service-account.*\.json|\.aws\/credentials|secrets?\.(json|ya?ml|txt)|\.secrets)$/i;

const PLACEHOLDERS = /^(x{4,}|your[-_]?(key|token|secret)?[-_]?|example|placeholder|<.+>|\$\{.+\}|process\.env\.|_+|test|changeme|dummy|sample)$/i;

// Values that are *documented* example credentials (AWS docs key, etc.)
const EXAMPLE_VALUES = /(?:EXAMPLE|XXXXXXXX|ZZZZZZZZ|1234567890|AAAABBBB|abcdefghij|qwertyuiop|0123456789abcdef)$/i;

function isExampleValue(val) {
  return EXAMPLE_VALUES.test(val) || /EXAMPLE$/i.test(val);
}

// Test fixtures intentionally contain fake secrets — flagging them is noise.
// Only exact directory segments match (so a temp dir named
// "sps-seo-test-secrets-123" is still scanned).
const TEST_DIR_SEGMENTS = new Set(['tests', 'test', '__tests__', 'fixtures', 'fixture', 'spec', 'specs', '__mocks__', '__snapshots__']);
const TEST_FILENAMES = /(\.test\.|\.spec\.|\.fixture\.)[a-z]+$/i;

function isTestArtifact(relPath) {
  const segments = relPath.split(path.sep);
  if (segments.some(s => TEST_DIR_SEGMENTS.has(s))) return true;
  return TEST_FILENAMES.test(segments[segments.length - 1]);
}

// Vendor secret regexes. Each entry: { name, regex, severity, validator? }
const SECRET_PATTERNS = [
  { name: 'AWS Access Key',     regex: /(A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ABIA|ACCA|ASIA)[A-Z0-9]{16}/g, severity: 'critical' },
  { name: 'AWS Secret Key',     regex: /(?<![A-Za-z0-9/+=])[A-Za-z0-9/+=]{40}(?![A-Za-z0-9/+=])/g, severity: 'high', validator: (str) => entropyCheck(str) >= 4.5 },
  { name: 'GitHub PAT (classic)', regex: /ghp_[A-Za-z0-9]{36}/g, severity: 'critical' },
  { name: 'GitHub Fine-grained',  regex: /github_pat_[A-Za-z0-9_]{82}/g, severity: 'critical' },
  { name: 'GitHub OAuth',         regex: /gho_[A-Za-z0-9]{36}/g, severity: 'critical' },
  { name: 'GitHub App/Refresh',   regex: /(ghu|ghs|ghr)_[A-Za-z0-9]{36}/g, severity: 'critical' },
  { name: 'OpenAI API Key',       regex: /sk-[A-Za-z0-9]{20,}(?:proj-|T3BlbkFJ)?[A-Za-z0-9]{20,}/g, severity: 'critical' },
  { name: 'OpenAI Project Key',   regex: /sk-proj-[A-Za-z0-9_-]{40,}/g, severity: 'critical' },
  { name: 'Anthropic Key',        regex: /sk-ant-[A-Za-z0-9_-]{32,}/g, severity: 'critical' },
  { name: 'Stripe Live Key',      regex: /sk_live_[A-Za-z0-9]{24,}/g, severity: 'critical' },
  { name: 'Stripe Test Key',      regex: /sk_test_[A-Za-z0-9]{24,}/g, severity: 'medium' },
  { name: 'Stripe Restricted',    regex: /rk_live_[A-Za-z0-9]{24,}/g, severity: 'critical' },
  { name: 'Stripe Webhook Secret', regex: /whsec_[A-Za-z0-9]{24,}/g, severity: 'high' },
  { name: 'Google API Key',       regex: /AIza[0-9A-Za-z_-]{35}/g, severity: 'critical' },
  { name: 'GCP Service Account',  regex: /"type"\s*:\s*"service_account"/g, severity: 'high' },
  { name: 'GCP Private Key ID',   regex: /"private_key_id"\s*:\s*"[a-f0-9]{64}"/g, severity: 'high' },
  { name: 'Azure Storage Account Key', regex: /AccountKey=[A-Za-z0-9+/=]{60,}/g, severity: 'critical' },
  { name: 'Azure Connection String', regex: /DefaultEndpointsProtocol=https;AccountName=[^;]+;AccountKey=/g, severity: 'critical' },
  { name: 'Azure Client Secret',  regex: /(?:client[_-]?secret|CLIENT_SECRET)\s*[:=]\s*["'][A-Za-z0-9~._-]{30,}["']/g, severity: 'high' },
  { name: 'Slack Token',          regex: /xox[baprs]-[0-9A-Za-z-]{10,}/g, severity: 'critical' },
  { name: 'Slack Webhook',        regex: /https:\/\/hooks\.slack\.com\/services\/[A-Z0-9/]{20,}/g, severity: 'high' },
  { name: 'npm Token',            regex: /npm_[A-Za-z0-9]{36}/g, severity: 'critical' },
  { name: 'Vercel Token',         regex: /vercel_[A-Za-z0-9]{24,}/g, severity: 'critical' },
  { name: 'Netlify Token',        regex: /nfp_[A-Za-z0-9]{30,}/g, severity: 'critical' },
  { name: 'Cloudflare API Key',   regex: /(?:cloudflare|CF)[_-]?(?:API)?[_-]?KEY\s*[:=]\s*["']?[a-f0-9]{37}["']?/gi, severity: 'critical' },
  { name: 'Telegram Bot Token',   regex: /[0-9]{8,10}:AA[A-Za-z0-9_-]{33}/g, severity: 'high' },
  { name: 'Twilio Account SID',   regex: /AC[a-f0-9]{32}/g, severity: 'high' },
  { name: 'Twilio Auth Token',    regex: /(?:twilio[_-]?auth[_-]?token|TWILIO_AUTH_TOKEN)\s*[:=]\s*["']?[a-f0-9]{32}["']?/gi, severity: 'critical' },
  { name: 'SendGrid Key',         regex: /SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}/g, severity: 'critical' },
  { name: 'Mailgun Key',          regex: /key-[a-f0-9]{32}/g, severity: 'high' },
  { name: 'Datadog Key',          regex: /(?:dd_api_key|DATADOG_API_KEY|dd_api_token)\s*[:=]\s*["']?[a-f0-9]{32}["']?/gi, severity: 'high' },
  { name: 'Sentry Token',         regex: /sntrys_[A-Za-z0-9_/+]{40,}/g, severity: 'high' },
  { name: 'Firebase Server Key',  regex: /AAAA[A-Za-z0-9_-]{7}:[A-Za-z0-9_-]{130,}/g, severity: 'critical' },
  { name: 'Supabase Service Key', regex: /(?:service_role|SUPABASE_SERVICE_ROLE_KEY)[^\n]{0,40}eyJ[A-Za-z0-9_-]+\./gi, severity: 'critical' },
  { name: 'npmrc Auth Token',     regex: /_authToken\s*=\s*[A-Za-z0-9._-]{20,}/g, severity: 'critical' },
  { name: 'Private Key (PKCS#8/RSA/SSH/EC/DSA/PGP)', regex: /-----BEGIN (?:ENCRYPTED )?(?:RSA |OPENSSH |EC |DSA |PGP )?PRIVATE KEY(?: BLOCK)?-----/g, severity: 'critical' },
  { name: 'JWT',                  regex: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, severity: 'high' },
  { name: 'Database Connection String', regex: /(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp):\/\/[A-Za-z0-9_]+:[^\s@'"]{4,}@/g, severity: 'critical' },
  { name: 'SQL Server Connection String', regex: /Server=[^;]+;Database=[^;]+;User Id=[^;]+;Password=[^;\s'"]+/gi, severity: 'critical' },
];

function entropyCheck(str) {
  // Shannon entropy ≥ 4.5 = suspicious; ≥ 5.0 = very suspicious
  const freq = {};
  for (const c of str) freq[c] = (freq[c] || 0) + 1;
  const len = str.length;
  let entropy = 0;
  for (const c in freq) {
    const p = freq[c] / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

function isLikelySecret(str, context) {
  if (PLACEHOLDERS.test(str)) return false;
  if (str.length < 20) return false;
  // Common false-positive contexts: version strings, hashes, hashes of nothing,
  // UUIDs in seed/test fixtures, base64-encoded-but-known content.
  // Skip UUIDs (they're 36 chars with hyphens; entropy low).
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)) return false;
  // Skip short git-style hex (40 chars) unless context is suspicious
  const ctx = context.toLowerCase();
  const suspiciousCtx = /secret|token|api[_-]?key|password|credential|private|bearer/i.test(ctx);
  if (/^[0-9a-f]{40}$/i.test(str) && !suspiciousCtx) return false;
  const entropy = entropyCheck(str);
  // Require entropy ≥ 4.0 always; ≥ 3.5 if context is suspicious.
  return suspiciousCtx ? entropy >= 3.5 : entropy >= 4.0;
}

export function runSecretsScan(options = {}) {
  const projectDir = options.cwd || CWD;
  const findings = [];
  let totalScore = 100;

  function penalize(amount, severity) {
    const weights = { critical: 4, high: 2, medium: 1 };
    totalScore -= amount * (weights[severity] || 1);
  }

  // Pass 1: Vendor regex patterns
  const patternFindings = [];
  function walkPatterns(dir) {
    if (!fs.existsSync(dir)) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (IGNORE_DIRS.has(e.name)) continue;
      const full = path.join(dir, e.name);
      const rel = path.relative(projectDir, full);
      if (e.isDirectory()) { walkPatterns(full); continue; }
      if (!e.isFile()) continue;
      // Fake secrets in test fixtures are noise, not leaks
      if (isTestArtifact(rel)) continue;

      const ext = path.extname(e.name).toLowerCase();
      const isConfig = /\.(config\.(js|ts|mjs)|json|ya?ml|toml|env)$/i.test(e.name);
      const isNamedSecret = SECRET_FILENAMES.test(e.name) || /\.npmrc$/i.test(e.name) || /^id_(rsa|ed25519|ecdsa)(\.pub)?$/i.test(e.name);
      // Scan if: known extension, config naming, OR a credential filename
      // (dotfiles like .npmrc have ext === '' and would otherwise be skipped)
      const shouldScan = SCAN_EXTS.has(ext) || isConfig || isNamedSecret;
      if (!shouldScan) continue;
      // Skip large generated/lock files
      if (/(package-lock|yarn\.lock|pnpm-lock)/.test(e.name)) continue;

      let content;
      try { content = fs.readFileSync(full, 'utf8'); } catch { continue; }
      // Binary guard: NUL byte in the first 8KB means binary — skip
      if (content.slice(0, 8192).includes('\0')) continue;

      // NOTE: comments are deliberately NOT stripped. Secrets pasted into
      // HTML/JS comments are real leaks (they ship to production). Keep raw.
      const scanTarget = content;

      for (const pat of SECRET_PATTERNS) {
        pat.regex.lastIndex = 0;
        let m;
        while ((m = pat.regex.exec(scanTarget)) !== null) {
          const val = m[0];
          if (PLACEHOLDERS.test(val)) continue;
          // Invoke the pattern validator when present (e.g. AWS generic
          // 40-char regex requires entropy — without this, every git SHA
          // in the repo was flagged as an "AWS Secret Key")
          if (pat.validator && !pat.validator(val)) continue;
          patternFindings.push({
            file: path.relative(projectDir, full),
            line: scanTarget.slice(0, m.index).split('\n').length,
            type: pat.name,
            severity: pat.severity,
            preview: maskValue(val)
          });
        }
      }
    }
  }
  walkPatterns(projectDir);

  // Pass 2: Entropy heuristic on strings ≥ 24 chars
  const entropyFindings = [];
  const STRING_LITERAL = /(['"`])(?:\\.|(?!\1).){24,}\1/g;
  function walkEntropy(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (IGNORE_DIRS.has(e.name)) continue;
      const full = path.join(dir, e.name);
      const rel = path.relative(projectDir, full);
      if (e.isDirectory()) walkEntropy(full);
      else if (e.isFile()) {
        // Test fixtures contain fake strings — skip entropy noise too
        if (isTestArtifact(rel)) continue;
        const ext = path.extname(e.name).toLowerCase();
        const isDotEnv = /^\.env(\..+)?$/.test(e.name);
        if (!/\.(ts|tsx|js|jsx|mjs|cjs|json|ya?ml|toml|astro|vue|svelte|html)$/i.test(e.name) && !isDotEnv) continue;
        let content;
        try { content = fs.readFileSync(full, 'utf8'); } catch { continue; }

        // Skip markdown content entirely (prose reduces signal)
        if (/\.(md|mdx)$/i.test(e.name)) continue;

        STRING_LITERAL.lastIndex = 0;
        let m;
        while ((m = STRING_LITERAL.exec(content)) !== null) {
          const val = m[0].slice(1, -1);
          // Get surrounding context (50 chars before)
          const before = content.slice(Math.max(0, m.index - 60), m.index);
          if (!isLikelySecret(val, before)) continue;

          // Skip code-like literals: template chunks with spaces, URLs,
          // regex fragments, paths — entropy alone flags prose/code noise.
          if (/\s/.test(val)) continue;
          if (/^https?:\/\//.test(val)) continue;
          if (/[{}()<>\\]/.test(val)) continue;
          if (/^[/@.~]/.test(val)) continue;
          // Real secrets (base64/hex/alnum) never contain separators like
          // slashes, commas, equals, or multiple dots — but MIME types,
          // category lists, file paths, and URLs always do.
          if (/[/,=]/.test(val)) continue;
          if ((val.match(/\./g) || []).length > 1) continue;

          // Skip if already caught by a vendor pattern
          const dup = patternFindings.some(p => p.file === path.relative(projectDir, full) && Math.abs(p.line - content.slice(0, m.index).split('\n').length) <= 1);
          if (dup) continue;

          entropyFindings.push({
            file: path.relative(projectDir, full),
            line: content.slice(0, m.index).split('\n').length,
            type: 'High-entropy string (likely secret)',
            severity: 'medium',
            preview: maskValue(val),
            entropy: entropyCheck(val).toFixed(2)
          });
        }
      }
    }
  }
  walkEntropy(projectDir);

  // Build findings array & score
  for (const f of patternFindings) {
    findings.push(f);
    penalize(8, f.severity);
  }
  for (const f of entropyFindings) {
    findings.push(f);
    penalize(3, f.severity);
  }

  totalScore = Math.max(0, Math.min(100, Math.round(totalScore)));
  const grade = totalScore >= 95 ? 'A' : totalScore >= 80 ? 'B' : totalScore >= 50 ? 'C' : 'F';

  // ── Optional Pass 3: git history scan (--history) ──────────────
  // Working-tree scans can never catch secrets that were committed and
  // later deleted. This pass streams `git log -p --all` and applies the
  // same vendor patterns, capped to keep the scan bounded.
  let historyFindings = [];
  const wantHistory = options.history || process.argv.includes('--history');
  if (wantHistory && fs.existsSync(path.join(projectDir, '.git'))) {
    historyFindings = scanGitHistory(projectDir);
    for (const f of historyFindings) {
      findings.push(f);
      penalize(4, f.severity);
    }
    totalScore = Math.max(0, Math.min(100, Math.round(totalScore)));
  }

  const result = {
    timestamp: new Date().toISOString(),
    score: totalScore,
    grade,
    findings,
    historyScanned: wantHistory,
    historyFindings: historyFindings.length,
    counts: {
      critical: findings.filter(f => f.severity === 'critical').length,
      high: findings.filter(f => f.severity === 'high').length,
      medium: findings.filter(f => f.severity === 'medium').length,
    }
  };

  if (options.json || process.argv.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
    return result;
  }
  printConsole(result);
  return result;
}

function maskValue(val) {
  if (val.length <= 8) return '***';
  return val.slice(0, 4) + '…' + val.slice(-4) + ` (${val.length} chars)`;
}

// Scan git history for secrets that were committed then removed.
// Streams `git log -p --all -U0` with a hard output cap (50MB) and
// attributes findings to the introducing commit.
function scanGitHistory(projectDir) {
  return _scanGitHistory(projectDir, { spawnSync });
}

function _scanGitHistory(projectDir, child_process) {
  const findings = [];
  const MAX_OUTPUT = 50 * 1024 * 1024; // 50MB cap
  const res = child_process.spawnSync('git', ['log', '-p', '--all', '-U0', '--no-color'], {
    cwd: projectDir,
    encoding: 'utf8',
    maxBuffer: MAX_OUTPUT,
    timeout: 120000,
    windowsHide: true
  });
  if (res.error || !res.stdout) return findings;
  let blob = res.stdout;
  if (blob.length >= MAX_OUTPUT) blob = blob.slice(0, MAX_OUTPUT); // truncated scan

  const commitRe = /^commit ([0-9a-f]{40})/gm;
  const commitPositions = [];
  let cm;
  while ((cm = commitRe.exec(blob)) !== null) commitPositions.push({ hash: cm[1], index: cm.index });

  for (let i = 0; i < commitPositions.length; i++) {
    const chunk = blob.slice(commitPositions[i].index, i + 1 < commitPositions.length ? commitPositions[i + 1].index : blob.length);
    // Track which file each hunk belongs to so test fixtures can be skipped
    const diffFileRe = /^diff --git a\/(\S+) b\/(\S+)/gm;
    const filePositions = [];
    let fm;
    while ((fm = diffFileRe.exec(chunk)) !== null) filePositions.push({ file: fm[2], index: fm.index });

    for (const pat of SECRET_PATTERNS) {
      pat.regex.lastIndex = 0;
      let m;
      let found = false;
      while ((m = pat.regex.exec(chunk)) !== null && !found) {
        const val = m[0];
        if (PLACEHOLDERS.test(val)) continue;
        if (isExampleValue(val)) continue;
        if (pat.validator && !pat.validator(val)) continue;
        // Resolve the file this match belongs to and skip test fixtures
        const curFile = filePositions.length
          ? [...filePositions].reverse().find(fp => fp.index <= m.index)?.file
          : null;
        if (curFile && isTestArtifact(curFile)) continue;
        findings.push({
          file: `git-history@${commitPositions[i].hash.slice(0, 10)}`,
          line: chunk.slice(0, m.index).split('\n').length,
          type: `${pat.name} (in git history)`,
          severity: pat.severity === 'medium' ? 'medium' : 'high',
          preview: maskValue(val)
        });
        found = true; // one finding per pattern per commit is enough
      }
    }
    if (findings.length > 100) break; // hard cap — the history is compromised anyway
  }
  return findings;
}

function printConsole(result) {
  console.log('\n====================================================');
  console.log('     SPS SEO SECRETS & HIGH-ENTROPY SCANNER         ');
  console.log('====================================================\n');
  console.log(`Secrets Scan Score: ${result.score}/100 (Grade: ${result.grade})`);
  console.log(`Findings: ${result.findings.length}  [Critical: ${result.counts.critical}, High: ${result.counts.high}, Medium: ${result.counts.medium}]\n`);

  if (result.findings.length === 0) {
    console.log('  ✓ No vendor-pattern secrets or high-entropy strings detected.\n');
    return;
  }

  const order = ['critical', 'high', 'medium'];
  const icons = { critical: '🚨', high: '❌', medium: '⚠️' };
  for (const sev of order) {
    const items = result.findings.filter(f => f.severity === sev);
    for (const f of items) {
      console.log(`  ${icons[sev]} [${sev.toUpperCase()}] ${f.type}: ${f.preview}`);
      console.log(`     └─ ${f.file}:${f.line}`);
      if (f.entropy) console.log(`     └─ entropy=${f.entropy}`);
      console.log(`     └─ Fix: rotate the secret, scrub git history (git filter-repo), and move to env vars / a secrets manager.`);
    }
  }
  console.log('');
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  runSecretsScan();
}
