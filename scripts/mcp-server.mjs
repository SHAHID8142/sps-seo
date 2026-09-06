#!/usr/bin/env node

/**
 * SPS SEO — MCP (Model Context Protocol) Server
 * Version: 1.4.0
 *
 * Exposes all SPS SEO tools as MCP tools for integration with AI agents
 * that support the Model Context Protocol (Claude Desktop, VS Code, Cursor, etc.).
 *
 * Usage:
 *   node scripts/mcp-server.mjs
 *
 * MCP config (add to claude_desktop_config.json or VS Code settings):
 *   {
 *     "mcpServers": {
 *       "sps-seo": {
 *         "command": "node",
 *         "args": ["/absolute/path/to/scripts/mcp-server.mjs"]
 *       }
 *     }
 *   }
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VERSION } from './lib/core.mjs';

const SCRIPTS_DIR = path.dirname(fileURLToPath(import.meta.url));

const TOOLS = [
  { name: 'audit', description: 'Run deterministic 100-point SEO audit on a project directory', script: 'audit.mjs', args: ['--json'] },
  { name: 'fix', description: 'Apply automated SEO remediation (use dry_run:true to preview)', script: 'fix.mjs', args: ['--apply'] },
  { name: 'links', description: 'Generate internal link graph and find orphan pages', script: 'internal-links.mjs', args: ['--json'] },
  { name: 'keyword', description: 'Analyze keyword placement, density, prominence, and intent', script: 'keyword-audit.mjs', args: ['--json'] },
  { name: 'snippet', description: 'Check featured snippet eligibility and optimize content', script: 'snippet-audit.mjs', args: ['--json'] },
  { name: 'tfidf', description: 'Run TF*IDF analysis and semantic entity extraction', script: 'tfidf.mjs', args: ['--json'] },
  { name: 'ranking', description: 'Calculate SERP ranking probability using 15 signals', script: 'ranking-intel.mjs', args: ['--json'] },
  { name: 'backlink', description: 'Analyze link equity and digital PR opportunities', script: 'backlink-audit.mjs', args: ['--json'] },
  { name: 'security', description: 'Scan security headers, secrets, and best practices', script: 'security-audit.mjs', args: ['--json'] },
  { name: 'a11y', description: 'Run accessibility (WCAG) scanner', script: 'a11y.mjs', args: ['--json'] },
  { name: 'perf', description: 'Check Core Web Vitals and asset budget compliance', script: 'perf-budget.mjs', args: ['--json'] },
  { name: 'competitor', description: 'Generate competitor intelligence and content gap matrix', script: 'competitor-intel.mjs', args: ['--json'] },
  { name: 'crawl', description: 'Run polite robots-aware live crawler on a URL', script: 'crawler.mjs', args: ['--json'] },
  { name: 'pagespeed', description: 'Fetch PageSpeed Insights and CrUX field data for a URL', script: 'pagespeed.mjs', args: ['--json'] },
  { name: 'gsc', description: 'Analyze Google Search Console data (CSV or Service Account API)', script: 'gsc.mjs', args: ['--json'] },
  { name: 'logs', description: 'Analyze server access logs for crawl budget and 404 hotspots', script: 'log-analyzer.mjs', args: ['--json'] },
  { name: 'monorepo', description: 'Detect monorepo structure and enumerate packages', script: 'monorepo-detect.mjs', args: ['--json', '--scan'] },
  { name: 'video', description: 'Audit video SEO (VideoObject schema, embeds, video sitemap)', script: 'video-seo.mjs', args: ['--json'] },
  { name: 'news', description: 'Audit news SEO (NewsArticle schema, freshness, news sitemap)', script: 'news-seo.mjs', args: ['--json'] },
  { name: 'ecom', description: 'Audit e-commerce SEO (Product schema, offers, pagination)', script: 'ecommerce-seo.mjs', args: ['--json'] },
  { name: 'local', description: 'Audit local SEO (LocalBusiness schema, NAP consistency)', script: 'local-seo.mjs', args: ['--json'] },
  { name: 'duplicate', description: 'Detect near-duplicate content using simhash', script: 'duplicate-content.mjs', args: ['--json'] },
  { name: 'sitemap_validate', description: 'Validate sitemap URLs, hreflang, and index structure', script: 'sitemap-validate.mjs', args: ['--json'] },
  { name: 'rss_generator', description: 'Generate RSS 2.0 feed from content pages', script: 'generate-rss.mjs', args: ['--json'] },
  { name: 'init', description: 'Interactive config wizard — generates sps-seo-config.json', script: 'init.mjs', args: [] },
  { name: 'consult', description: 'Interactive SEO consultant — asks questions, analyzes project, builds action plan', script: 'consultant.mjs', args: [] },
  { name: 'fix_dry', description: 'Preview automated SEO remediation without applying changes', script: 'fix.mjs', args: ['--dry-run'] },
  { name: 'audit_json', description: 'Run deterministic 100-point SEO audit with JSON output', script: 'audit.mjs', args: ['--json'] },
  { name: 'cannibalization', description: 'Detect keyword cannibalization and duplicate meta tags', script: 'cannibalization.mjs', args: ['--json'] },
  { name: 'redirect', description: 'Audit redirects, chains, and canonical trailing slashes', script: 'redirect-audit.mjs', args: ['--json'] },
  { name: 'compare', description: 'Side-by-side project benchmark comparison', script: 'seo-compare.mjs', args: ['--json'] },
  { name: 'bundle', description: 'Audit JavaScript bundle weight and third-party scripts', script: 'bundle-audit.mjs', args: ['--json'] },
  { name: 'secrets', description: 'Scan for hardcoded secrets and credential leaks', script: 'secrets-scan.mjs', args: ['--json'] },
  { name: 'lighthouse', description: 'Run Lighthouse CI performance audit', script: 'lighthouse.mjs', args: ['--json'] },
  { name: 'preview', description: 'Generate visual SERP/social/AI citation preview', script: 'preview-serp.mjs', args: ['--json'] },
  { name: 'og', description: 'Generate branded 1200x630 OpenGraph SVG card', script: 'generate-og.mjs', args: ['--json'] },
  { name: 'sitemap_generate', description: 'Compile sitemap.xml, robots.txt, llms.txt', script: 'generate-sitemap.mjs', args: ['--json'] },
  { name: 'rank_tracker', description: 'Track ranking momentum from GSC/CSV data', script: 'ranking-tracker.mjs', args: ['--json'] },
  { name: 'validate_schema', description: 'Validate Schema.org JSON-LD syntax', script: 'validate-schema.mjs', args: ['--json'] },
  { name: 'i18n', description: 'Validate multilingual hreflang reciprocity', script: 'i18n-seo.mjs', args: ['--json'] },
  { name: 'sync_config', description: 'Sync sps-seo-config.json <-> .sps/seo.json', script: 'sync-config.mjs', args: ['--json'] },
  { name: 'ping_indexnow', description: 'Ping IndexNow API with updated routes', script: 'ping-indexnow.mjs', args: ['--json'] },
  { name: 'badge', description: 'Generate live SVG SEO score badge', script: 'badge.mjs', args: ['--json'] },
];

function buildToolSchemas() {
  return TOOLS.map(t => ({
    name: t.name,
    description: t.description,
    inputSchema: {
      type: 'object',
      properties: {
        project_dir: { type: 'string', description: 'Absolute path to the project directory' },
        url: { type: 'string', description: 'Target URL (for crawl, pagespeed, gsc tools)' },
        file: { type: 'string', description: 'Path to a file (for logs, gsc tools)' },
        dry_run: { type: 'boolean', description: 'Preview changes without applying (for fix tool)' },
        json: { type: 'boolean', description: 'Output in JSON format (default: true)' },
      },
    },
  }));
}

function runTool(name, args = {}) {
  const tool = TOOLS.find(t => t.name === name);
  if (!tool) return { error: `Unknown tool: ${name}` };
  const scriptPath = path.join(SCRIPTS_DIR, tool.script);
  const cliArgs = [...tool.args];
  if (args.project_dir) cliArgs.push('--dir', args.project_dir);
  if (args.url) cliArgs.push('--url', args.url);
  if (args.file) cliArgs.push('--file', args.file);
  if (args.dry_run && name === 'fix') cliArgs[cliArgs.indexOf('--apply')] = '--dry-run';
  const res = spawnSync(process.execPath, [scriptPath, ...cliArgs], { encoding: 'utf8', timeout: 120000 });
  if (res.error) return { error: res.error.message };
  if (res.status !== 0) return { error: res.stderr || `Tool exited with status ${res.status}` };
  try { return JSON.parse(res.stdout); } catch { return { output: res.stdout }; }
}
function handleMessage(msg) {
  const { id, method, params } = msg;
  switch (method) {
    case 'initialize':
      return {
        jsonrpc: '2.0', id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'sps-seo', version: VERSION },
        },
      };
    case 'tools/list':
      return { jsonrpc: '2.0', id, result: { tools: buildToolSchemas() } };
    case 'tools/call': {
      const { name, arguments: args } = params;
      const result = runTool(name, args || {});
      return {
        jsonrpc: '2.0', id,
        result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] },
      };
    }
    default:
      return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } };
  }
}

// stdio transport
process.stdin.setEncoding('utf8');
let buffer = '';
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  const lines = buffer.split('\n');
  buffer = lines.pop();
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      const response = handleMessage(msg);
      process.stdout.write(JSON.stringify(response) + '\n');
    } catch (e) {
      process.stdout.write(JSON.stringify({ jsonrpc: '2.0', error: { code: -32700, message: `Parse error: ${e.message}` } }) + '\n');
    }
  }
});
process.stdin.on('end', () => process.exit(0));

