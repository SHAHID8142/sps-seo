#!/usr/bin/env node

/**
 * SPS SEO — Video SEO Audit
 * Version: 1.4.0
 *
 * Zero-dependency Video SEO vertical scanner:
 *  1. VideoObject JSON-LD presence & required property validation
 *  2. Video embed detection (YouTube, Vimeo, self-hosted <video>)
 *  3. Privacy-enhanced embed check (youtube-nocookie.com preferred)
 *  4. Video sitemap detection
 *
 * Output: 0-100 Video SEO Score + per-page findings (--json supported).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { walkFiles, IGNORE_DIRS, isMain } from './lib/core.mjs';

const CWD = process.cwd();

const VIDEO_HOSTS = [
  { host: 'youtube.com', label: 'YouTube', nocookie: 'youtube-nocookie.com' },
  { host: 'youtu.be', label: 'YouTube (short)', nocookie: 'youtube-nocookie.com' },
  { host: 'youtube-nocookie.com', label: 'YouTube (privacy-enhanced)', nocookie: null },
  { host: 'vimeo.com', label: 'Vimeo', nocookie: null },
  { host: 'wistia.net', label: 'Wistia', nocookie: null },
  { host: 'dailymotion.com', label: 'Dailymotion', nocookie: null }
];

const REQUIRED_VIDEO_PROPS = ['name', 'description', 'thumbnailUrl', 'uploadDate', 'duration'];

function extractJsonLd(content) {
  const blocks = [];
  const regex = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = regex.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(m[1].trim());
      if (Array.isArray(parsed)) blocks.push(...parsed);
      else blocks.push(parsed);
    } catch {
      blocks.push({ __invalid: true });
    }
  }
  return blocks;
}

export function runVideoSeoAudit(options = {}) {
  const projectDir = options.cwd ? path.resolve(options.cwd) : CWD;
  const jsonOutput = options.json || process.argv.includes('--json');

  const pages = walkFiles(projectDir, {
    ignoreDirs: IGNORE_DIRS,
    extraIgnore: new Set(['public'])
  });

  const pageReports = [];
  const findings = [];
  let totalScore = 100;
  const penalize = (amt) => { totalScore -= amt; };

  let embedPages = 0;
  let schemaPages = 0;

  for (const file of pages) {
    let content;
    try { content = fs.readFileSync(file, 'utf8'); } catch { continue; }

    const report = {
      file: path.relative(projectDir, file),
      embeds: [],
      hasVideoSchema: false
    };

    // Detect embeds
    const iframeRegex = /<iframe\b[^>]*src=["']([^"']+)["'][^>]*>/gi;
    let m;
    while ((m = iframeRegex.exec(content)) !== null) {
      const src = m[1];
      const host = VIDEO_HOSTS.find(v => src.includes(v.host));
      if (host) {
        report.embeds.push({ type: 'iframe', provider: host.label, url: src });
        if (host.nocookie && !src.includes(host.nocookie)) {
          findings.push({
            severity: 'low',
            file: report.file,
            msg: `${host.label} embed without privacy-enhanced domain (${host.nocookie}).`,
            fix: `Use https://${host.nocookie}/embed/... to avoid setting tracking cookies.`
          });
          penalize(2);
        }
      }
    }
    if (/<video\b[^>]*>([\s\S]*?)<\/video>/i.test(content) ||
        /<source\b[^>]*src=["'][^"']+\.(mp4|webm|ogv)/i.test(content) ||
        /lite-youtube|react-player/i.test(content)) {
      report.embeds.push({ type: 'element-or-component', provider: 'self-hosted/js' });
    }

    // VideoObject schema validation
    const blocks = extractJsonLd(content);
    const videoSchemas = blocks.filter(b => String(b['@type'] || '').toLowerCase() === 'videoobject');
    if (videoSchemas.length > 0) {
      report.hasVideoSchema = true;
      schemaPages++;
      for (const vs of videoSchemas) {
        for (const prop of REQUIRED_VIDEO_PROPS) {
          if (!vs[prop]) {
            findings.push({
              severity: 'medium',
              file: report.file,
              msg: `VideoObject schema missing "${prop}" — required for Google video rich results.`,
              fix: `Add "${prop}" to the VideoObject JSON-LD (template: schemas/video.json).`
            });
            penalize(4);
          }
        }
        if (vs.uploadDate && Number.isNaN(Date.parse(vs.uploadDate))) {
          findings.push({ severity: 'medium', file: report.file, msg: 'VideoObject uploadDate is not valid ISO 8601.', fix: 'Use e.g. 2026-01-15T08:00:00+00:00.' });
          penalize(3);
        }
        if (!vs.contentUrl && !vs.embedUrl) {
          findings.push({ severity: 'high', file: report.file, msg: 'VideoObject has neither contentUrl nor embedUrl — Google cannot index the video.', fix: 'Add contentUrl (self-hosted) or embedUrl (player page).' });
          penalize(8);
        }
      }
    }

    if (report.embeds.length > 0) embedPages++;
    if (report.embeds.length > 0 && !report.hasVideoSchema) {
      findings.push({
        severity: 'high',
        file: report.file,
        msg: 'Video embed present but no VideoObject JSON-LD — invisible to video rich results.',
        fix: 'Add VideoObject schema (template: schemas/video.json).'
      });
      penalize(10);
    }

    pageReports.push(report);
  }

  // Video sitemap detection
  const videoSitemap = [
    'public/sitemap-video.xml', 'sitemap-video.xml', 'public/video-sitemap.xml'
  ].some(rel => fs.existsSync(path.join(projectDir, rel)));
  if (embedPages > 0 && !videoSitemap) {
    findings.push({
      severity: 'low',
      file: null,
      msg: 'Video content detected but no video sitemap (sitemap-video.xml).',
      fix: 'Generate a video sitemap with <video:video> entries for each video page.'
    });
    penalize(5);
  }

  totalScore = Math.max(0, Math.min(100, Math.round(totalScore)));
  const grade = totalScore >= 90 ? 'A' : totalScore >= 75 ? 'B' : totalScore >= 50 ? 'C' : 'F';

  const result = {
    timestamp: new Date().toISOString(),
    score: totalScore,
    grade,
    pagesScanned: pageReports.length,
    embedPages,
    videoSchemaPages: schemaPages,
    hasVideoSitemap: videoSitemap,
    pageReports,
    findings
  };

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return result;
  }

  console.log('\n====================================================');
  console.log('          SPS SEO VIDEO AUDIT REPORT                ');
  console.log('====================================================\n');
  console.log(`Video SEO Score: ${result.score}/100 (Grade: ${result.grade})`);
  console.log(`Pages scanned: ${result.pagesScanned} | Pages with embeds: ${embedPages} | With VideoObject schema: ${schemaPages}`);
  for (const f of findings) {
    console.log(`  [${f.severity.toUpperCase()}] ${f.file || 'site'}: ${f.msg}`);
  }
  if (findings.length === 0) console.log('  ✓ No video SEO issues detected.');
  console.log('');
  return result;
}

if (isMain(import.meta.url)) {
  try { runVideoSeoAudit(); } catch (err) {
    console.error('Video SEO audit error:', err);
    process.exit(1);
  }
}
