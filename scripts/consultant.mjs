#!/usr/bin/env node

/**
 * SPS SEO Interactive Consultant Mode
 * Version: 1.4.0
 *
 * Runs audit silently, then presents findings as numbered options
 * and asks structured questions until all project context is collected.
 * Presents a unified action plan and waits for confirmation before proceeding.
 *
 * Designed for Claude Code, Cursor, OpenCode, Windsurf, and all agents
 * that support terminal-based interactive prompts.
 *
 * Usage:
 *   sps-seo              -> launches interactive consultant mode
 *   sps-seo consult      -> same as above
 *   SPS_SEO_AUTO_CONFIRM=1 sps-seo   -> skips confirmation (for CI)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stdin, stdout } from 'node:process';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCRIPTS_DIR = __dirname;
const CWD = process.cwd();

// ANSI colors for agent-friendly output
const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m',
  cyan: '\x1b[36m', magenta: '\x1b[35m', blue: '\x1b[34m', gray: '\x1b[90m',
};

function header(text) {
  console.log(`\n${C.cyan}${C.bold}═══════════════════════════════════════════════════════════════`);
  console.log(`  ${text}`);
  console.log(`═══════════════════════════════════════════════════════════════${C.reset}\n`);
}

function subheader(text) {
  console.log(`\n${C.blue}${C.bold}── ${text} ──${C.reset}\n`);
}

function numberedOption(num, label, detail = '') {
  const detailLine = detail ? `\n    ${C.gray}${detail}${C.reset}` : '';
  console.log(`  ${C.yellow}[${num}]${C.reset} ${label}${detailLine}`);
}

function info(msg) { console.log(`${C.cyan}ℹ${C.reset} ${msg}`); }
function success(msg) { console.log(`${C.green}✓${C.reset} ${msg}`); }
function warn(msg) { console.log(`${C.yellow}⚠${C.reset} ${msg}`); }
function error(msg) { console.log(`${C.red}✗${C.reset} ${msg}`); }
function divider() { console.log(`${C.gray}${'─'.repeat(70)}${C.reset}`); }

/**
 * Robust stdin reader - works with both interactive TTY and piped input.
 * Pre-loads all piped input lines, or reads line-by-line from TTY.
 */
let inputLines = [];
let isTTY = stdin.isTTY;

if (!isTTY) {
  // Piped mode: read all input upfront
  const raw = fs.readFileSync('/dev/stdin', 'utf8');
  inputLines = raw.split('\n').map(l => l.trim()).filter(l => l !== '');
}

let lineIndex = 0;

/**
 * Read one line of input - from pre-loaded lines (piped) or TTY
 */
function readLine() {
  return new Promise((resolve) => {
    if (!isTTY) {
      // Piped mode: return next pre-loaded line
      const line = inputLines[lineIndex++];
      setImmediate(() => resolve(line !== undefined ? line : ''));
      return;
    }
    // Interactive TTY mode: read one line
    stdout.write('');
    stdin.setRawMode(true);
    const onData = (chunk) => {
      const str = chunk.toString();
      if (str.includes('\n')) {
        stdin.off('data', onData);
        stdin.setRawMode(false);
        resolve(str.split('\n')[0].trim());
      }
    };
    stdin.once('data', onData);
  });
}

/** Run audit silently and return parsed JSON */
function runSilentAudit(projectDir) {
  const res = spawnSync(process.execPath, [path.join(SCRIPTS_DIR, 'audit.mjs'), '--json'], {
    stdio: ['ignore', 'pipe', 'pipe'], cwd: projectDir,
  });
  try { return JSON.parse(res.stdout.toString().trim()); } catch { return null; }
}

/** Run any tool silently and return parsed JSON */
function runSilent(scriptName, args, projectDir = CWD) {
  const res = spawnSync(process.execPath, [path.join(SCRIPTS_DIR, scriptName), ...args], {
    stdio: ['ignore', 'pipe', 'pipe'], cwd: projectDir,
  });
  try { return JSON.parse(res.stdout.toString().trim()); } catch { return null; }
}

/** Ask a numbered question and return validated choice */
async function askChoice(question, validChoices) {
  console.log(`\n${C.bold}${question}${C.reset}`);
  let choice;
  while (true) {
    choice = (await readLine()).trim();
    if (validChoices.includes(choice)) { return choice; }
    error(`Please select one of: ${validChoices.join(', ')}`);
  }
}

/** Ask a free-text question with optional default */
async function askText(label, prompt, defaultValue) {
  info(`Default: ${defaultValue || '(none)'}`);
  const answer = await readLine();
  return answer.trim() || defaultValue || '';
}

/** Ask numbered question with optional "other" follow-up */
async function askWithOther(label, question, options, otherPrompt) {
  console.log(`\n${C.bold}${label}${C.reset}: ${question}`);
  options.forEach((opt, i) => numberedOption(i + 1, opt));
  const valid = [...Array(options.length).keys()].map(k => String(k + 1)).concat(['o']);
  let choice;
  while (true) {
    choice = (await readLine()).trim();
    if (valid.includes(choice)) { break; }
    error(`Please select 1-${options.length} or 'o' for other.`);
  }
  if (choice === 'o') {
    return { choice: 'other', value: await readLine() };
  }
  return { choice, value: options[parseInt(choice) - 1] };
}

/** Prompt user for a comma-separated list of keywords or terms */
async function askCommaList(label, prompt, existing = []) {
  if (existing.length > 0) info(`Current: ${existing.join(', ')}`);
  const answer = await readLine();
  return answer.trim()
    ? answer.split(',').map(k => k.trim()).filter(Boolean)
    : existing;
}

/** Prompt user for a single line with optional default */
async function promptLine(label, prompt, defaultValue = '') {
  if (defaultValue) info(`Default: ${defaultValue}`);
  const answer = await readLine();
  return answer.trim() || defaultValue;
}

/**
 * Main interactive consultant loop
 */
async function main() {
  let answers = {};
  let config = {};

  // Load existing config
  const configPath = path.join(CWD, 'sps-seo-config.json');
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      info(`Loaded existing sps-seo-config.json — using saved values as defaults.`);
    } catch {
      warn('Existing sps-seo-config.json is corrupted — starting fresh.');
    }
  }

  header('SPS SEO CONSULTANT');
  console.log(`${C.dim}Welcome to the interactive SEO consultant. I will audit your project, `);
  console.log(`ask you targeted questions, and build a complete action plan.${C.reset}`);
  console.log(`${C.dim}All questions use numbered options — just reply with the number.${C.reset}`);

  // ─── STEP 1: Run silent audit ───────────────────────────────────────────────
  subheader('Step 1: Running Initial Audit');
  const audit = runSilentAudit(CWD);
  if (!audit) {
    error('Failed to run audit. Proceeding with manual questions only.');
  } else {
    success(`Audit complete. Current score: ${C.bold}${audit.score}/100${C.reset} (${audit.grade})`);
    if (audit.framework) info(`Detected framework: ${audit.framework.label}`);
  }

  // ─── STEP 2: Project context questions ──────────────────────────────────────
  subheader('Step 2: Project Context & Goals');

  const q1 = await askWithOther('Q1', 'What type of project is this?',
    ['Business / Corporate Website', 'E-commerce Store', 'Blog / Content Site', 'Portfolio / Agency', 'SaaS / Web App', 'News / Publication'],
    'Describe your project type');
  answers.projectType = q1.choice === 'other' ? q1.value : q1.value;

  const q2 = await askWithOther('Q2', 'What is your PRIMARY SEO goal?',
    ['Increase organic traffic', 'Rank for specific keywords', 'Local business visibility', 'E-commerce sales', 'Brand awareness', 'Technical SEO compliance', 'Not sure — help me decide'],
    'Describe your goal');
  answers.primaryGoal = q2.choice === 'other' ? q2.value : q2.value;

    answers.siteUrl = await askText('Q3', 'What is your production domain URL?', config?.site?.url || 'https://example.com');
  if (!/^https?:\/\//.test(answers.siteUrl)) answers.siteUrl = 'https://' + answers.siteUrl;

  // Q4: Primary keywords - free text input, comma-separated
  console.log(`\n${C.bold}Q4${C.reset}: What are your PRIMARY target keywords?`);
  if (config?.metadata?.keywords && config.metadata.keywords.length > 0) {
    info(`Current: ${config.metadata.keywords.join(', ')}`);
  } else {
    info('Enter keywords you want to rank for (comma-separated, or Enter to skip)');
  }
  const q4Raw = await readLine();
  answers.primaryKeywords = q4Raw.trim()
    ? q4Raw.split(',').map(k => k.trim()).filter(Boolean)
    : (config?.metadata?.keywords || []);
  if (answers.primaryKeywords.length === 0) {
    info('No keywords provided — I\'ll analyze your content for existing keywords.');
  }

  const q5 = await askWithOther('Q5', 'What geographic area are you targeting?',
    ['Global', 'United States', 'United Kingdom', 'European Union', 'Specific country', 'Multiple regions'],
    'Enter country code');
  answers.geoTarget = q5.value;
  if (q5.value.includes('Specific country')) {
    answers.geoTargetCountry = await promptLine('Q5b', 'Enter country code (e.g., CA):');
  }
  if (q5.value === 'Multiple regions') {
    answers.multiregional = true;
    const raw = await promptLine('Q5b', 'Enter region-language pairs (US-en, DE-de, FR-fr):');
    answers.regions = raw.split(',').map(s => s.trim()).filter(Boolean);
  }

  // ─── STEP 3: Content & Audience ────────────────────────────────────────────
  subheader('Step 3: Content & Target Audience');

  const q6 = await askWithOther('Q6', 'Who is your target audience?',
    ['General consumers', 'Professional B2B buyers', 'Technical professionals', 'Students & learners', 'Industry experts'],
    'Describe your audience');
  answers.audienceType = q6.choice === 'other' ? q6.value : q6.value;

  const q7 = await askWithOther('Q7', 'What content style performs best with your audience?',
    ['Short & scannable', 'Balanced (medium depth)', 'Long-form comprehensive', 'Data-driven / tables', 'Storytelling / narrative'],
    'Describe preferred content style');
  answers.contentStyle = q7.choice === 'other' ? q7.value : q7.value;

  const q8 = await askWithOther('Q8', 'Do you have existing content?',
    ['No — starting from scratch', 'Yes — minimal (<5 pages)', 'Yes — moderate (5-50 pages)', 'Yes — large (>50 pages)'],
    'Describe your content');
  answers.contentVolume = q8.value;

  // ─── STEP 4: Competitor & Keyword Analysis ─────────────────────────────────
  subheader('Step 4: Competitors & Keyword Research');

  const rawComps = await promptLine('Q9', 'Competitor domains (comma-separated, Enter to skip):');
  answers.competitors = rawComps ? rawComps.split(',').map(c => c.trim()).filter(Boolean) : [];

  if (audit?.keywords && audit.keywords.length > 0) {
    info(`Found ${audit.keywords.length} keywords in your content.`);
    console.log(`\n${C.bold}Top keywords detected:${C.reset}`);
    audit.keywords.slice(0, 8).forEach((kw, i) => {
      numberedOption(i + 1, kw.term, `Density: ${(kw.density * 100).toFixed(1)}% | Intent: ${kw.intent || 'N/A'}`);
    });
  } else if (answers.primaryKeywords.length > 0) {
    info('Analyzing your provided keywords...');
    const kwAnalysis = runSilent('keyword-audit.mjs', ['--json']);
    if (kwAnalysis?.keywords) {
      console.log(`\n${C.bold}Keyword Analysis Results:${C.reset}`);
      kwAnalysis.keywords.slice(0, 10).forEach((kw, i) => {
        numberedOption(i + 1, kw.term, `Search Vol: ${kw.volume || '?'} | Intent: ${kw.intent || 'unknown'}`);
      });
    }
  }

  console.log(`\n${C.bold}Q10${C.reset}: Would you like content gap analysis against competitors?`);
  numberedOption('1', 'Yes — full competitor gap matrix');
  numberedOption('2', 'Yes — quick 3-5 content ideas');
  numberedOption('3', 'No — skip competitor gap analysis');
  const q10choice = await askChoice('', ['1', '2', '3']);
  if (q10choice === '1' && answers.competitors.length > 0) {
    info('Running competitor analysis (15-30s)...');
    const comp = runSilent('competitor-intel.mjs', ['--json']);
    if (comp?.gapOpportunities) {
      subheader('Content Gap Opportunities');
      comp.gapOpportunities.slice(0, 5).forEach((topic, i) => {
        numberedOption(i + 1, topic.keyword, `Difficulty: ${topic.difficulty}/100 | Vol: ${topic.volume || '?'}`);
      });
    }
  } else if (q10choice === '2' && answers.competitors.length > 0) {
    info('Generating quick content ideas...');
    const comp = runSilent('competitor-intel.mjs', ['--json']);
    if (comp?.contentIdeas) {
      subheader('Quick Content Ideas');
      comp.contentIdeas.slice(0, 5).forEach((idea, i) => numberedOption(i + 1, idea));
    }
  }
  answers.contentGap = q10choice === '3' ? 'none' : q10choice === '2' ? 'quick' : 'full';

  // ─── STEP 5: Technical & AI Search ───────────────────────────────────────────
  subheader('Step 5: Technical Setup & AI Search');

  console.log(`\n${C.bold}Q11${C.reset}: Do you want search engines to index your site right now?`);
  numberedOption('1', 'Yes — fully indexable (production ready)');
  numberedOption('2', 'No — keep it private while building');
  numberedOption('3', 'Only specific pages');
  answers.indexingPreference = await askChoice('', ['1', '2', '3']);

  console.log(`\n${C.bold}Q12${C.reset}: Do you want to optimize for AI search bots?`);
  numberedOption('1', 'Yes — enable AI citation optimization (ChatGPT, Claude, Perplexity)');
  numberedOption('2', 'No — standard SEO only');
  numberedOption('3', 'Only for content pages');
  answers.aiSearch = await askChoice('', ['1', '2', '3']);

  console.log(`\n${C.bold}Q13${C.reset}: How important is page speed / Core Web Vitals?`);
  numberedOption('1', 'Critical — perfect Lighthouse 100');
  numberedOption('2', 'Important — aim for 90+ score');
  numberedOption('3', 'Nice to have — fix major issues');
  numberedOption('4', 'Not important — focus on rankings');
  answers.perfPriority = await askChoice('', ['1', '2', '3', '4']);

  // ─── STEP 6: Action plan summary ───────────────────────────────────────────
  subheader('Your SEO Action Plan');
  console.log(`${C.bold}Here's what I recommend based on our conversation:${C.reset}\n`);

  const planItems = [];
  if (audit && audit.score < 90) {
    planItems.push({ id: 'audit', label: `Fix audit issues (current: ${audit.score}/100 → target: 90+)`, action: 'npm run fix' });
  }
  if (q10choice !== '3') {
    planItems.push({ id: 'gap', label: 'Content gap analysis & keyword targeting', action: 'Analyze missing content opportunities' });
  }
  if (['1', '3'].includes(answers.aiSearch)) {
    planItems.push({ id: 'ai', label: 'AI search optimization (llms.txt, citation bots)', action: 'Allow OAI-SearchBot, ClaudeBot, PerplexityBot' });
  }
  if (answers.indexingPreference === '1') {
    planItems.push({ id: 'index', label: 'Ensure full indexability', action: 'Verify sitemap.xml, robots.txt, canonical tags' });
  }
  if (['1', '2'].includes(answers.perfPriority)) {
    planItems.push({ id: 'perf', label: 'Core Web Vitals optimization', action: answers.perfPriority === '1' ? 'Target: Lighthouse 100' : 'Target: Lighthouse 90+' });
  }
  planItems.push({ id: 'schema', label: 'Schema.org JSON-LD structured data', action: `Add ${q1.value.includes('E-commerce') ? 'Product' : 'Article'} schema` });
  planItems.push({ id: 'meta', label: 'Title tags & meta descriptions', action: 'Optimize for target keywords (140-160 chars)' });

  planItems.forEach((item, i) => {
    numberedOption(i + 1, item.label, `Action: ${item.action}`);
  });

  console.log('');
  divider();
  console.log(`${C.bold}All actions will be:\n`);
  console.log(`  ${C.green}✓${C.reset} Backwards-compatible (works on any framework)`);
  console.log(`  ${C.green}✓${C.reset} Reversible (all changes logged/saved)`);
  divider();

  console.log(`\n${C.bold}Q14${C.reset}: How would you like to proceed?`);
  numberedOption('1', 'Run ALL recommended actions now');
  numberedOption('2', 'Choose specific actions (comma-separated numbers)');
  numberedOption('3', 'Preview what would change (dry-run)');
  numberedOption('4', 'Exit and review manually');
  const q14 = await askChoice('', ['1', '2', '3', '4']);

  if (q14 === '4') {
    info('No changes made. Run individual commands later with: sps-seo help');
    process.exit(0);
  }

  // Save session
  const sessionPath = path.join(CWD, '.sps', 'seo-session.json');
  try {
    if (!fs.existsSync(path.join(CWD, '.sps'))) {
      fs.mkdirSync(path.join(CWD, '.sps'), { recursive: true });
    }
    fs.writeFileSync(sessionPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      projectType: answers.projectType,
      siteUrl: answers.siteUrl,
      primaryKeywords: answers.primaryKeywords,
      competitors: answers.competitors,
      answers,
      auditScore: audit?.score || 'skipped',
      plan: planItems,
      finalDecision: q14,
    }, null, 2), 'utf8');
    info(`Session saved to ${path.relative(CWD, sessionPath)}`);
  } catch {
    warn('Could not save session file (optional).');
  }

  // ─── Write collected answers to sps-seo-config.json ────────────────────────
  subheader('Saving Configuration');
  try {
    const newConfig = {
      ...(config || {}),
      version: '1.4.0',
      site: {
        ...(config?.site || {}),
        url: answers.siteUrl,
        name: answers.projectType,
      },
      metadata: {
        ...(config?.metadata || {}),
        keywords: answers.primaryKeywords,
        secondaryKeywords: config?.metadata?.secondaryKeywords || [],
      },
      author: {
        ...(config?.author || {}),
        name: config?.author?.name || '',
        role: config?.author?.role || '',
      },
      targeting: {
        ...(config?.targeting || {}),
        competitors: answers.competitors,
        geoTarget: answers.geoTarget,
        ...(answers.geoTargetCountry ? { geoTargetCountry: answers.geoTargetCountry } : {}),
        ...(answers.multiregional ? { multiregional: true, regions: answers.regions } : {}),
        audience: answers.audienceType,
        contentStyle: answers.contentStyle,
        contentVolume: answers.contentVolume,
      },
      aiSearch: {
        enabled: answers.aiSearch !== '2',
        contentOnly: answers.aiSearch === '3',
      },
      indexing: {
        ...(config?.indexing || {}),
        mode: answers.indexingPreference === '1' ? 'full' : answers.indexingPreference === '2' ? 'none' : 'selective',
      },
      performance: {
        priority: answers.perfPriority,
        label: answers.perfPriority === '1' ? 'Critical' : answers.perfPriority === '2' ? 'Important' : answers.perfPriority === '3' ? 'Nice to have' : 'Low',
      },
      consultation: {
        lastRun: new Date().toISOString(),
        projectType: answers.projectType,
        primaryGoal: answers.primaryGoal,
        contentGap: answers.contentGap,
      },
    };

    fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2), 'utf8');
    success(`Configuration saved to sps-seo-config.json`);

    // Sync to .sps/ if it exists
    if (fs.existsSync(path.join(CWD, '.sps'))) {
      fs.writeFileSync(path.join(CWD, '.sps', 'seo.json'), JSON.stringify(newConfig, null, 2), 'utf8');
      info('Synced to .sps/seo.json');
    }
  } catch (e) {
    warn(`Could not save config: ${e.message}`);
  }

  // ─── Execute ───────────────────────────────────────────────────────────────
  if (q14 === '1' || q14 === '2') {
    subheader('Executing SEO Actions');
    const actionsToRun = q14 === '1'
      ? planItems.map(i => i.id)
      : (await promptLine('Q14b', 'Enter action numbers to run (comma-separated):'))
          .split(',').map(s => parseInt(s.trim())).filter(n => n > 0 && n <= planItems.length)
          .map(i => planItems[i - 1]?.id).filter(Boolean);

    if (actionsToRun.includes('audit') && audit && audit.score < 90) {
      info('Running automated fix...');
      const res = spawnSync(process.execPath, [path.join(SCRIPTS_DIR, 'fix.mjs'), '--apply'], {
        stdio: 'inherit', cwd: CWD
      });
      if (res.status === 0) success('Auto-fix complete.');
      else warn('Auto-fix completed with warnings.');
    }

    if (['gap', 'ai', 'index'].some(a => actionsToRun.includes(a)) || actionsToRun.includes('perf')) {
      info('Generating sitemap.xml, robots.txt, llms.txt...');
      const res = spawnSync(process.execPath, [path.join(SCRIPTS_DIR, 'generate-sitemap.mjs')], {
        stdio: 'inherit', cwd: CWD
      });
      if (res.status === 0) success('Assets generated.');
      else warn('Some assets could not be generated.');
    }

    if (actionsToRun.includes('schema')) {
      info('Validating Schema.org JSON-LD...');
      spawnSync(process.execPath, [path.join(SCRIPTS_DIR, 'validate-schema.mjs')], {
        stdio: 'inherit', cwd: CWD
      });
    }

    if (actionsToRun.includes('perf')) {
      info('Running performance audit...');
      const res = spawnSync(process.execPath, [path.join(SCRIPTS_DIR, 'perf-budget.mjs'), '--json'], {
        stdio: 'pipe', cwd: CWD
      });
      try {
        const perf = JSON.parse(res.stdout.toString().trim());
        if (perf.score !== undefined) info(`Performance score: ${perf.score}/100`);
      } catch {
        warn('Could not parse performance results.');
      }
    }

    subheader('Verification');
    info('Running final audit...');
    const finalAudit = runSilentAudit(CWD);
    if (finalAudit) {
      success(`Final SEO score: ${C.bold}${finalAudit.score}/100${C.reset} (${finalAudit.grade})`);
      if (finalAudit.score >= 90) {
        console.log(`${C.green}${C.bold}🎉 Project is SPS SEO Compliant!${C.reset}`);
      }
      if (finalAudit.score > (audit?.score || 0)) {
        const improvement = finalAudit.score - (audit?.score || 0);
        success(`Score improved by ${improvement} points.`);
      }
    }
  }

  if (q14 === '3') {
    info('Running dry-run preview (no files will be changed)...');
    spawnSync(process.execPath, [path.join(SCRIPTS_DIR, 'fix.mjs'), '--dry-run'], {
      stdio: 'inherit', cwd: CWD
    });
  }

  console.log('');
  header('CONSULTATION COMPLETE');
  info('Run `sps-seo help` for manual control anytime.');
  info('Run `sps-seo audit` to re-check your score.');
  process.exit(0);
}

// Auto-run if executed directly
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().catch(err => {
    console.error('Consultant error:', err);
    process.exit(1);
  });
}

export { main };
