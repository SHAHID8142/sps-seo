#!/usr/bin/env node

/**
 * SPS SEO Secrets & High-Entropy String Scanner
 * Version: 1.2.0
 *
 * Static scan of the codebase for:
 *  - Vendor API key regex patterns (AWS, GitHub, OpenAI, Stripe, Google, Slack, npm)
 *  - Private key blocks (RSA, OpenSSH, PGP)
 *  - High-entropy strings ≥ 32 chars in likely-secret contexts
 *
 * Intentionally tuned for low false-positive rate:
 *  - Skips node_modules, build outputs, lockfiles, .git
 *  - Skips markdown narrative text (skips .md/.mdx content body)
 *  - Ignores placeholder values ("xxxxx", "your-key-here", "<YOUR_KEY>", env-var refs like ${VAR})
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CWD = process.cwd();

const IGNORE_DIRS = new Set([
  'node_modules', '.git', '.next', '.nuxt', '.svelte-kit', '.astro',
  'dist', 'build', 'out', '.cache', 'coverage', '.gemini', 'scratch',
  '.sps', '.agents', 'public', 'seo-preview.html'
]);

const SCAN_EXTS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.html', '.htm', '.astro', '.vue', '.svelte',
  '.json', '.env', '.yml', '.yaml', '.toml',
  '.config.js', '.config.ts', '.config.mjs',
  '.css', '.scss'
]);

const PLACEHOLDERS = /^(x{4,}|your[-_]?(key|token|secret)|example|placeholder|<.+>|\$\{.+\}|process\.env\.|_+)$/i;

// Vendor secret regexes. Each entry: { name, regex, mask(group) }
const SECRET_PATTERNS = [
  { name: 'AWS Access Key',     regex: /AKIA[0-9A-Z]{16}/g, severity: 'critical' },
  { name: 'AWS Secret Key',     regex: /(?<![A-Za-z0-9])[A-Za-z0-9/+=]{40}(?![A-Za-z0-9])/g, severity: 'high', validator: entropyCheck },
  { name: 'GitHub PAT (classic)', regex: /ghp_[A-Za-z0-9]{36}/g, severity: 'critical' },
  { name: 'GitHub Fine-grained',  regex: /github_pat_[A-Za-z0-9_]{82}/g, severity: 'critical' },
  { name: 'GitHub OAuth',         regex: /gho_[A-Za-z0-9]{36}/g, severity: 'critical' },
  { name: 'GitHub App Token',     regex: /(ghu|ghs)_[A-Za-z0-9]{36}/g, severity: 'critical' },
  { name: 'OpenAI API Key',       regex: /sk-[A-Za-z0-9]{20,}(?:proj-|T3BlbkFJ)?[A-Za-z0-9]{20,}/g, severity: 'critical' },
  { name: 'OpenAI Project Key',   regex: /sk-proj-[A-Za-z0-9_-]{40,}/g, severity: 'critical' },
  { name: 'Anthropic Key',        regex: /sk-ant-[A-Za-z0-9_-]{32,}/g, severity: 'critical' },
  { name: 'Stripe Live Key',      regex: /sk_live_[A-Za-z0-9]{24,}/g, severity: 'critical' },
  { name: 'Stripe Test Key',      regex: /sk_test_[A-Za-z0-9]{24,}/g, severity: 'medium' },
  { name: 'Stripe Restricted',    regex: /rk_live_[A-Za-z0-9]{24,}/g, severity: 'critical' },
  { name: 'Google API Key',       regex: /AIza[0-9A-Za-z_-]{35}/g, severity: 'critical' },
  { name: 'Slack Bot Token',      regex: /xoxb-[0-9A-Za-z-]{10,}/g, severity: 'critical' },
  { name: 'Slack User Token',     regex: /xoxp-[0-9A-Za-z-]{10,}/g, severity: 'critical' },
  { name: 'Slack Webhook',        regex: /https:\/\/hooks\.slack\.com\/services\/[A-Z0-9/]{20,}/g, severity: 'high' },
  { name: 'npm Token',            regex: /npm_[A-Za-z0-9]{36}/g, severity: 'critical' },
  { name: 'Private Key (RSA/SSH/PGP)', regex: /-----BEGIN (?:RSA |OPENSSH |EC |DSA |PGP )?PRIVATE KEY-----/g, severity: 'critical' },
  { name: 'JWT',                  regex: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, severity: 'high' },
  { name: 'Twilio Account SID',   regex: /AC[a-f0-9]{32}/g, severity: 'high' },
  { name: 'SendGrid Key',         regex: /SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}/g, severity: 'critical' },
  { name: 'Mailgun Key',          regex: /key-[a-f0-9]{32}/g, severity: 'high' },
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
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (IGNORE_DIRS.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walkPatterns(full);
      else if (e.isFile()) {
        const ext = path.extname(e.name).toLowerCase();
        const isConfig = /\.(config\.(js|ts|mjs)|json|ya?ml|toml|env)$/i.test(e.name);
        if (!SCAN_EXTS.has(ext) && !isConfig) continue;
        // Skip large generated/lock files
        if (/(package-lock|yarn\.lock|pnpm-lock)/.test(e.name)) continue;

        let content;
        try { content = fs.readFileSync(full, 'utf8'); } catch { continue; }

        // Strip code comments and markdown prose to reduce false positives
        const stripped = content
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/(^|\s)\/\/.*$/gm, '')
          .replace(/<!--[\s\S]*?-->/g, '');

        for (const pat of SECRET_PATTERNS) {
          pat.regex.lastIndex = 0;
          let m;
          while ((m = pat.regex.exec(stripped)) !== null) {
            const val = m[0];
            if (PLACEHOLDERS.test(val)) continue;
            patternFindings.push({
              file: path.relative(projectDir, full),
              line: stripped.slice(0, m.index).split('\n').length,
              type: pat.name,
              severity: pat.severity,
              preview: maskValue(val)
            });
          }
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
      if (e.isDirectory()) walkEntropy(full);
      else if (e.isFile()) {
        const ext = path.extname(e.name).toLowerCase();
        if (!/\.(ts|tsx|js|jsx|mjs|cjs|json|ya?ml|env|astro|vue|svelte|html)$/i.test(e.name)) continue;
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

  const result = {
    timestamp: new Date().toISOString(),
    score: totalScore,
    grade,
    findings,
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
