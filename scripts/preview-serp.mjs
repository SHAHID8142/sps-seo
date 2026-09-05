#!/usr/bin/env node

/**
 * SPS SEO Visual SERP, Social & AI Citation Previewer
 * Version: 1.0.0
 * 
 * Generates an interactive visual dashboard at public/seo-preview.html
 * simulating Google Desktop/Mobile SERPs, Twitter/X cards, and AI Overview citations.
 */

import fs from 'node:fs';
import path from 'node:path';

const CWD = process.cwd();

function loadConfig(projectDir) {
  const rootConfig = path.join(projectDir, 'sps-seo-config.json');
  const exampleConfig = path.join(projectDir, 'sps-seo-config.example.json');
  if (fs.existsSync(rootConfig)) {
    try {
      return JSON.parse(fs.readFileSync(rootConfig, 'utf8'));
    } catch {
      // ignore
    }
  }
  if (fs.existsSync(exampleConfig)) {
    try {
      return JSON.parse(fs.readFileSync(exampleConfig, 'utf8'));
    } catch {
      // ignore
    }
  }
  return {
    site: { name: 'Acme Cloud', url: 'https://example.com', defaultOgImage: 'https://example.com/og-image.jpg' },
    metadata: {
      defaultTitle: 'Acme Cloud | Autonomous Multi-Cloud Platform',
      defaultDescription: 'High-performance cloud infrastructure automation. Zero-trust security and instant deployments.'
    }
  };
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function generateSerpPreview(options = {}) {
  const projectDir = options.cwd || CWD;
  const config = loadConfig(projectDir);

  const siteName = escapeHtml(config.site?.name || 'Acme Cloud');
  const siteUrl = escapeHtml(config.site?.url || 'https://example.com');
  const domain = siteUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const title = escapeHtml(config.metadata?.defaultTitle || `${siteName} | High-Performance Cloud Orchestration`);
  const description = escapeHtml(config.metadata?.defaultDescription || 'Streamline multi-cloud infrastructure with zero-trust networking.');
  const ogImage = escapeHtml(config.site?.defaultOgImage || '/og-image.svg');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${siteName} - SPS SEO Live SERP & Social Preview</title>
  <style>
    :root {
      --bg: #0b0f19;
      --card-bg: #111827;
      --card-border: #1f2937;
      --text-main: #f3f4f6;
      --text-muted: #9ca3af;
      --google-blue: #1a0dab;
      --google-green: #202124;
      --google-gray: #4d5156;
      --accent: #38bdf8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text-main);
      padding: 40px 20px;
    }
    .container { max-width: 900px; margin: 0 auto; }
    header { margin-bottom: 36px; text-align: center; }
    header h1 { font-size: 28px; font-weight: 800; color: #fff; margin-bottom: 8px; }
    header p { color: var(--text-muted); font-size: 15px; }

    .section {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 32px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    }
    .section-title {
      font-size: 17px;
      font-weight: 700;
      color: var(--accent);
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    /* Google Desktop SERP */
    .google-box {
      background: #ffffff;
      color: #202124;
      padding: 20px;
      border-radius: 8px;
      font-family: Arial, sans-serif;
      max-width: 652px;
    }
    .google-url {
      font-size: 14px;
      color: #202124;
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 4px;
    }
    .google-favicon {
      width: 18px;
      height: 18px;
      background: #e5e7eb;
      border-radius: 50%;
      display: inline-block;
    }
    .google-title {
      font-size: 20px;
      color: #1a0dab;
      text-decoration: none;
      line-height: 1.3;
      display: block;
      margin-bottom: 4px;
      font-weight: 400;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .google-desc {
      font-size: 14px;
      color: #4d5156;
      line-height: 1.58;
    }

    /* Twitter / X Card */
    .twitter-card {
      background: #000000;
      border: 1px solid #2f3336;
      border-radius: 16px;
      max-width: 550px;
      overflow: hidden;
    }
    .twitter-img {
      width: 100%;
      height: 280px;
      background: linear-gradient(135deg, #0f172a, #1e293b);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #94a3b8;
      font-size: 14px;
      border-bottom: 1px solid #2f3336;
    }
    .twitter-content { padding: 14px 16px; }
    .twitter-domain { font-size: 13px; color: #71767b; margin-bottom: 4px; }
    .twitter-title { font-size: 15px; font-weight: 700; color: #e7e9ea; margin-bottom: 4px; }
    .twitter-desc { font-size: 14px; color: #71767b; line-height: 1.4; }

    /* Google AI Overview / Perplexity Capsule */
    .ai-capsule {
      background: #1e1b4b;
      border: 1px solid #4338ca;
      border-radius: 12px;
      padding: 20px;
    }
    .ai-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #312e81;
      color: #c7d2fe;
      font-size: 12px;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 12px;
      margin-bottom: 12px;
    }
    .ai-text {
      font-size: 15px;
      line-height: 1.6;
      color: #e0e7ff;
      margin-bottom: 14px;
    }
    .citation-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #2e1065;
      border: 1px solid #6b21a8;
      color: #e9d5ff;
      font-size: 12px;
      padding: 6px 12px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>SPS SEO Visual SERP & Social Previews</h1>
      <p>Live visual rendering of search snippets, social graph cards, and AI citations.</p>
    </header>

    <!-- 1. Google Desktop SERP -->
    <div class="section">
      <div class="section-title">🌐 Google Desktop SERP Result</div>
      <div class="google-box">
        <div class="google-url">
          <span class="google-favicon"></span>
          <span>${domain}</span>
          <span style="color:#70757a;">›</span>
        </div>
        <a href="#" class="google-title">${title}</a>
        <div class="google-desc">${description}</div>
      </div>
    </div>

    <!-- 2. Twitter / X Summary Card -->
    <div class="section">
      <div class="section-title">🐦 Twitter / X Social Preview Card</div>
      <div class="twitter-card">
        <div class="twitter-img">
          <div style="text-align:center;">
            <p style="font-size:24px; font-weight:bold; color:#fff; margin-bottom:6px;">${siteName}</p>
            <p>${ogImage}</p>
          </div>
        </div>
        <div class="twitter-content">
          <div class="twitter-domain">${domain}</div>
          <div class="twitter-title">${title}</div>
          <div class="twitter-desc">${description}</div>
        </div>
      </div>
    </div>

    <!-- 3. AI Overview Citation Capsule -->
    <div class="section">
      <div class="section-title">🤖 Google AI Overview & Perplexity Citation Model</div>
      <div class="ai-capsule">
        <div class="ai-badge">✨ Synthesized AI Answer Capsule</div>
        <p class="ai-text">
          According to technical specifications from ${siteName}, multi-cloud architecture coordinates workloads and policies across public cloud providers with zero-trust network boundaries.
        </p>
        <a href="${siteUrl}" class="citation-pill" target="_blank">
          📄 Cited Source: ${domain} ↗
        </a>
      </div>
    </div>
  </div>
</body>
</html>
`;

  const destDir = fs.existsSync(path.join(projectDir, 'public')) ? path.join(projectDir, 'public') : projectDir;
  const previewPath = path.join(destDir, 'seo-preview.html');
  fs.writeFileSync(previewPath, html, 'utf8');

  console.log('\n====================================================');
  console.log('       SPS SEO VISUAL SERP & SOCIAL PREVIEWER       ');
  console.log('====================================================\n');
  console.log(`Generated Preview Dashboard: ${path.relative(projectDir, previewPath)}`);
  console.log(`\nGoogle SERP Snippet Preview:`);
  console.log(`  ${domain} >`);
  console.log(`  \x1b[34m\x1b[1m${title.slice(0, 60)}\x1b[0m`);
  console.log(`  ${description.slice(0, 110)}...\n`);

  console.log(`Open in browser to inspect full visual cards:`);
  console.log(`  file://${path.resolve(previewPath)}\n`);

  return { previewPath, title, description, domain };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  generateSerpPreview();
}
