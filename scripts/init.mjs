#!/usr/bin/env node

/**
 * SPS SEO Interactive Setup Wizard
 * Version: 1.0.0
 * 
 * Interactively prompts for project SEO parameters and generates sps-seo-config.json
 */

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { fileURLToPath } from 'node:url';

const CWD = process.cwd();
const targetConfigPath = path.join(CWD, 'sps-seo-config.json');

async function main() {
  console.log('\n✨ Welcome to the SPS SEO Setup Wizard!\n');

  const isNonInteractive = process.argv.includes('--yes') || process.argv.includes('-y');
  let config = {};

  if (fs.existsSync(targetConfigPath)) {
    try {
      config = JSON.parse(fs.readFileSync(targetConfigPath, 'utf8'));
      console.log('ℹ Existing sps-seo-config.json detected. Defaults populated.\n');
    } catch {
      // ignore
    }
  }

  if (isNonInteractive) {
    console.log('Running in non-interactive mode. Generating default configuration...');
    const examplePath = path.join(CWD, 'sps-seo-config.example.json');
    if (fs.existsSync(examplePath)) {
      fs.copyFileSync(examplePath, targetConfigPath);
      console.log('✓ Initialized sps-seo-config.json from template.');
      return;
    }
  }

  const rl = readline.createInterface({ input, output });

  try {
    const siteUrl = await rl.question(`1. Production Domain URL [${config.site?.url || 'https://example.com'}]: `);
    const siteName = await rl.question(`2. Brand / Site Name [${config.site?.name || 'Acme Cloud'}]: `);
    const defaultTitle = await rl.question(`3. Default Homepage Title [${config.metadata?.defaultTitle || siteName || 'Acme Cloud | Autonomous Platform'}]: `);
    const defaultDesc = await rl.question(`4. Meta Description (140-160 chars) [${config.metadata?.defaultDescription || 'High-performance cloud automation with zero-trust networking.'}]: `);
    const keywordsRaw = await rl.question(`5. Primary Keywords (comma separated) [${config.metadata?.keywords?.join(', ') || 'cloud automation, devops, kubernetes'}]: `);
    const authorName = await rl.question(`6. Primary Author Name (E-E-A-T) [${config.author?.name || 'Jane Doe'}]: `);
    const authorRole = await rl.question(`7. Author Professional Title [${config.author?.role || 'Lead Software Architect'}]: `);

    const finalConfig = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      version: '1.0.0',
      site: {
        name: siteName.trim() || config.site?.name || 'Acme Cloud',
        url: (siteUrl.trim() || config.site?.url || 'https://example.com').replace(/\/$/, ''),
        locale: 'en_US',
        language: 'en',
        logo: `${(siteUrl.trim() || config.site?.url || 'https://example.com').replace(/\/$/, '')}/logo.png`,
        defaultOgImage: `${(siteUrl.trim() || config.site?.url || 'https://example.com').replace(/\/$/, '')}/og-image.jpg`,
        themeColor: '#0f172a'
      },
      metadata: {
        defaultTitle: defaultTitle.trim() || config.metadata?.defaultTitle || `${siteName.trim() || 'Acme Cloud'} | Autonomous Platform`,
        titleTemplate: `%s | ${siteName.trim() || 'Acme Cloud'}`,
        defaultDescription: defaultDesc.trim() || config.metadata?.defaultDescription || 'High-performance cloud automation with zero-trust networking.',
        keywords: (keywordsRaw.trim() || config.metadata?.keywords?.join(', ') || 'cloud automation, devops, kubernetes')
          .split(',')
          .map(k => k.trim())
          .filter(Boolean),
        secondaryKeywords: []
      },
      author: {
        name: authorName.trim() || config.author?.name || 'Jane Doe',
        role: authorRole.trim() || config.author?.role || 'Lead Software Architect',
        url: `${(siteUrl.trim() || config.site?.url || 'https://example.com').replace(/\/$/, '')}/team/${(authorName.trim() || 'jane-doe').toLowerCase().replace(/\s+/g, '-')}`,
        social: {}
      },
      publisher: {
        name: siteName.trim() || config.site?.name || 'Acme Cloud',
        url: (siteUrl.trim() || config.site?.url || 'https://example.com').replace(/\/$/, ''),
        logo: `${(siteUrl.trim() || config.site?.url || 'https://example.com').replace(/\/$/, '')}/logo.png`
      },
      socialHandles: {
        twitter: '',
        github: '',
        linkedin: ''
      },
      targeting: {
        country: 'Global',
        regions: ['US', 'EU', 'Global'],
        audience: 'Software Engineers and Technical Decision Makers',
        competitors: []
      },
      technical: {
        enforceCanonical: true,
        enforceHeadingHierarchy: true,
        enforceImageAlt: true,
        generateSitemap: true,
        generateRobotsTxt: true,
        generateLlmsTxt: true,
        openGraph: { enabled: true, type: 'website' },
        twitter: { enabled: true, card: 'summary_large_image' }
      },
      schemas: ['Organization', 'WebSite', 'BreadcrumbList'],
      aiSeo: {
        enabled: true,
        generateLlmsTxt: true,
        enableAnswerCapsules: true,
        enforcePassageClarity: true
      },
      indexing: {
        googleSearchConsoleVerified: false,
        sitemapSubmitted: false,
        bingWebmasterVerified: false,
        lastIndexedCheck: null
      }
    };

    fs.writeFileSync(targetConfigPath, JSON.stringify(finalConfig, null, 2), 'utf8');
    console.log(`\n✅ Successfully generated ${path.relative(CWD, targetConfigPath)}!`);

    // Sync to .sps/seo.json if .sps/ exists
    const spsDir = path.join(CWD, '.sps');
    if (fs.existsSync(spsDir)) {
      fs.writeFileSync(path.join(spsDir, 'seo.json'), JSON.stringify(finalConfig, null, 2), 'utf8');
      console.log('✓ Automatically synchronized with .sps/seo.json');
    }

    console.log('\nNext steps:');
    console.log('  1. Run audit:          npm run audit');
    console.log('  2. Generate sitemaps:  npm run sitemap');
    console.log('  3. Generate OG image:  npm run og\n');
  } finally {
    rl.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().catch(err => {
    console.error('Init wizard error:', err);
    process.exit(1);
  });
}

export { main };
