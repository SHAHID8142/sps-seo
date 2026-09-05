#!/usr/bin/env node

/**
 * SPS SEO Automated Sitemap, Robots & llms.txt Generator
 * Version: 1.0.0
 * 
 * Generates XML sitemap, robots.txt, and modern llms.txt based on discovered routes
 * and sps-seo-config.json.
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
          routes.add(r.replace(/\/+/g, '/'));
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
          routes.add(r.replace(/\/+/g, '/'));
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
  }

  return Array.from(routes).sort();
}

function getDestinationDir() {
  if (fs.existsSync(path.join(CWD, 'public'))) {
    return path.join(CWD, 'public');
  }
  return CWD;
}

function generateSitemapXml(baseUrl, routes) {
  const today = new Date().toISOString().split('T')[0];
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  for (const r of routes) {
    const loc = `${baseUrl.replace(/\/$/, '')}${r === '/' ? '' : r}`;
    const priority = r === '/' ? '1.0' : '0.8';
    const freq = r === '/' ? 'daily' : 'weekly';

    xml += '  <url>\n';
    xml += `    <loc>${loc}</loc>\n`;
    xml += `    <lastmod>${today}</lastmod>\n`;
    xml += `    <changefreq>${freq}</changefreq>\n`;
    xml += `    <priority>${priority}</priority>\n`;
    xml += '  </url>\n';
  }

  xml += '</urlset>\n';
  return xml;
}

function generateRobotsTxt(baseUrl) {
  let txt = '# SPS SEO Generated robots.txt\n';
  txt += 'User-agent: *\n';
  txt += 'Allow: /\n\n';
  txt += `# AI and LLM Search Engine Agents\n`;
  txt += 'User-agent: GPTBot\n';
  txt += 'Allow: /\n\n';
  txt += 'User-agent: ClaudeBot\n';
  txt += 'Allow: /\n\n';
  txt += 'User-agent: PerplexityBot\n';
  txt += 'Allow: /\n\n';
  txt += `Sitemap: ${baseUrl.replace(/\/$/, '')}/sitemap.xml\n`;
  return txt;
}

function generateLlmsTxt(config, routes) {
  let txt = `# ${config.site?.name || 'Project Knowledge Base'}\n\n`;
  txt += `> ${config.metadata?.defaultDescription || 'Official project documentation and knowledge source.'}\n\n`;
  txt += `## Canonical Routes\n\n`;

  for (const r of routes) {
    const loc = `${config.site?.url?.replace(/\/$/, '') || 'https://example.com'}${r === '/' ? '' : r}`;
    txt += `- [${r === '/' ? 'Homepage' : r.replace(/^\//, '')}](${loc})\n`;
  }

  if (config.metadata?.keywords) {
    txt += `\n## Core Topics\n\n`;
    for (const kw of config.metadata.keywords) {
      txt += `- ${kw}\n`;
    }
  }

  return txt;
}

function main() {
  console.log('🚀 SPS SEO: Generating Sitemap, Robots.txt & llms.txt...');
  const config = loadConfig();
  const baseUrl = config.site?.url || 'https://example.com';
  const routes = discoverRoutes();
  const destDir = getDestinationDir();

  console.log(`  ✓ Discovered ${routes.length} route(s): ${routes.slice(0, 5).join(', ')}${routes.length > 5 ? '...' : ''}`);

  // 1. Sitemap.xml
  const sitemapXml = generateSitemapXml(baseUrl, routes);
  const sitemapPath = path.join(destDir, 'sitemap.xml');
  fs.writeFileSync(sitemapPath, sitemapXml, 'utf8');
  console.log(`  ✓ Generated: ${path.relative(CWD, sitemapPath)}`);

  // 2. Robots.txt
  const robotsTxt = generateRobotsTxt(baseUrl);
  const robotsPath = path.join(destDir, 'robots.txt');
  fs.writeFileSync(robotsPath, robotsTxt, 'utf8');
  console.log(`  ✓ Generated: ${path.relative(CWD, robotsPath)}`);

  // 3. llms.txt (AI Search / GEO readiness)
  if (config.aiSeo?.generateLlmsTxt !== false) {
    const llmsTxt = generateLlmsTxt(config, routes);
    const llmsPath = path.join(destDir, 'llms.txt');
    fs.writeFileSync(llmsPath, llmsTxt, 'utf8');
    console.log(`  ✓ Generated: ${path.relative(CWD, llmsPath)}`);
  }

  console.log('✅ Technical SEO assets successfully compiled.');
}

main();
