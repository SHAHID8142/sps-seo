#!/usr/bin/env node

/**
 * SPS SEO Dependency Vulnerability Audit
 * Version: 1.0.0
 *
 * Wraps `npm audit --json` (and pnpm/yarn when detected) into the SPS SEO
 * findings format so dependency CVEs are part of the security workflow:
 *
 *  - Detects the package manager from the lockfile present
 *  - Maps vulnerabilities into critical/high/medium/low findings
 *  - Exits non-zero when critical or high advisories exist (CI gate)
 *
 * Zero-dependency: shells out to the package manager CLI only.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const CWD = process.cwd();

function detectPackageManager(projectDir) {
  if (fs.existsSync(path.join(projectDir, 'package-lock.json'))) return 'npm';
  if (fs.existsSync(path.join(projectDir, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(projectDir, 'yarn.lock'))) return 'yarn';
  if (fs.existsSync(path.join(projectDir, 'package.json'))) return 'npm';
  return null;
}

function runAuditJson(pm, projectDir) {
  const isWin = process.platform === 'win32';
  const cmd = pm === 'npm' ? (isWin ? 'npm.cmd' : 'npm') : (isWin ? `${pm}.cmd` : pm);
  // npm audit --json exits non-zero whenever vulnerabilities exist — that is
  // expected here, so we never treat non-zero as a tool failure.
  const res = spawnSync(cmd, pm === 'yarn' ? ['audit', '--json'] : ['audit', '--json', '--no-fund'], {
    cwd: projectDir,
    encoding: 'utf8',
    timeout: 120000,
    windowsHide: true
  });
  const out = (res.stdout || '').trim();
  if (!out) return { error: res.stderr?.trim() || `${pm} audit produced no output (exit ${res.status})` };
  // npm may interleave npm-notice lines; find the first '{'
  const start = out.indexOf('{');
  try {
    return JSON.parse(start >= 0 ? out.slice(start) : out);
  } catch (e) {
    return { error: `Failed to parse ${pm} audit JSON: ${e.message}` };
  }
}

function mapNpmAdvisories(json) {
  const findings = [];
  const vulns = json.vulnerabilities || {};
  for (const [name, v] of Object.entries(vulns)) {
    const severity = (v.severity || 'low').toLowerCase();
    const via = (v.via || [])
      .filter(x => typeof x === 'object')
      .map(x => x.title)
      .filter(Boolean);
    const fixAvailable = v.fixAvailable;
    findings.push({
      name,
      severity,
      range: v.range || 'unknown',
      isDirect: !!v.isDirect || (v.direct === true),
      fixAvailable: fixAvailable === true ? 'yes' : typeof fixAvailable === 'object' ? `${fixAvailable.name}@${fixAvailable.version}` : 'no (breaking or none)',
      title: via[0] || 'Vulnerability advisory',
      count: via.length || 1
    });
  }
  return findings;
}

function penalizeScore(findings) {
  let score = 100;
  for (const f of findings) {
    const weights = { critical: 25, high: 12, moderate: 5, medium: 5, low: 2 };
    score -= weights[f.severity] || 2;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

function printConsole(result) {
  console.log('\n====================================================');
  console.log('     SPS SEO DEPENDENCY VULNERABILITY AUDIT          ');
  console.log('====================================================\n');
  if (result.error) {
    console.log(`  ✗ ${result.error}`);
    return;
  }
  console.log(`Package Manager: ${result.packageManager}`);
  console.log(`Dependency Security Score: ${result.score}/100 (Grade: ${result.grade})`);
  console.log(`Vulnerable packages: ${result.findings.length}  [Critical: ${result.counts.critical}, High: ${result.counts.high}, Moderate: ${result.counts.moderate}, Low: ${result.counts.low}]\n`);

  if (result.findings.length === 0) {
    console.log('  ✓ No known vulnerabilities in the dependency tree.\n');
    return;
  }

  const order = ['critical', 'high', 'moderate', 'low'];
  const icons = { critical: '🚨', high: '❌', moderate: '⚠️', low: 'ℹ️' };
  for (const sev of order) {
    for (const f of result.findings.filter(x => x.severity === sev)) {
      console.log(`  ${icons[sev]} [${sev.toUpperCase()}] ${f.name}@${f.range}${f.isDirect ? ' (direct dep)' : ' (transitive)'} — ${f.title}`);
      console.log(`     └─ Fix available: ${f.fixAvailable} → run \`${result.packageManager} audit fix\` (review breaking changes first)`);
    }
  }
  console.log('');
}

export function runDependencyAudit(options = {}) {
  const projectDir = options.cwd || CWD;
  const pm = options.packageManager || detectPackageManager(projectDir);

  if (!pm) {
    const result = {
      timestamp: new Date().toISOString(),
      score: 100,
      grade: 'A',
      packageManager: null,
      findings: [],
      counts: { critical: 0, high: 0, moderate: 0, low: 0 },
      error: 'No package.json / lockfile found — nothing to audit.'
    };
    if (options.json || process.argv.includes('--json')) { console.log(JSON.stringify(result, null, 2)); return result; }
    printConsole(result);
    return result;
  }

  const raw = runAuditJson(pm, projectDir);
  const rawError = raw.error && typeof raw.error === 'object'
    ? `${raw.error.code || raw.error.summary || 'audit error'}: ${raw.error.summary || JSON.stringify(raw.error)}`
    : raw.error;
  if (rawError && !raw.vulnerabilities) {
    const result = {
      timestamp: new Date().toISOString(),
      score: 100,
      grade: 'A',
      packageManager: pm,
      findings: [],
      counts: { critical: 0, high: 0, moderate: 0, low: 0 },
      error: rawError
    };
    if (options.json || process.argv.includes('--json')) { console.log(JSON.stringify(result, null, 2)); return result; }
    printConsole(result);
    return result;
  }

  const findings = mapNpmAdvisories(raw);
  const score = penalizeScore(findings);
  const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 50 ? 'C' : 'F';
  const counts = {
    critical: findings.filter(f => f.severity === 'critical').length,
    high: findings.filter(f => f.severity === 'high').length,
    moderate: findings.filter(f => f.severity === 'moderate').length,
    low: findings.filter(f => f.severity === 'low').length
  };

  const result = { timestamp: new Date().toISOString(), score, grade, packageManager: pm, findings, counts };
  if (options.json || process.argv.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
    return result;
  }
  printConsole(result);
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const result = runDependencyAudit();
  // CI gate: fail on critical or high advisories
  if (result.counts.critical > 0 || result.counts.high > 0) process.exit(1);
}
