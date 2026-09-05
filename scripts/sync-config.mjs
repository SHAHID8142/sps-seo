#!/usr/bin/env node

/**
 * SPS SEO Config Synchronizer
 * Version: 1.0.0
 * 
 * Synchronizes project-level sps-seo-config.json with ./.sps/seo.json
 * ensures seamless compatibility with both standalone repos and SPS v4 orchestrator.
 */

import fs from 'node:fs';
import path from 'node:path';

const CWD = process.cwd();
const rootConfigPath = path.join(CWD, 'sps-seo-config.json');
const exampleConfigPath = path.join(CWD, 'sps-seo-config.example.json');
const spsDir = path.join(CWD, '.sps');
const spsConfigPath = path.join(spsDir, 'seo.json');

function main() {
  console.log('🔄 SPS SEO: Synchronizing Configuration...');

  const rootExists = fs.existsSync(rootConfigPath);
  const spsDirExists = fs.existsSync(spsDir);
  const spsConfigExists = fs.existsSync(spsConfigPath);

  let currentConfig = null;

  if (rootExists) {
    try {
      currentConfig = JSON.parse(fs.readFileSync(rootConfigPath, 'utf8'));
      console.log('  ✓ Loaded root sps-seo-config.json');
    } catch (e) {
      console.error('  ✗ Failed to parse root sps-seo-config.json:', e.message);
      process.exit(1);
    }
  } else if (spsConfigExists) {
    try {
      currentConfig = JSON.parse(fs.readFileSync(spsConfigPath, 'utf8'));
      console.log('  ✓ Loaded .sps/seo.json');
      fs.writeFileSync(rootConfigPath, JSON.stringify(currentConfig, null, 2), 'utf8');
      console.log('  ✓ Created root sps-seo-config.json mirror from .sps/seo.json');
    } catch (e) {
      console.error('  ✗ Failed to parse .sps/seo.json:', e.message);
      process.exit(1);
    }
  } else {
    // Neither exists: initialize from example
    if (fs.existsSync(exampleConfigPath)) {
      const exampleContent = fs.readFileSync(exampleConfigPath, 'utf8');
      fs.writeFileSync(rootConfigPath, exampleContent, 'utf8');
      currentConfig = JSON.parse(exampleContent);
      console.log('  ✓ Initialized sps-seo-config.json from template.');
    } else {
      console.error('  ✗ Cannot find template sps-seo-config.example.json');
      process.exit(1);
    }
  }

  // If .sps directory exists, mirror the configuration
  if (spsDirExists && currentConfig) {
    fs.writeFileSync(spsConfigPath, JSON.stringify(currentConfig, null, 2), 'utf8');
    console.log('  ✓ Synced configuration to .sps/seo.json');

    // Optionally append note to .sps/handoff.md if it exists
    const handoffPath = path.join(spsDir, 'handoff.md');
    if (fs.existsSync(handoffPath)) {
      const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
      const entry = `\n- [${timestamp}] SPS SEO: Synced configuration (Target: ${currentConfig.site?.name || 'Site'})\n`;
      fs.appendFileSync(handoffPath, entry, 'utf8');
    }
  }

  console.log('✅ Configuration sync complete.');
}

main();
