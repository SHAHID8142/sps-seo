#!/usr/bin/env node

/**
 * SPS SEO - Enterprise Security & Best Practices Scanner
 *
 * Deterministic, zero-dependency static analysis engine for:
 * 1. HTTP Security Headers (HSTS, CSP, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy)
 * 2. Public Directory Exposure & Sensitive File Leak Guard (.env, .git, keys, database dumps)
 * 3. Secret & API Token Leak Guard (AWS, Stripe, OpenAI, private keys, database connection strings)
 * 4. Mixed Content & Insecure Transport Detector (http:// assets on https)
 * 5. Dangerous Client-Side DOM Injection & XSS Guard (dangerouslySetInnerHTML, eval, document.write)
 * 6. Web Standards & Accessibility Best Practices (viewport zoom lock, meta charset, deprecated tags, SRI)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CWD = process.cwd();

// Ignored directories for source code scanning
const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  '.astro',
  '.nuxt',
  '.svelte-kit',
  'dist',
  'build',
  'coverage',
  '.turbo',
  '.cache',
  'scripts',
  'tests',
  'test',
  '__tests__',
  'fixtures'
]);

const TEMPLATE_EXTS = new Set([
  '.html', '.htm',
  '.jsx', '.tsx',
  '.astro', '.vue', '.svelte',
  '.php', '.blade.php'
]);

const CODE_EXTS = new Set([
  '.html', '.htm',
  '.jsx', '.tsx', '.js', '.ts', '.mjs', '.cjs',
  '.astro', '.vue', '.svelte',
  '.json', '.yml', '.yaml'
]);

// Dangerous files that should never exist in public/ or static/ directories
const PUBLIC_DANGEROUS_FILES = [
  /^\.env(?:\..*)?$/i,
  /^\.git(?:ignore|modules|attributes)?$/i,
  /^id_rsa(?:\.pub)?$/i,
  /^id_ed25519(?:\.pub)?$/i,
  /\.(?:pem|key|pfx|p12|pkcs12)$/i,
  /\.(?:sql|dump|sqlite|sqlite3|db)$/i,
  /\.(?:bak|backup|swp|old|orig|temp|tmp)$/i,
  /^credentials(?:\.json)?$/i,
  /^service-account.*\.json$/i,
  /^\.DS_Store$/i
];

// High-confidence regex patterns for hardcoded credentials & API keys
const SECRET_PATTERNS = [
  {
    name: 'AWS Access Key ID',
    regex: /\b(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}\b/g,
    severity: 'critical'
  },
  {
    name: 'Private Key Block',
    regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g,
    severity: 'critical'
  },
  {
    name: 'Database Connection String with Password',
    regex: /\b(?:postgres|postgresql|mysql|mongodb|mongodb\+srv|redis):\/\/[a-zA-Z0-9._~%!$&'()*+,;=-]+:[a-zA-Z0-9._~%!$&'()*+,;=-]+@[a-zA-Z0-9.-]+/gi,
    severity: 'critical'
  },
  {
    name: 'Stripe Live Secret Key',
    regex: /\b(?:sk|rk)_live_[0-9a-zA-Z]{24,}\b/g,
    severity: 'critical'
  },
  {
    name: 'OpenAI API Key',
    regex: /\bsk-[a-zA-Z0-9]{48,}\b/g,
    severity: 'high'
  },
  {
    name: 'GitHub Personal Access Token',
    regex: /\bgh[pousr]_[0-9a-zA-Z]{36}\b/g,
    severity: 'high'
  },
  {
    name: 'Slack Bot / User Token',
    regex: /\bxox[baprs]-[0-9a-zA-Z]{10,48}\b/g,
    severity: 'high'
  },
  {
    name: 'Leaked NEXT_PUBLIC_ Secret Variable',
    regex: /\bNEXT_PUBLIC_[A-Z0-9_]*(?:SECRET|PRIVATE|PASSWORD|API_SECRET)\b\s*[:=]\s*["'][^"']+["']/gi,
    severity: 'high'
  }
];

// Deprecated HTML tags flagged by modern HTML5 & Lighthouse Best Practices
const DEPRECATED_TAGS = [
  'center',
  'font',
  'marquee',
  'blink',
  'strike',
  'big',
  'tt',
  'frame',
  'frameset',
  'noframes'
];

/**
 * Scan all files recursively matching extensions, respecting ignore dirs
 */
function walkDir(dir, filterFn, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return fileList;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.has(entry.name)) {
        walkDir(full, filterFn, fileList);
      }
    } else if (entry.isFile()) {
      if (filterFn(entry.name, full)) {
        fileList.push(full);
      }
    }
  }
  return fileList;
}

/**
 * Inspect server / framework config files for HTTP Security Headers
 */
function auditSecurityHeaders(projectDir) {
  const configCandidates = [
    'next.config.js',
    'next.config.mjs',
    'next.config.ts',
    'vercel.json',
    'netlify.toml',
    'public/_headers',
    '_headers',
    'nginx.conf',
    'conf/nginx.conf',
    '.htaccess',
    'astro.config.mjs',
    'nuxt.config.ts'
  ];

  const foundConfigs = [];
  let combinedConfigContent = '';

  for (const candidate of configCandidates) {
    const full = path.join(projectDir, candidate);
    if (fs.existsSync(full)) {
      try {
        const content = fs.readFileSync(full, 'utf8');
        foundConfigs.push(candidate);
        combinedConfigContent += `\n--- ${candidate} ---\n` + content;
      } catch {
        // ignore
      }
    }
  }

  const headers = {
    hsts: {
      name: 'Strict-Transport-Security (HSTS)',
      present: /Strict-Transport-Security/i.test(combinedConfigContent),
      scorePenalty: 15,
      recommendation: 'max-age=63072000; includeSubDomains; preload'
    },
    csp: {
      name: 'Content-Security-Policy (CSP)',
      present: /Content-Security-Policy/i.test(combinedConfigContent),
      scorePenalty: 15,
      recommendation: "default-src 'self'; script-src 'self'; object-src 'none';"
    },
    xFrameOptions: {
      name: 'X-Frame-Options (Clickjacking Protection)',
      present: /X-Frame-Options/i.test(combinedConfigContent),
      scorePenalty: 10,
      recommendation: 'DENY or SAMEORIGIN'
    },
    xContentTypeOptions: {
      name: 'X-Content-Type-Options (MIME-Sniffing Protection)',
      present: /X-Content-Type-Options/i.test(combinedConfigContent) && /nosniff/i.test(combinedConfigContent),
      scorePenalty: 10,
      recommendation: 'nosniff'
    },
    referrerPolicy: {
      name: 'Referrer-Policy',
      present: /Referrer-Policy/i.test(combinedConfigContent),
      scorePenalty: 5,
      recommendation: 'strict-origin-when-cross-origin'
    },
    permissionsPolicy: {
      name: 'Permissions-Policy',
      present: /Permissions-Policy/i.test(combinedConfigContent),
      scorePenalty: 5,
      recommendation: 'camera=(), microphone=(), geolocation=()'
    }
  };

  return {
    foundConfigs,
    headers
  };
}

/**
 * Scan public and static directories for sensitive exposed files
 */
function auditPublicFolderExposure(projectDir) {
  const publicDirs = [
    path.join(projectDir, 'public'),
    path.join(projectDir, 'static'),
    path.join(projectDir, 'src/public'),
    path.join(projectDir, 'dist'),
    path.join(projectDir, 'build')
  ].filter(p => fs.existsSync(p) && fs.statSync(p).isDirectory());

  const exposedFiles = [];

  for (const pDir of publicDirs) {
    try {
      const files = fs.readdirSync(pDir, { withFileTypes: true });
      for (const file of files) {
        for (const regex of PUBLIC_DANGEROUS_FILES) {
          if (regex.test(file.name)) {
            exposedFiles.push({
              dir: path.relative(projectDir, pDir),
              name: file.name,
              fullPath: path.join(pDir, file.name)
            });
            break;
          }
        }
      }
    } catch {
      // ignore
    }
  }

  return exposedFiles;
}

/**
 * Scan project source files for hardcoded secrets and tokens
 */
function auditSecretLeaks(projectDir) {
  const files = walkDir(projectDir, (name) => {
    const ext = path.extname(name).toLowerCase();
    // Exclude example files and test files
    if (name.includes('example') || name.includes('test') || name.includes('spec') || name.includes('fixtures')) {
      return false;
    }
    return CODE_EXTS.has(ext);
  });

  const detectedSecrets = [];

  for (const file of files) {
    let content = '';
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }

    const relPath = path.relative(projectDir, file);

    for (const pattern of SECRET_PATTERNS) {
      pattern.regex.lastIndex = 0;
      let match;
      while ((match = pattern.regex.exec(content)) !== null) {
        // Redact actual secret for safe logging
        const secretVal = match[0];
        const redacted = secretVal.length > 8
          ? secretVal.slice(0, 4) + '...' + secretVal.slice(-4)
          : '***';

        // Calculate line number
        const linesBefore = content.substring(0, match.index).split('\n');
        const lineNumber = linesBefore.length;

        detectedSecrets.push({
          file: relPath,
          line: lineNumber,
          type: pattern.name,
          severity: pattern.severity,
          snippet: redacted
        });
      }
    }
  }

  return detectedSecrets;
}

/**
 * Scan templates for mixed content, XSS vectors, and web best practices
 */
function auditTemplatesAndBestPractices(projectDir) {
  const templateFiles = walkDir(projectDir, (name) => {
    const ext = path.extname(name).toLowerCase();
    if (name.includes('.test.') || name.includes('.spec.')) return false;
    return TEMPLATE_EXTS.has(ext);
  });

  const mixedContent = [];
  const dangerousDom = [];
  const viewportIssues = [];
  const deprecatedTagIssues = [];
  const missingSriScripts = [];
  let metaCharsetCount = 0;
  let missingCharsetCount = 0;

  for (const file of templateFiles) {
    let content = '';
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }

    const relPath = path.relative(projectDir, file);

    // 1. Mixed Content: http:// resources in src/href
    // Whitelist localhost, XML namespaces, and schema.org
    const mixedRegex = /(?:src|href)=["'](http:\/\/(?!(?:localhost|127\.0\.0\.1|schema\.org|www\.w3\.org|xmlns))[^\s"'>]+)["']/gi;
    let match;
    while ((match = mixedRegex.exec(content)) !== null) {
      const url = match[1];
      const linesBefore = content.substring(0, match.index).split('\n');
      mixedContent.push({
        file: relPath,
        line: linesBefore.length,
        url
      });
    }

    // 2. Client-side DOM Injection & XSS vectors
    if (content.includes('dangerouslySetInnerHTML')) {
      // Safe: JSON-LD structured data or pre-sanitized content
      const isJsonLdInjection = /dangerouslySetInnerHTML\s*=\s*{{\s*__html:\s*(?:JSON\.stringify|serializeSchema)/i.test(content);
      const hasSanitizer = /DOMPurify|sanitize|xss|isomorphic-dompurify/i.test(content);
      if (!isJsonLdInjection && !hasSanitizer) {
        const linesBefore = content.substring(0, content.indexOf('dangerouslySetInnerHTML')).split('\n');
        dangerousDom.push({
          file: relPath,
          line: linesBefore.length,
          type: 'dangerouslySetInnerHTML without DOMPurify / sanitization sanitizer'
        });
      }
    }

    if (/(?<![a-zA-Z0-9_$])eval\s*\(/g.test(content)) {
      dangerousDom.push({
        file: relPath,
        line: 1,
        type: 'eval() statement detected'
      });
    }

    if (/(?<![a-zA-Z0-9_$])document\.write\s*\(/g.test(content)) {
      dangerousDom.push({
        file: relPath,
        line: 1,
        type: 'document.write() statement detected (severe performance & security penalty)'
      });
    }

    // 3. Viewport Zoom Lock (Accessibility & Lighthouse violation)
    const viewportRegex = /<meta\b[^>]*name=["']viewport["'][^>]*content=["']([^"']*)["'][^>]*>/gi;
    while ((match = viewportRegex.exec(content)) !== null) {
      const contentAttr = match[1];
      if (/user-scalable\s*=\s*(?:no|0)/i.test(contentAttr) || /maximum-scale\s*=\s*1(?:\.0)?(?!\d)/i.test(contentAttr)) {
        viewportIssues.push({
          file: relPath,
          attr: contentAttr,
          reason: 'Disables user pinch-to-zoom (violates WCAG 1.4.4 and Lighthouse Best Practices)'
        });
      }
    }

    // 4. Deprecated HTML Tags
    for (const tag of DEPRECATED_TAGS) {
      const tagRegex = new RegExp(`<${tag}\\b`, 'gi');
      if (tagRegex.test(content)) {
        deprecatedTagIssues.push({
          file: relPath,
          tag
        });
      }
    }

    // 5. External CDN scripts missing Subresource Integrity (SRI)
    const scriptRegex = /<script\b([^>]*src=["']https?:\/\/(?!localhost)[^"']*["'][^>]*)>/gi;
    while ((match = scriptRegex.exec(content)) !== null) {
      const attrs = match[1];
      const hasIntegrity = /\bintegrity=/i.test(attrs);
      const hasCrossOrigin = /\bcrossorigin=/i.test(attrs);
      // Only flag if loading from external CDN (e.g. cdnjs, unpkg, jsdelivr, stackpath)
      if (/(?:cdnjs|unpkg|jsdelivr|bootstrapcdn|statically|rawgit)/i.test(attrs) && (!hasIntegrity || !hasCrossOrigin)) {
        const srcMatch = /src=["']([^"']+)["']/i.exec(attrs);
        missingSriScripts.push({
          file: relPath,
          src: srcMatch ? srcMatch[1] : 'unknown',
          missing: !hasIntegrity ? 'integrity' : 'crossorigin'
        });
      }
    }

    // 6. Meta charset in HTML documents
    if (file.endsWith('.html') || file.endsWith('.htm') || file.endsWith('.astro')) {
      if (/<meta\b[^>]*charset=/i.test(content)) {
        metaCharsetCount++;
      } else if (/<head\b/i.test(content)) {
        missingCharsetCount++;
      }
    }
  }

  return {
    mixedContent,
    dangerousDom,
    viewportIssues,
    deprecatedTagIssues,
    missingSriScripts,
    metaCharsetCount,
    missingCharsetCount
  };
}

/**
 * Execute full Security & Best Practices Scan
 */
export function scanSecurityAndBestPractices(options = {}) {
  const projectDir = options.projectDir ? path.resolve(options.projectDir) : CWD;

  const headerAudit = auditSecurityHeaders(projectDir);
  const exposedPublicFiles = auditPublicFolderExposure(projectDir);
  const secretLeaks = auditSecretLeaks(projectDir);
  const templateAudit = auditTemplatesAndBestPractices(projectDir);

  // Calculate Deterministic Security & Best Practices Score (0 - 100)
  let score = 100;

  // Header penalties
  if (!headerAudit.headers.hsts.present) score -= headerAudit.headers.hsts.scorePenalty;
  if (!headerAudit.headers.csp.present) score -= headerAudit.headers.csp.scorePenalty;
  if (!headerAudit.headers.xFrameOptions.present) score -= headerAudit.headers.xFrameOptions.scorePenalty;
  if (!headerAudit.headers.xContentTypeOptions.present) score -= headerAudit.headers.xContentTypeOptions.scorePenalty;
  if (!headerAudit.headers.referrerPolicy.present) score -= headerAudit.headers.referrerPolicy.scorePenalty;
  if (!headerAudit.headers.permissionsPolicy.present) score -= headerAudit.headers.permissionsPolicy.scorePenalty;

  // Exposure penalties
  if (exposedPublicFiles.length > 0) {
    score -= Math.min(40, exposedPublicFiles.length * 20);
  }

  // Secret leak penalties
  if (secretLeaks.length > 0) {
    score -= Math.min(50, secretLeaks.length * 25);
  }

  // Mixed content penalties
  if (templateAudit.mixedContent.length > 0) {
    score -= Math.min(20, templateAudit.mixedContent.length * 10);
  }

  // Dangerous DOM penalties
  if (templateAudit.dangerousDom.length > 0) {
    score -= Math.min(25, templateAudit.dangerousDom.length * 15);
  }

  // Viewport zoom lock penalty
  if (templateAudit.viewportIssues.length > 0) {
    score -= Math.min(15, templateAudit.viewportIssues.length * 10);
  }

  // Deprecated tags penalty
  if (templateAudit.deprecatedTagIssues.length > 0) {
    score -= Math.min(15, templateAudit.deprecatedTagIssues.length * 5);
  }

  // Missing SRI scripts penalty
  if (templateAudit.missingSriScripts.length > 0) {
    score -= Math.min(15, templateAudit.missingSriScripts.length * 5);
  }

  score = Math.max(0, score);
  const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : 'F';

  const result = {
    timestamp: new Date().toISOString(),
    score,
    grade,
    isCompliant: score >= 90,
    headers: {
      foundConfigs: headerAudit.foundConfigs,
      items: headerAudit.headers
    },
    exposure: {
      exposedFilesCount: exposedPublicFiles.length,
      exposedFiles: exposedPublicFiles
    },
    secrets: {
      leaksCount: secretLeaks.length,
      leaks: secretLeaks
    },
    templates: {
      mixedContentCount: templateAudit.mixedContent.length,
      mixedContent: templateAudit.mixedContent.slice(0, 10),
      dangerousDomCount: templateAudit.dangerousDom.length,
      dangerousDom: templateAudit.dangerousDom,
      viewportIssuesCount: templateAudit.viewportIssues.length,
      viewportIssues: templateAudit.viewportIssues,
      deprecatedTagCount: templateAudit.deprecatedTagIssues.length,
      deprecatedTags: templateAudit.deprecatedTagIssues,
      missingSriCount: templateAudit.missingSriScripts.length,
      missingSriScripts: templateAudit.missingSriScripts
    }
  };

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return result;
  }

  // Formatted Console Output
  console.log('\n====================================================');
  console.log('    SPS SEO ENTERPRISE SECURITY & BEST PRACTICES    ');
  console.log('====================================================\n');

  console.log(`Security Score:   ${score}/100 [Grade: ${grade}]`);
  console.log(`Compliance State: ${result.isCompliant ? '✅ COMPLIANT (Grade A)' : '⚠️ ATTENTION REQUIRED (<90)'}\n`);

  console.log('1. HTTP Security Headers:');
  if (headerAudit.foundConfigs.length > 0) {
    console.log(`  Config file(s) found: ${headerAudit.foundConfigs.join(', ')}`);
  } else {
    console.log('  ⚠️ No security header config found (checked next.config, vercel.json, netlify.toml, _headers, nginx.conf)');
  }

  for (const [key, item] of Object.entries(headerAudit.headers)) {
    const symbol = item.present ? '✓' : '✗';
    console.log(`  ${symbol} ${item.name}: ${item.present ? 'Configured' : `Missing (-${item.scorePenalty} pts) -> Recommend: ${item.recommendation}`}`);
  }

  console.log('\n2. Public Information Exposure Guard:');
  if (exposedPublicFiles.length === 0) {
    console.log('  ✓ Zero sensitive files or .env files found in public directories.');
  } else {
    for (const exp of exposedPublicFiles) {
      console.log(`  🚨 CRITICAL: Sensitive file exposed in public directory: ${exp.dir}/${exp.name}`);
    }
  }

  console.log('\n3. Secret & API Token Leak Guard:');
  if (secretLeaks.length === 0) {
    console.log('  ✓ No hardcoded private keys, database passwords, or secret tokens detected.');
  } else {
    for (const sec of secretLeaks) {
      console.log(`  🚨 ${sec.severity.toUpperCase()}: ${sec.type} detected in ${sec.file}:${sec.line} [${sec.snippet}]`);
    }
  }

  console.log('\n4. Mixed Content & Transport Security:');
  if (templateAudit.mixedContent.length === 0) {
    console.log('  ✓ Zero insecure http:// resource links detected.');
  } else {
    for (const mc of templateAudit.mixedContent.slice(0, 5)) {
      console.log(`  ⚠️ Insecure HTTP link in ${mc.file}:${mc.line} -> ${mc.url}`);
    }
  }

  console.log('\n5. DOM Injection & XSS Protections:');
  if (templateAudit.dangerousDom.length === 0) {
    console.log('  ✓ No dangerous eval(), document.write(), or unsanitized innerHTML detected.');
  } else {
    for (const dom of templateAudit.dangerousDom) {
      console.log(`  ⚠️ ${dom.type} in ${dom.file}:${dom.line}`);
    }
  }

  console.log('\n6. Web & Accessibility Best Practices:');
  if (templateAudit.viewportIssues.length > 0) {
    for (const vp of templateAudit.viewportIssues) {
      console.log(`  ⚠️ Viewport Zoom Locked in ${vp.file}: "${vp.attr}" (${vp.reason})`);
    }
  } else {
    console.log('  ✓ Viewport supports user zooming (WCAG 1.4.4 compliant).');
  }

  if (templateAudit.deprecatedTagIssues.length > 0) {
    for (const dt of templateAudit.deprecatedTagIssues) {
      console.log(`  ⚠️ Deprecated HTML tag <${dt.tag}> in ${dt.file}`);
    }
  } else {
    console.log('  ✓ Zero deprecated HTML tags (<center>, <font>, <marquee>).');
  }

  if (templateAudit.missingSriScripts.length > 0) {
    for (const sri of templateAudit.missingSriScripts) {
      console.log(`  ⚠️ External CDN script missing ${sri.missing}: ${sri.src} in ${sri.file}`);
    }
  } else {
    console.log('  ✓ External CDN scripts adhere to SRI or local hosting.');
  }

  console.log('\nRemediation Guide:');
  console.log('  - Caching & Security Headers: guides/caching-and-headers-guide.md');
  console.log('  - Lighthouse 100 Playbook:    guides/lighthouse-100-playbook.md\n');

  // Save report to disk if executed directly
  writeSecurityReport(result, projectDir);

  return result;
}

function writeSecurityReport(result, projectDir) {
  const reportPath = path.join(projectDir, 'sps-seo-security-report.md');
  const md = `# SPS SEO Security & Best Practices Audit Report

**Generated:** ${result.timestamp}  
**Overall Security Score:** ${result.score}/100 (Grade: ${result.grade})  
**Compliance Status:** ${result.isCompliant ? 'COMPLIANT (Grade A)' : 'ACTION REQUIRED'}

---

## 1. HTTP Security Headers

| Header | Status | Recommended Configuration |
| :--- | :---: | :--- |
${Object.values(result.headers.items).map(h => `| **${h.name}** | ${h.present ? '✅ Configured' : '❌ Missing'} | \`${h.recommendation}\` |`).join('\n')}

**Config files detected:** ${result.headers.foundConfigs.length > 0 ? result.headers.foundConfigs.join(', ') : 'None'}

---

## 2. Public Folder Exposure Guard

- **Exposed Sensitive Files:** ${result.exposure.exposedFilesCount}
${result.exposure.exposedFiles.map(f => `- 🚨 \`${f.dir}/${f.name}\``).join('\n') || '- None detected.'}

---

## 3. Secret & API Token Leaks

- **Detected Leaks:** ${result.secrets.leaksCount}
${result.secrets.leaks.map(s => `- 🚨 **${s.severity.toUpperCase()}**: \`${s.type}\` in \`${s.file}:${s.line}\` (\`${s.snippet}\`)`).join('\n') || '- None detected.'}

---

## 4. Mixed Content & DOM Security

- **Insecure \`http://\` Links:** ${result.templates.mixedContentCount}
${result.templates.mixedContent.map(m => `- ⚠️ \`${m.file}:${m.line}\` -> \`${m.url}\``).join('\n') || '- None detected.'}

- **Dangerous DOM Injections:** ${result.templates.dangerousDomCount}
${result.templates.dangerousDom.map(d => `- ⚠️ \`${d.type}\` in \`${d.file}:${d.line}\``).join('\n') || '- None detected.'}

---

## 5. Accessibility & Web Standards

- **Viewport Zoom Locking:** ${result.templates.viewportIssuesCount}
${result.templates.viewportIssues.map(v => `- ⚠️ \`${v.file}\`: \`${v.attr}\` (${v.reason})`).join('\n') || '- Compliant (zoom allowed).'}

- **Deprecated HTML Tags:** ${result.templates.deprecatedTagCount}
${result.templates.deprecatedTags.map(t => `- ⚠️ \`<${t.tag}>\` in \`${t.file}\``).join('\n') || '- Zero deprecated tags.'}

- **CDN Scripts Missing SRI:** ${result.templates.missingSriCount}
${result.templates.missingSriScripts.map(s => `- ⚠️ \`${s.src}\` in \`${s.file}\` (missing \`${s.missing}\`)`).join('\n') || '- Compliant.'}

---

## Remediation References
- HTTP Security Headers: [\`guides/caching-and-headers-guide.md\`](guides/caching-and-headers-guide.md)
- Web Best Practices: [\`guides/lighthouse-100-playbook.md\`](guides/lighthouse-100-playbook.md)
`;

  try {
    fs.writeFileSync(reportPath, md, 'utf8');
  } catch {
    // ignore
  }
}

// Auto-run if executed directly
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  // [v1.4 deprecated] Forward to the canonical unified entrypoint
  console.warn('⚠️  Deprecated entrypoint: security-check.mjs is now composed into ./security-audit.mjs. Forwarding...\n');
  const { spawnSync } = await import('node:child_process');
  const res = spawnSync(process.execPath, [
    path.join(path.dirname(fileURLToPath(import.meta.url)), 'security-audit.mjs'),
    ...process.argv.slice(2)
  ], { stdio: 'inherit' });
  process.exit(res.status ?? 0);
}
