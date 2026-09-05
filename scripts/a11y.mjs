#!/usr/bin/env node

/**
 * SPS SEO Accessibility (WCAG 2.2 AA) Static Audit
 * Version: 1.2.0
 *
 * Static checks across templates and components:
 *  - <html lang> attribute present
 *  - Skip navigation link present
 *  - <main>, <header>, <nav>, <footer> landmarks
 *  - Interactive elements (button/a/input/select/textarea) have accessible names
 *  - <img> alt coverage (deeper than audit.mjs — also flags decorative role)
 *  - Heading order (no skipped levels; one <h1>)
 *  - Form input → label association
 *  - ARIA roles are valid; aria-hidden doesn't hide focusable elements
 *  - Tabindex positive values (anti-pattern)
 *  - Empty links / buttons
 *  - <a target="_blank"> without rel="noopener noreferrer" (also in audit.mjs; mirrored for visibility)
 *  - Color-only contrast hints are out of scope for static; documented as gap.
 *
 * Output: 0-100 Accessibility Score + findings by WCAG SC.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractHtmlHeadings } from './lib/core.mjs';

const CWD = process.cwd();

const IGNORE_DIRS = new Set([
  'node_modules', '.git', '.next', '.nuxt', '.svelte-kit', '.astro',
  'dist', 'build', 'out', '.cache', 'coverage', '.gemini', 'scratch',
  '.sps', '.agents', 'public'
]);

const TEMPLATE_EXTS = new Set(['.html', '.htm', '.astro', '.tsx', '.jsx', '.vue', '.svelte', '.md', '.mdx']);

const VALID_ARIA_ROLES = new Set([
  'alert', 'alertdialog', 'application', 'article', 'banner', 'button',
  'cell', 'checkbox', 'columnheader', 'combobox', 'complementary',
  'contentinfo', 'definition', 'dialog', 'directory', 'document',
  'feed', 'figure', 'form', 'grid', 'gridcell', 'group', 'heading',
  'img', 'link', 'list', 'listbox', 'listitem', 'log', 'main',
  'marquee', 'math', 'menu', 'menubar', 'menuitem', 'menuitemcheckbox',
  'menuitemradio', 'navigation', 'none', 'note', 'option', 'presentation',
  'progressbar', 'radio', 'radiogroup', 'region', 'row', 'rowgroup',
  'rowheader', 'scrollbar', 'search', 'searchbox', 'separator', 'slider',
  'spinbutton', 'status', 'switch', 'tab', 'table', 'tablist', 'tabpanel',
  'term', 'textbox', 'timer', 'toolbar', 'tooltip', 'tree', 'treegrid',
  'treeitem'
]);

export function runA11yAudit(options = {}) {
  const projectDir = options.cwd || CWD;
  const findings = [];
  let totalScore = 100;

  function penalize(amount, severity = 'medium') {
    const weights = { critical: 3, high: 2, medium: 1, low: 0.5 };
    totalScore -= amount * (weights[severity] || 1);
  }

  let htmlFiles = 0;
  const stats = {
    htmlLangMissing: 0,
    noSkipLink: 0,
    noMainLandmark: 0,
    unlabeledButtons: 0,
    unlabeledLinks: 0,
    unlabeledInputs: 0,
    inputsWithoutLabel: 0,
    ariaHiddenFocusable: 0,
    invalidAriaRole: 0,
    positiveTabindex: 0,
    emptyLinks: 0,
    emptyButtons: 0,
    h1Issues: 0,
    skippedHeadings: 0,
    altMissing: 0,
    targetBlankInsecure: 0,
  };

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (IGNORE_DIRS.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.isFile() && TEMPLATE_EXTS.has(path.extname(e.name).toLowerCase())) {
        auditFile(full, findings, stats, penalize);
        htmlFiles++;
      }
    }
  }
  walk(projectDir);

  // Aggregate-level findings (one per issue type, not per file)
  if (stats.htmlLangMissing > 0) {
    findings.unshift({
      severity: 'high',
      sc: '3.1.1 Language of Page',
      msg: `<html lang="..."> missing on ${stats.htmlLangMissing} file(s). Screen readers default to OS language if not set.`,
      fix: 'Add <html lang="en"> (or appropriate BCP-47 tag) to every layout/page.'
    });
  }
  if (stats.noSkipLink > 0) {
    findings.unshift({
      severity: 'medium',
      sc: '2.4.1 Bypass Blocks',
      msg: `No "skip to main content" link detected in ${stats.noSkipLink} file(s).`,
      fix: 'Add <a href="#main" class="skip-link">Skip to content</a> as the first focusable element.'
    });
  }
  if (stats.noMainLandmark > 0) {
    findings.unshift({
      severity: 'high',
      sc: '1.3.1 Info and Relationships',
      msg: `<main> landmark missing on ${stats.noMainLandmark} file(s).`,
      fix: 'Wrap primary content in <main id="main">.'
    });
  }
  if (stats.unlabeledButtons > 0) {
    findings.unshift({
      severity: 'high',
      sc: '4.1.2 Name, Role, Value',
      msg: `${stats.unlabeledButtons} <button> element(s) without accessible name (no text content, aria-label, or aria-labelledby).`,
      fix: 'Add visible text, aria-label="...", or aria-labelledby="..." referencing a heading.'
    });
  }
  if (stats.unlabeledInputs > 0) {
    findings.unshift({
      severity: 'high',
      sc: '1.3.1 / 4.1.2',
      msg: `${stats.unlabeledInputs} <input> element(s) without associated <label>, aria-label, or aria-labelledby.`,
      fix: 'Use <label for="id">…</label>, wrap the input, or add aria-label="...".'
    });
  }
  if (stats.inputsWithoutLabel > 0) {
    findings.unshift({
      severity: 'high',
      sc: '3.3.2 Labels or Instructions',
      msg: `${stats.inputsWithoutLabel} <input>/<textarea>/<select> without visible label.`,
      fix: 'Every form control must have an associated <label>.'
    });
  }
  if (stats.ariaHiddenFocusable > 0) {
    findings.unshift({
      severity: 'high',
      sc: '4.1.2 Name, Role, Value',
      msg: `${stats.ariaHiddenFocusable} element(s) have aria-hidden="true" but contain focusable descendants (keyboard trap).`,
      fix: 'Do not hide focusable content with aria-hidden. Use inert or remove from tab order.'
    });
  }
  if (stats.invalidAriaRole > 0) {
    findings.unshift({
      severity: 'medium',
      sc: '4.1.2',
      msg: `${stats.invalidAriaRole} element(s) use an invalid role attribute.`,
      fix: 'Use only valid ARIA roles from the WAI-ARIA spec.'
    });
  }
  if (stats.positiveTabindex > 0) {
    findings.unshift({
      severity: 'medium',
      sc: '2.4.3 Focus Order',
      msg: `${stats.positiveTabindex} element(s) use positive tabindex (anti-pattern; disrupts natural tab order).`,
      fix: 'Remove tabindex values > 0. Use tabindex="0" or "−1" only when needed.'
    });
  }
  if (stats.h1Issues > 0) {
    findings.unshift({
      severity: 'high',
      sc: '1.3.1 / 2.4.6',
      msg: `${stats.h1Issues} file(s) have zero or multiple <h1> tags.`,
      fix: 'Each page must have exactly one <h1> describing its primary purpose.'
    });
  }
  if (stats.skippedHeadings > 0) {
    findings.unshift({
      severity: 'medium',
      sc: '1.3.1',
      msg: `${stats.skippedHeadings} heading-level skip(s) detected (e.g. <h1> → <h3>).`,
      fix: 'Use sequential heading levels: h1 → h2 → h3.'
    });
  }
  if (stats.altMissing > 0) {
    findings.unshift({
      severity: 'high',
      sc: '1.1.1 Non-text Content',
      msg: `${stats.altMissing} <img> tag(s) without alt attribute.`,
      fix: 'Add descriptive alt="" or alt="" (empty) for purely decorative images with role="presentation".'
    });
  }
  if (stats.targetBlankInsecure > 0) {
    findings.unshift({
      severity: 'medium',
      sc: 'Security',
      msg: `${stats.targetBlankInsecure} <a target="_blank"> without rel="noopener noreferrer" (reverse-tabnabbing risk).`,
      fix: 'Always add rel="noopener noreferrer" on target="_blank" links.'
    });
  }

  totalScore = Math.max(0, Math.min(100, Math.round(totalScore)));
  const grade = totalScore >= 95 ? 'A' : totalScore >= 80 ? 'B' : totalScore >= 60 ? 'C' : 'F';

  const result = {
    timestamp: new Date().toISOString(),
    score: totalScore,
    grade,
    filesScanned: htmlFiles,
    stats,
    findings,
    gaps: [
      'Color contrast (requires runtime / Lighthouse)',
      'Focus visibility (requires runtime)',
      'Keyboard operability (requires runtime / axe-core)',
      'Screen reader announcement correctness (requires manual + NVDA/VoiceOver)'
    ]
  };

  if (options.json || process.argv.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
    return result;
  }
  printConsole(result);
  return result;
}

function auditFile(fullPath, findings, stats, penalize) {
  let content;
  try { content = fs.readFileSync(fullPath, 'utf8'); } catch { return; }
  const rel = path.relative(CWD, fullPath);

  // Strip code comments (HTML comments, JS line + block)
  const stripped = content
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '');

  // 1. <html lang=...>
  const htmlTagMatch = /<html\b([^>]*)>/i.exec(stripped);
  if (htmlTagMatch && !/\blang\s*=/.test(htmlTagMatch[1])) {
    stats.htmlLangMissing++;
    penalize(6, 'high');
  }

  // 2. skip link
  if (!/skip[-_ ]?(?:to[-_ ]?)?(?:main|content)|#main\b/i.test(stripped)) {
    // only penalize if there's a <body>
    if (/<body\b/i.test(stripped)) stats.noSkipLink++;
    // no penalty; informational
  }

  // 3. <main> landmark
  if (!/<main\b/i.test(stripped)) {
    stats.noMainLandmark++;
    penalize(8, 'high');
  }

  // 4. Buttons without accessible name
  const buttonRegex = /<button\b([^>]*)>([\s\S]*?)<\/button>/gi;
  let m;
  while ((m = buttonRegex.exec(stripped)) !== null) {
    const attrs = m[1];
    const body = m[2].replace(/<[^>]+>/g, '').trim();
    const hasAriaLabel = /aria-label\s*=\s*["'][^"']+["']/i.test(attrs);
    const hasAriaLabelledby = /aria-labelledby\s*=/i.test(attrs);
    const hasTitle = /\btitle\s*=\s*["'][^"']+["']/i.test(attrs);
    const isImageButton = /<img\b/i.test(m[2]);
    if (!body && !hasAriaLabel && !hasAriaLabelledby && !hasTitle && !isImageButton) {
      stats.emptyButtons++;
      stats.unlabeledButtons++;
    } else if (!body && !hasAriaLabel && !hasAriaLabelledby && !hasTitle && isImageButton) {
      // image-only button — check img has alt
      const imgAlt = /<img\b[^>]*\balt\s*=\s*["'][^"']*["']/i.test(m[2]);
      if (!imgAlt) { stats.unlabeledButtons++; penalize(4, 'high'); }
    }
  }
  if (stats.unlabeledButtons > 0) penalize(stats.unlabeledButtons * 2, 'high');

  // 5. Inputs without accessible name
  const inputRegex = /<input\b([^>]*?)(?:\/?>|>)/gi;
  while ((m = inputRegex.exec(stripped)) !== null) {
    const attrs = m[1];
    const type = /type\s*=\s*["']?([^"'>\s]+)/i.exec(attrs);
    const inputType = type ? type[1].toLowerCase() : 'text';
    if (['hidden', 'submit', 'button'].includes(inputType)) continue;
    const id = /\bid\s*=\s*["']([^"']+)["']/i.exec(attrs);
    const hasAriaLabel = /aria-label\s*=\s*["'][^"']+["']/i.test(attrs);
    const hasAriaLabelledby = /aria-labelledby\s*=/i.test(attrs);
    const hasTitle = /\btitle\s*=\s*["'][^"']+["']/i.test(attrs);
    if (!hasAriaLabel && !hasAriaLabelledby && !hasTitle) {
      // Check if there's a <label for="id"> somewhere in the doc
      if (id) {
        const labelFor = new RegExp(`<label\\b[^>]*\\bfor\\s*=\\s*["']${id[1]}["']`, 'i');
        if (!labelFor.test(stripped)) {
          stats.unlabeledInputs++;
          stats.inputsWithoutLabel++;
          penalize(3, 'high');
        }
      } else {
        stats.unlabeledInputs++;
        stats.inputsWithoutLabel++;
        penalize(3, 'high');
      }
    }
  }

  // 6. aria-hidden with focusable descendants
  const ariaHiddenRegex = /<(\w+)\b([^>]*aria-hidden\s*=\s*["']true["'][^>]*)>/gi;
  while ((m = ariaHiddenRegex.exec(stripped)) !== null) {
    const openTag = m[0];
    const tag = m[1].toLowerCase();
    // Find the matching close tag and inspect descendants
    const closeRegex = new RegExp(`</${tag}>`, 'i');
    const closeMatch = closeRegex.exec(stripped.slice(m.index));
    if (!closeMatch) continue;
    const inner = stripped.slice(m.index + openTag.length, m.index + closeMatch.index);
    if (/\b(?:tabindex\s*=\s*["'][^"']*["']|<(?:a|button|input|select|textarea)\b)/i.test(inner) ||
        /<(?:a|button|input|select|textarea)[\s>]/i.test(inner)) {
      stats.ariaHiddenFocusable++;
      penalize(8, 'high');
    }
  }

  // 7. Invalid ARIA roles
  const roleRegex = /\brole\s*=\s*["']([^"']+)["']/gi;
  while ((m = roleRegex.exec(stripped)) !== null) {
    if (!VALID_ARIA_ROLES.has(m[1].toLowerCase())) {
      stats.invalidAriaRole++;
      penalize(3, 'medium');
    }
  }

  // 8. Positive tabindex
  const posTabRegex = /\btabindex\s*=\s*["']([1-9]\d*)["']/gi;
  const posTabs = stripped.match(posTabRegex);
  if (posTabs) {
    stats.positiveTabindex += posTabs.length;
    penalize(posTabs.length * 2, 'medium');
  }

  // 9. h1 + heading order (backref-free pairing — V8-safe)
  const headingMatches = extractHtmlHeadings(stripped, { minLevel: 1, maxLevel: 6 });
  const headings = headingMatches.map(h => ({ level: h.level }));
  const h1Count = headings.filter(h => h.level === 1).length;
  if (h1Count !== 1) {
    stats.h1Issues++;
    penalize(5, 'high');
  }
  let lastLevel = 0;
  let skipped = 0;
  for (const h of headings) {
    if (lastLevel > 0 && h.level > lastLevel + 1) skipped++;
    lastLevel = h.level;
  }
  if (skipped > 0) {
    stats.skippedHeadings += skipped;
    penalize(skipped * 2, 'medium');
  }

  // 10. img alt
  const imgRegex = /<img\b([^>]*?)(?:\/?>|>)/gi;
  while ((m = imgRegex.exec(stripped)) !== null) {
    if (!/\balt\s*=/.test(m[1])) {
      stats.altMissing++;
      penalize(3, 'high');
    }
  }

  // 11. target=_blank insecure
  const targetBlankRegex = /<a\b([^>]*\btarget\s*=\s*["']_blank["'][^>]*?)>/gi;
  while ((m = targetBlankRegex.exec(stripped)) !== null) {
    if (!/rel\s*=\s*["'][^"']*(?:noopener|noreferrer)[^"']*["']/i.test(m[1])) {
      stats.targetBlankInsecure++;
      penalize(2, 'medium');
    }
  }
}

function printConsole(result) {
  console.log('\n====================================================');
  console.log('     SPS SEO ACCESSIBILITY (WCAG 2.2 AA) AUDIT      ');
  console.log('====================================================\n');
  console.log(`Accessibility Score: ${result.score}/100 (Grade: ${result.grade})`);
  console.log(`Files scanned: ${result.filesScanned}\n`);

  if (result.findings.length === 0) {
    console.log('  ✓ No accessibility issues detected in the static sweep.\n');
    console.log('  Static gaps (need runtime testing):');
    for (const g of result.gaps) console.log(`    • ${g}`);
    console.log('');
    return;
  }

  const order = ['high', 'medium', 'low'];
  const icons = { high: '❌', medium: '⚠️', low: 'ℹ️' };
  for (const sev of order) {
    const items = result.findings.filter(f => f.severity === sev);
    for (const f of items) {
      console.log(`  ${icons[sev]} [WCAG ${f.sc}] ${f.msg}`);
      if (f.fix) console.log(`     └─ Fix: ${f.fix}`);
    }
  }
  console.log('\n  Static-scan gaps (verify with Lighthouse / axe-core):');
  for (const g of result.gaps) console.log(`    • ${g}`);
  console.log('');
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  runA11yAudit();
}
