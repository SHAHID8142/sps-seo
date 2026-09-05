#!/usr/bin/env node

/**
 * SPS SEO Branded OpenGraph Social Card Generator
 * Version: 1.0.0
 * 
 * Generates high-resolution 1200x630 vector SVG social preview cards
 * based on sps-seo-config.json branding parameters.
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
    site: { name: 'Acme Cloud', url: 'https://example.com', themeColor: '#0f172a' },
    metadata: {
      defaultTitle: 'Acme Cloud | Autonomous Platform',
      defaultDescription: 'Streamline multi-cloud infrastructure with zero-trust networking.'
    }
  };
}

function escapeXml(unsafe) {
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function generateOgImage(options = {}) {
  const projectDir = options.cwd || CWD;
  const config = loadConfig(projectDir);

  const brandName = escapeXml(config.site?.name || 'Acme Cloud');
  const domain = escapeXml(config.site?.url?.replace(/^https?:\/\//, '') || 'example.com');
  const title = escapeXml(config.metadata?.defaultTitle || `${brandName} | Modern Cloud Platform`);
  const rawDesc = config.metadata?.defaultDescription || 'High-performance architecture with real-time observability and security.';
  const description = escapeXml(rawDesc.length > 120 ? rawDesc.slice(0, 117) + '...' : rawDesc);
  const themeColor = config.site?.themeColor || '#0f172a';

  // 1200 x 630 SVG template
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${themeColor}" />
      <stop offset="50%" stop-color="#1e293b" />
      <stop offset="100%" stop-color="#020617" />
    </linearGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="50%" stop-color="#818cf8" />
      <stop offset="100%" stop-color="#c084fc" />
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="60" result="blur" />
    </filter>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bgGrad)" />

  <!-- Ambient Glow Orbs -->
  <circle cx="1050" cy="150" r="220" fill="#38bdf8" opacity="0.15" filter="url(#glow)" />
  <circle cx="150" cy="500" r="240" fill="#818cf8" opacity="0.12" filter="url(#glow)" />

  <!-- Card Border -->
  <rect x="30" y="30" width="1140" height="570" rx="24" fill="none" stroke="#334155" stroke-width="2" opacity="0.6" />

  <!-- Brand Pill -->
  <g transform="translate(80, 90)">
    <rect width="200" height="42" rx="21" fill="#1e293b" stroke="#475569" stroke-width="1.5" />
    <circle cx="24" cy="21" r="7" fill="#38bdf8" />
    <text x="44" y="27" fill="#f8fafc" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="600" letter-spacing="0.5">
      ${brandName}
    </text>
  </g>

  <!-- Main Title -->
  <text x="80" y="240" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="52" font-weight="800" letter-spacing="-1">
    <tspan x="80" dy="0">${title.slice(0, 38)}</tspan>
    ${title.length > 38 ? `<tspan x="80" dy="68">${title.slice(38, 76)}</tspan>` : ''}
  </text>

  <!-- Description -->
  <text x="80" y="${title.length > 38 ? 390 : 330}" fill="#94a3b8" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="24" font-weight="400" width="1000">
    <tspan x="80" dy="0">${description.slice(0, 60)}</tspan>
    ${description.length > 60 ? `<tspan x="80" dy="36">${description.slice(60, 120)}</tspan>` : ''}
  </text>

  <!-- Footer Divider Accent Line -->
  <rect x="80" y="500" width="1040" height="3" fill="url(#accentGrad)" opacity="0.8" rx="1.5" />

  <!-- Footer Domain & Watermark -->
  <text x="80" y="545" fill="#cbd5e1" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="500">
    ${domain}
  </text>
  <text x="1120" y="545" text-anchor="end" fill="#64748b" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="500">
    SPS SEO Verified
  </text>
</svg>
`;

  const destDir = fs.existsSync(path.join(projectDir, 'public')) ? path.join(projectDir, 'public') : projectDir;
  const targetFile = path.join(destDir, 'og-image.svg');
  fs.writeFileSync(targetFile, svg, 'utf8');

  console.log(`\n🎨 Branded OpenGraph Social Card Generated!`);
  console.log(`   └─ File: ${path.relative(projectDir, targetFile)} (1200x630)\n`);

  return { targetFile, svg };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  generateOgImage();
}
