#!/usr/bin/env node

/**
 * SPS SEO IndexNow Instant Search Engine Notification
 * Version: 1.0.0
 * 
 * Directly pings IndexNow API (Bing, Yandex, Seznam, Naver) with changed URLs
 * for near-instant indexing.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const CWD = process.cwd();

function loadConfig(projectDir) {
  const rootConfig = path.join(projectDir, 'sps-seo-config.json');
  if (fs.existsSync(rootConfig)) {
    try {
      return JSON.parse(fs.readFileSync(rootConfig, 'utf8'));
    } catch {
      // ignore
    }
  }
  return { site: { url: 'https://example.com' } };
}

function getOrGenerateKey(destDir) {
  const keyFile = path.join(destDir, 'indexnow-key.txt');
  if (fs.existsSync(keyFile)) {
    return fs.readFileSync(keyFile, 'utf8').trim();
  }
  // Generate 32-hex key
  const key = crypto.randomBytes(16).toString('hex');
  fs.writeFileSync(keyFile, key, 'utf8');
  // IndexNow also requires key-named file in public root
  fs.writeFileSync(path.join(destDir, `${key}.txt`), key, 'utf8');
  return key;
}

export async function pingIndexNow(options = {}) {
  const projectDir = options.cwd || CWD;
  const isDryRun = options.dryRun || process.argv.includes('--dry-run');
  const config = loadConfig(projectDir);

  const destDir = fs.existsSync(path.join(projectDir, 'public')) ? path.join(projectDir, 'public') : projectDir;
  const host = (config.site?.url || 'https://example.com').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const key = getOrGenerateKey(destDir);
  const keyLocation = `${(config.site?.url || 'https://example.com').replace(/\/$/, '')}/${key}.txt`;

  // Collect target URLs from sitemap or options
  let urlList = options.urls;
  if (!urlList) {
    const sitemapPath = path.join(destDir, 'sitemap.xml');
    if (fs.existsSync(sitemapPath)) {
      const sitemapContent = fs.readFileSync(sitemapPath, 'utf8');
      const matches = [...sitemapContent.matchAll(/<loc>([^<]+)<\/loc>/g)];
      urlList = matches.map(m => m[1]);
    } else {
      urlList = [`${config.site?.url || 'https://example.com'}/`];
    }
  }

  const payload = {
    host,
    key,
    keyLocation,
    urlList
  };

  console.log('\n====================================================');
  console.log('       SPS SEO INDEXNOW SEARCH ENGINE PING          ');
  console.log('====================================================\n');
  console.log(`Host:         ${host}`);
  console.log(`Key Location: ${keyLocation}`);
  console.log(`URLs to Ping: ${urlList.length} route(s)`);

  if (isDryRun) {
    console.log('\n[DRY RUN] Would send POST to https://api.indexnow.org/indexnow:');
    console.log(JSON.stringify(payload, null, 2));
    console.log('\n[DRY RUN] IndexNow verification key files prepared in public directory.');
    return { success: true, dryRun: true, payload };
  }

  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify(payload)
    });

    if (res.status === 200 || res.status === 202) {
      console.log(`\n✅ Successfully submitted ${urlList.length} URL(s) to IndexNow (Status: ${res.status})!`);
      console.log('   Bing and participating search engines have received your updated routes.\n');
      return { success: true, status: res.status, payload };
    } else {
      console.log(`\n⚠️ IndexNow responded with HTTP ${res.status}: ${await res.text()}`);
      return { success: false, status: res.status };
    }
  } catch (err) {
    console.warn(`\n⚠️ Failed to reach IndexNow API (network offline or endpoint unreachable): ${err.message}`);
    return { success: false, error: err.message };
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  pingIndexNow();
}
