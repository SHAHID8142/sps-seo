#!/usr/bin/env node

/**
 * SPS SEO Dynamic SVG Score Badge Generator
 * Version: 1.0.0
 * 
 * Runs deterministic audit and compiles live SVG score badges
 * for embedding into project README.md files.
 */

import fs from 'node:fs';
import path from 'node:path';
import { runAudit } from './audit.mjs';

const CWD = process.cwd();

export async function generateBadge(options = {}) {
  const projectDir = options.cwd || CWD;
  const auditReport = await runAudit({ cwd: projectDir, json: true });

  const score = auditReport.score;
  const grade = auditReport.grade;

  // Badge Color
  let rightColor = '#10b981'; // Green
  if (score < 60) rightColor = '#ef4444'; // Red
  else if (score < 75) rightColor = '#f59e0b'; // Amber
  else if (score < 90) rightColor = '#3b82f6'; // Blue

  const labelText = 'SEO';
  const valueText = `${score}/100 Grade ${grade}`;

  // Dimensions
  const leftWidth = 38;
  const rightWidth = valueText.length * 7.4 + 18;
  const totalWidth = leftWidth + rightWidth;
  const height = 20;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${height}" role="img" aria-label="${labelText}: ${valueText}">
  <title>${labelText}: ${valueText}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${totalWidth}" height="${height}" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${leftWidth}" height="${height}" fill="#1e293b"/>
    <rect x="${leftWidth}" width="${rightWidth}" height="${height}" fill="${rightColor}"/>
    <rect width="${totalWidth}" height="${height}" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif" text-rendering="geometricPrecision" font-size="110">
    <text aria-hidden="true" x="${(leftWidth * 10) / 2}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)">${labelText}</text>
    <text x="${(leftWidth * 10) / 2}" y="140" transform="scale(.1)" fill="#fff">${labelText}</text>
    <text aria-hidden="true" x="${leftWidth * 10 + (rightWidth * 10) / 2}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)">${valueText}</text>
    <text x="${leftWidth * 10 + (rightWidth * 10) / 2}" y="140" transform="scale(.1)" fill="#fff" font-weight="bold">${valueText}</text>
  </g>
</svg>
`;

  const destDir = fs.existsSync(path.join(projectDir, 'public')) ? path.join(projectDir, 'public') : projectDir;
  const badgeFile = path.join(destDir, 'seo-score-badge.svg');
  fs.writeFileSync(badgeFile, svg, 'utf8');

  console.log('\n====================================================');
  console.log('       SPS SEO LIVE SVG BADGE GENERATED             ');
  console.log('====================================================\n');
  console.log(`Badge File: ${path.relative(projectDir, badgeFile)}`);
  console.log(`Live Score: ${score}/100 (Grade: ${grade})\n`);

  console.log('Add this badge to your README.md:');
  console.log(`\n  [![SPS SEO Score](${path.relative(projectDir, badgeFile)})](sps-seo-audit-report.md)\n`);

  return { badgeFile, svg, score, grade };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  generateBadge();
}
