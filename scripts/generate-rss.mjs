#!/usr/bin/env node

/**
 * SPS SEO — RSS 2.0 Feed Generator
 * Version: 1.4.0
 *
 * Generates public/rss.xml from content pages (markdown frontmatter and/or
 * HTML <article>/<time datetime> pages). RSS feeds remain a discovery signal
 * for search engines, aggregators, and AI/LLM crawlers, and complement
 * sitemap.xml + llms.txt.
 *
 * Output: public/rss.xml (+ console summary, --json supported).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { walkFiles, IGNORE_DIRS, loadConfig, extractHtmlHeadings, isMain } from './lib/core.mjs';

const CWD = process.cwd();

function escapeXml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function parseFrontmatter(content) {
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
  if (!fm) return {};
  const data = {};
  for (const line of fm[1].split(/\r?\n/)) {
    const m = /^([a-zA-Z_-]+):\s*(.*)$/.exec(line);
    if (m) data[m[1].toLowerCase()] = m[2].replace(/^["']|["']$/g, '').trim();
  }
  return data;
}

export function generateRss(options = {}) {
  const projectDir = options.cwd ? path.resolve(options.cwd) : CWD;
  const jsonOutput = options.json || process.argv.includes('--json');
  const { config, errors } = loadConfig(projectDir);

  const siteUrl = (options.siteUrl || config?.site?.url || '').replace(/\/$/, '');
  if (!siteUrl) {
    const err = 'No site.url in sps-seo-config.json — run npm run init or pass --site-url.';
    if (jsonOutput) console.log(JSON.stringify({ success: false, error: err }, null, 2));
    else console.error(`✗ ${err}`);
    return { success: false, error: err };
  }

  const siteName = config?.site?.name || 'Feed';
  const siteDesc = config?.metadata?.defaultDescription || `${siteName} — latest updates`;

  const pages = walkFiles(projectDir, {
    ignoreDirs: IGNORE_DIRS,
    extraIgnore: new Set(['public'])
  });

  const items = [];
  for (const file of pages) {
    let content;
    try { content = fs.readFileSync(file, 'utf8'); } catch { continue; }
    const ext = path.extname(file).toLowerCase();

    let title = null, date = null, description = null, route = null;
    const rel = path.relative(projectDir, file);

    if (ext === '.md' || ext === '.mdx') {
      const fm = parseFrontmatter(content);
      title = fm.title || (extractHtmlHeadings(content, { minLevel: 1, maxLevel: 1 })[0] || {}).text || null;
      date = fm.date || fm.pubdate || fm.published;
      description = fm.description || fm.excerpt || null;
      route = '/' + rel.replace(/\\/g, '/').replace(/\.(md|mdx)$/, '').replace(/(^|\/)index$/, '');
    } else {
      title = (/<title[^>]*>([\s\S]*?)<\/title>/i.exec(content) || [])[1];
      const t = /<time\b[^>]*datetime=["']([^"']+)["']/i.exec(content);
      date = t ? t[1] : null;
      description = (/<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']/i.exec(content) || [])[1];
      route = '/' + rel.replace(/\\/g, '/').replace(/\.html?$/, '').replace(/(^|\/)index$/, '');
    }

    if (!title) continue;
    items.push({
      title: title.trim(),
      link: siteUrl + (route === '/' ? '/' : route),
      pubDate: date && !Number.isNaN(Date.parse(date)) ? new Date(Date.parse(date)).toUTCString() : null,
      description: (description || '').trim()
    });
  }

  // newest first; cap at 50 items per RSS best practice
  items.sort((a, b) => (Date.parse(b.pubDate || 0)) - (Date.parse(a.pubDate || 0)));
  const feedItems = items.slice(0, 50);

  const now = new Date().toUTCString();
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n<channel>\n';
  xml += `  <title>${escapeXml(siteName)}</title>\n`;
  xml += `  <link>${escapeXml(siteUrl)}</link>\n`;
  xml += `  <description>${escapeXml(siteDesc)}</description>\n`;
  xml += `  <lastBuildDate>${now}</lastBuildDate>\n`;
  xml += `  <atom:link href="${escapeXml(siteUrl)}/rss.xml" rel="self" type="application/rss+xml" />\n`;
  for (const item of feedItems) {
    xml += '  <item>\n';
    xml += `    <title>${escapeXml(item.title)}</title>\n`;
    xml += `    <link>${escapeXml(item.link)}</link>\n`;
    xml += `    <guid>${escapeXml(item.link)}</guid>\n`;
    if (item.pubDate) xml += `    <pubDate>${escapeXml(item.pubDate)}</pubDate>\n`;
    if (item.description) xml += `    <description>${escapeXml(item.description)}</description>\n`;
    xml += '  </item>\n';
  }
  xml += '</channel>\n</rss>\n';

  const outDir = path.join(projectDir, 'public');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'rss.xml');
  fs.writeFileSync(outPath, xml, 'utf8');

  const result = {
    success: true,
    output: path.relative(projectDir, outPath),
    items: feedItems.length,
    pagesConsidered: items.length,
    errors
  };

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return result;
  }

  console.log(`\n✅ RSS feed generated: ${result.output}`);
  console.log(`   Items: ${feedItems.length} (from ${items.length} content pages, newest first)`);
  console.log(`   Feed URL: ${siteUrl}/rss.xml`);
  console.log('   Tip: reference the feed in <head> as <link rel="alternate" type="application/rss+xml">.\n');
  return result;
}

if (isMain(import.meta.url)) {
  try { generateRss(); } catch (err) {
    console.error('RSS generation error:', err);
    process.exit(1);
  }
}
