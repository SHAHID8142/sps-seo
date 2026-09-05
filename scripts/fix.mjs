#!/usr/bin/env node

/**
 * SPS SEO Automated Remediation Engine
 * Version: 1.0.0
 * 
 * 1-click automated repair for missing SEO assets:
 * - Scaffolds robots.txt, sitemap.xml, llms.txt
 * - Patches missing image alt attributes
 * - Synchronizes configuration
 * - Validates framework layout requirements
 */

import fs from 'node:fs';
import path from 'node:path';
import { runAudit } from './audit.mjs';

const CWD = process.cwd();

function getPublicDir() {
  const pub = path.join(CWD, 'public');
  if (fs.existsSync(pub)) return pub;
  return CWD;
}

function loadConfig() {
  const rootPath = path.join(CWD, 'sps-seo-config.json');
  const examplePath = path.join(CWD, 'sps-seo-config.example.json');
  if (fs.existsSync(rootPath)) {
    try {
      return JSON.parse(fs.readFileSync(rootPath, 'utf8'));
    } catch {
      // ignore
    }
  }
  if (fs.existsSync(examplePath)) {
    try {
      return JSON.parse(fs.readFileSync(examplePath, 'utf8'));
    } catch {
      // ignore
    }
  }
  return { site: { url: 'https://example.com', name: 'Acme Cloud' } };
}

export async function runAutoFix(options = {}) {
  const isDryRun = options.dryRun || process.argv.includes('--dry-run');
  const projectDir = options.cwd || CWD;
  const config = loadConfig();
  const destDir = fs.existsSync(path.join(projectDir, 'public')) ? path.join(projectDir, 'public') : projectDir;

  console.log(`\n🛠️  SPS SEO Automated Remediation Engine`);
  console.log(`Mode: ${isDryRun ? '🔍 DRY RUN (Preview only)' : '⚡ APPLYING FIXES'}\n`);

  const actions = [];

  // 1. Check sps-seo-config.json
  const configPath = path.join(projectDir, 'sps-seo-config.json');
  if (!fs.existsSync(configPath)) {
    actions.push({
      type: 'create-file',
      target: 'sps-seo-config.json',
      desc: 'Initialize default sps-seo-config.json',
      execute: () => {
        const examplePath = path.join(projectDir, 'sps-seo-config.example.json');
        if (fs.existsSync(examplePath)) {
          fs.copyFileSync(examplePath, configPath);
        } else {
          fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
        }
      }
    });
  }

  // 2. Check robots.txt
  const robotsPath = path.join(destDir, 'robots.txt');
  if (!fs.existsSync(robotsPath)) {
    actions.push({
      type: 'create-file',
      target: path.relative(projectDir, robotsPath),
      desc: 'Generate compliant robots.txt with AI bot rules',
      execute: () => {
        const baseUrl = config.site?.url || 'https://example.com';
        // Default to "cite but don't train" — block GPTBot/CCBot,
        // allow OAI-SearchBot/Claude/Perplexity so engines can cite us.
        const content = `# SPS SEO robots.txt
# Policy: cite-dont-train (set technical.aiBotPolicy in sps-seo-config.json to override)
User-agent: *
Allow: /

# AI search / citation bots — allow so engines can cite us
User-agent: OAI-SearchBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: anthropic-ai
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Bingbot
Allow: /

User-agent: Applebot-Extended
Allow: /

# Gemini training only — does NOT affect Google AI Overviews / AI Mode
User-agent: Google-Extended
Allow: /

# Training-only crawlers — block to opt out of training data collection
User-agent: GPTBot
Disallow: /

User-agent: CCBot
Disallow: /

Sitemap: ${baseUrl.replace(/\/$/, '')}/sitemap.xml
`;
        fs.writeFileSync(robotsPath, content, 'utf8');
      }
    });
  }

  // 3. Check sitemap.xml
  const sitemapPath = path.join(destDir, 'sitemap.xml');
  if (!fs.existsSync(sitemapPath)) {
    actions.push({
      type: 'create-file',
      target: path.relative(projectDir, sitemapPath),
      desc: 'Generate initial XML sitemap',
      execute: () => {
        const baseUrl = config.site?.url || 'https://example.com';
        const today = new Date().toISOString().split('T')[0];
        const content = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${baseUrl}/</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n</urlset>\n`;
        fs.writeFileSync(sitemapPath, content, 'utf8');
      }
    });
  }

  // 4. Check llms.txt
  const llmsPath = path.join(destDir, 'llms.txt');
  if (!fs.existsSync(llmsPath)) {
    actions.push({
      type: 'create-file',
      target: path.relative(projectDir, llmsPath),
      desc: 'Generate llms.txt AI search knowledge index',
      execute: () => {
        const name = config.site?.name || 'Project';
        const desc = config.metadata?.defaultDescription || 'Official project knowledge base.';
        const content = `# ${name}\n\n> ${desc}\n\n## Canonical Pages\n- [Homepage](${config.site?.url || 'https://example.com'})\n`;
        fs.writeFileSync(llmsPath, content, 'utf8');
      }
    });
  }

  // 5. Scan and patch image alt attributes in files
  const fileExts = ['.html', '.astro', '.tsx', '.jsx', '.vue', '.svelte'];
  const IGNORED = ['node_modules', '.git', '.next', 'dist', 'build'];

  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (IGNORED.includes(entry.name)) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && fileExts.includes(path.extname(entry.name))) {
        checkAndFixImagesInFile(fullPath);
      }
    }
  }

  function checkAndFixImagesInFile(filePath) {
    let content;
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch {
      return;
    }

    const relPath = path.relative(projectDir, filePath);
    // Find images without alt attribute
    const imgRegex = /<(?:img|Image)\b([^>]*?)(?:\/?>|>[\s\S]*?<\/(?:img|Image)>)/gi;
    let modified = false;
    let newContent = content;

    newContent = newContent.replace(imgRegex, (match, attrs) => {
      const hasAlt = /\balt=/i.test(attrs);
      if (!hasAlt) {
        modified = true;
        // Derive contextual fallback from src or generic description
        const srcMatch = /src=(?:["']([^"']+)["']|{([^}]+)})/i.exec(attrs);
        let fallback = 'Illustration';
        if (srcMatch) {
          const raw = srcMatch[1] || srcMatch[2] || '';
          const base = path.basename(raw).replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ');
          if (base && !base.includes('undefined')) {
            fallback = base.charAt(0).toUpperCase() + base.slice(1);
          }
        }
        return match.replace(/<(img|Image)\b/i, `<$1 alt="${fallback} preview"`);
      }
      return match;
    });

    if (modified) {
      actions.push({
        type: 'patch-file',
        target: relPath,
        desc: `Inject descriptive fallback alt attributes into unannotated images`,
        execute: () => {
          fs.writeFileSync(filePath, newContent, 'utf8');
        }
      });
    }
  }

  walk(projectDir);

  // Report actions
  if (actions.length === 0) {
    console.log('✨ All baseline technical SEO assets and image alt attributes are already intact!\n');
    return { applied: 0, actions: [] };
  }

  console.log(`Identified ${actions.length} actionable remediation item(s):\n`);
  actions.forEach((a, i) => {
    console.log(`  ${i + 1}. [${a.type.toUpperCase()}] ${a.target}`);
    console.log(`     └─ ${a.desc}`);
  });

  if (isDryRun) {
    console.log(`\n💡 To execute these fixes, run:`);
    console.log(`   npm run fix   (or: node scripts/fix.mjs --apply)\n`);
    return { applied: 0, actions };
  }

  // Apply fixes
  console.log('\n🚀 Executing fixes...');
  for (const a of actions) {
    try {
      a.execute();
      console.log(`  ✓ Applied: ${a.target}`);
    } catch (err) {
      console.error(`  ✗ Failed to apply fix for ${a.target}:`, err.message);
    }
  }

  console.log('\n✅ Remediation complete! Running verification audit...\n');
  await runAudit({ cwd: projectDir });

  return { applied: actions.length, actions };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const isApply = process.argv.includes('--apply');
  runAutoFix({ dryRun: !isApply }).catch(err => {
    console.error('AutoFix execution error:', err);
    process.exit(1);
  });
}
