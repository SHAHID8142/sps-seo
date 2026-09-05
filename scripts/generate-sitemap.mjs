#!/usr/bin/env node

/**
 * SPS SEO Automated Sitemap, Robots & llms.txt Generator
 * Version: 1.1.0
 *
 * Generates XML sitemap, robots.txt, llms.txt, and llms-full.txt based on
 * discovered routes and sps-seo-config.json.
 *
 * 2026 update notes:
 *  - Splits OpenAI bots correctly: OAI-SearchBot (citation/search) is allowed
 *    by default; GPTBot (training) is opt-in only. Blocking the wrong one
 *    silently removes you from ChatGPT citations.
 *  - Adds Google-Extended with explicit Gemini-training-only note (it does
 *    NOT affect AI Overviews / AI Mode, which use Google's regular index).
 *  - Generates llms-full.txt companion alongside llms.txt (Aug 2026 standard).
 *  - lastmod uses file modification time when available, falls back to today.
 */

import fs from 'node:fs';
import path from 'node:path';

const CWD = process.cwd();

function loadConfig() {
  const rootConfig = path.join(CWD, 'sps-seo-config.json');
  const spsConfig = path.join(CWD, '.sps/seo.json');
  const exampleConfig = path.join(CWD, 'sps-seo-config.example.json');

  if (fs.existsSync(rootConfig)) {
    return JSON.parse(fs.readFileSync(rootConfig, 'utf8'));
  }
  if (fs.existsSync(spsConfig)) {
    return JSON.parse(fs.readFileSync(spsConfig, 'utf8'));
  }
  if (fs.existsSync(exampleConfig)) {
    return JSON.parse(fs.readFileSync(exampleConfig, 'utf8'));
  }
  return { site: { url: 'https://example.com', name: 'Website' } };
}

function discoverRoutes() {
  const routes = new Set(['/']);
  const routeMeta = new Map(); // route -> { lastmod: ISO date }
  const IGNORE_PATTERNS = ['api', '_app', '_document', '_error', '404', '500'];

  function walk(dir, baseRoute = '') {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (['node_modules', '.git', '.next', 'dist', 'build'].includes(entry.name)) continue;
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        const seg = entry.name.replace(/^\(.*?\)$/, '').replace(/^\[.*?\]$/, '');
        const nextBase = seg ? `${baseRoute}/${seg}` : baseRoute;
        walk(fullPath, nextBase);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        const name = path.basename(entry.name, ext);

        // Next.js App Router (page.tsx / page.jsx)
        if (name === 'page' && ['.tsx', '.jsx', '.js', '.ts'].includes(ext)) {
          const r = baseRoute || '/';
          const route = r.replace(/\/+/g, '/');
          routes.add(route);
          routeMeta.set(route, lastmodFor(fullPath));
        }
        // Next.js Pages Router / Astro / Svelte / Vue
        else if (['.astro', '.tsx', '.jsx', '.html', '.vue', '.svelte', '.md'].includes(ext)) {
          if (IGNORE_PATTERNS.includes(name)) continue;
          if (name.startsWith('_') || name.startsWith('.')) continue;

          let r;
          if (name === 'index') {
            r = baseRoute || '/';
          } else {
            r = `${baseRoute}/${name}`;
          }
          const route = r.replace(/\/+/g, '/');
          routes.add(route);
          routeMeta.set(route, lastmodFor(fullPath));
        }
      }
    }
  }

  // Scan common route directories
  walk(path.join(CWD, 'app'));
  walk(path.join(CWD, 'src/app'));
  walk(path.join(CWD, 'pages'));
  walk(path.join(CWD, 'src/pages'));
  walk(path.join(CWD, 'routes'));

  // Also check top-level html files
  if (fs.existsSync(path.join(CWD, 'index.html'))) {
    routes.add('/');
    routeMeta.set('/', lastmodFor(path.join(CWD, 'index.html')));
  }

  return { routes: Array.from(routes).sort(), routeMeta };
}

function lastmodFor(filePath) {
  try {
    const stat = fs.statSync(filePath);
    return stat.mtime.toISOString().split('T')[0];
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

function getDestinationDir() {
  if (fs.existsSync(path.join(CWD, 'public'))) {
    return path.join(CWD, 'public');
  }
  return CWD;
}

function generateSitemapXml(baseUrl, routes, routeMeta) {
  const fallbackLastmod = new Date().toISOString().split('T')[0];
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  for (const r of routes) {
    const loc = `${baseUrl.replace(/\/$/, '')}${r === '/' ? '' : r}`;
    const priority = r === '/' ? '1.0' : '0.8';
    const freq = r === '/' ? 'daily' : 'weekly';
    const lastmod = routeMeta.get(r) || fallbackLastmod;

    xml += '  <url>\n';
    xml += `    <loc>${loc}</loc>\n`;
    xml += `    <lastmod>${lastmod}</lastmod>\n`;
    xml += `    <changefreq>${freq}</changefreq>\n`;
    xml += `    <priority>${priority}</priority>\n`;
    xml += '  </url>\n';
  }

  xml += '</urlset>\n';
  return xml;
}

/**
 * Generate robots.txt with the 2026-correct AI bot policy.
 *
 * Defaults to a "cite but don't train" stance:
 *  - Allow: OAI-SearchBot (citation), ChatGPT-User (user-triggered fetches),
 *           ClaudeBot, anthropic-ai, PerplexityBot, Bingbot, Applebot-Extended
 *  - Allow: Google-Extended (does NOT affect AIO/AI Mode; AIO rides on the
 *           regular Google index. Blocking it only opts you out of Gemini
 *           training specifically.)
 *  - Block by default: GPTBot (training), CCBot (Common Crawl training)
 *
 * Override via sps-seo-config.json: technical.aiBotPolicy
 *   "cite-dont-train" (default) | "max-visibility" | "opt-out"
 */
function generateRobotsTxt(baseUrl, config) {
  const policy = config?.technical?.aiBotPolicy || 'cite-dont-train';
  const allowAll = policy === 'max-visibility';
  const blockAll = policy === 'opt-out';
  const deny = (token) => blockAll || (!allowAll && DENY_BY_DEFAULT.has(token));

  let txt = '# SPS SEO Generated robots.txt\n';
  txt += '# Policy: ' + policy + '\n';
  txt += '# Edit sps-seo-config.json -> technical.aiBotPolicy to change.\n\n';
  txt += 'User-agent: *\n';
  txt += 'Allow: /\n\n';

  // AI / LLM search crawlers — allow by default so engines can cite you.
  const aiBots = [
    'OAI-SearchBot',     // OpenAI ChatGPT search/citation index
    'ChatGPT-User',      // OpenAI user-triggered fetch
    'ClaudeBot',         // Anthropic Claude retrieval
    'Claude-User',       // Anthropic Claude live user fetch
    'anthropic-ai',      // Anthropic (legacy token)
    'PerplexityBot',     // Perplexity
    'Perplexity-User',   // Perplexity user fetch
    'Bingbot',           // Microsoft Copilot rides on Bing
    'Applebot-Extended', // Apple Intelligence
    'Google-Extended',   // Gemini training only — does NOT affect AIO/AI Mode
  ];
  for (const bot of aiBots) {
    txt += `User-agent: ${bot}\n`;
    txt += deny(bot) ? 'Disallow: /\n\n' : 'Allow: /\n\n';
  }

  // Training-only crawlers — block by default in cite-dont-train mode.
  const trainingBots = ['GPTBot', 'CCBot', 'GoogleOther', 'Bytespider'];
  for (const bot of trainingBots) {
    txt += `User-agent: ${bot}\n`;
    txt += deny(bot) ? 'Disallow: /\n\n' : 'Allow: /\n\n';
  }

  txt += `Sitemap: ${baseUrl.replace(/\/$/, '')}/sitemap.xml\n`;
  return txt;
}

// Bots we deny in cite-dont-train mode (training-only).
const DENY_BY_DEFAULT = new Set(['GPTBot', 'CCBot', 'GoogleOther', 'Bytespider']);

function generateLlmsTxt(config, routes) {
  let txt = `# ${config.site?.name || 'Project Knowledge Base'}\n\n`;
  txt += `> ${config.metadata?.defaultDescription || 'Official project documentation and knowledge source.'}\n\n`;

  if (config.metadata?.keywords?.length) {
    txt += `Optional details: ${config.metadata.keywords.join(', ')}\n\n`;
  }

  txt += `## Canonical Routes\n\n`;

  const baseUrl = (config.site?.url || 'https://example.com').replace(/\/$/, '');
  for (const r of routes) {
    const loc = `${baseUrl}${r === '/' ? '' : r}`;
    txt += `- [${r === '/' ? 'Homepage' : r.replace(/^\//, '')}](${loc})\n`;
  }

  return txt;
}

function main() {
  console.log('🚀 SPS SEO: Generating Sitemap, Robots.txt, llms.txt & llms-full.txt...');
  const config = loadConfig();
  const baseUrl = config.site?.url || 'https://example.com';
  const { routes, routeMeta } = discoverRoutes();
  const destDir = getDestinationDir();

  console.log(`  ✓ Discovered ${routes.length} route(s): ${routes.slice(0, 5).join(', ')}${routes.length > 5 ? '...' : ''}`);

  // 1. Sitemap.xml
  const sitemapXml = generateSitemapXml(baseUrl, routes, routeMeta);
  const sitemapPath = path.join(destDir, 'sitemap.xml');
  fs.writeFileSync(sitemapPath, sitemapXml, 'utf8');
  console.log(`  ✓ Generated: ${path.relative(CWD, sitemapPath)}`);

  // 2. Robots.txt
  const robotsTxt = generateRobotsTxt(baseUrl, config);
  const robotsPath = path.join(destDir, 'robots.txt');
  fs.writeFileSync(robotsPath, robotsTxt, 'utf8');
  console.log(`  ✓ Generated: ${path.relative(CWD, robotsPath)}`);

  // 3. llms.txt (AI Search / GEO readiness)
  if (config.aiSeo?.generateLlmsTxt !== false) {
    const llmsTxt = generateLlmsTxt(config, routes);
    const llmsPath = path.join(destDir, 'llms.txt');
    fs.writeFileSync(llmsPath, llmsTxt, 'utf8');
    console.log(`  ✓ Generated: ${path.relative(CWD, llmsPath)}`);

    // 4. llms-full.txt (Aug 2026 companion — full content concatenated)
    if (config.aiSeo?.generateLlmsFullTxt !== false) {
      const llmsFullPath = path.join(destDir, 'llms-full.txt');
      // Scaffold a manifest pointing at the same routes. Users replace this
      // with a build-time generator that concatenates the linked markdown.
      const llmsFullTxt = `# ${config.site?.name || 'Project'} — Full Content\n\n` +
        `> Generated companion to llms.txt. In production, replace this file with a build-time concatenation of all pages referenced in llms.txt (markdown source for each route, concatenated in order). Tools: see llmstxt.org → llms_txt2ctx.\n\n` +
        `## Pages\n\n` +
        routes.map(r => {
          const loc = `${baseUrl}${r === '/' ? '' : r}.md`;
          return `- ${r === '/' ? 'Homepage' : r.replace(/^\//, '')}: ${loc}`;
        }).join('\n') + '\n';
      fs.writeFileSync(llmsFullPath, llmsFullTxt, 'utf8');
      console.log(`  ✓ Generated: ${path.relative(CWD, llmsFullPath)} (manifest — wire to build pipeline)`);
    }
  }

  console.log('✅ Technical SEO assets successfully compiled.');
}

main();
