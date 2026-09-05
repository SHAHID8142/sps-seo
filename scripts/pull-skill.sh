#!/usr/bin/env bash

# SPS SEO Remote Pull & Activation Script
# Version: 1.0.0
# Usage:
#   curl -sSL https://raw.githubusercontent.com/<your-username>/sps-seo/main/scripts/pull-skill.sh | bash

set -euo pipefail

REPO_URL="${SPS_SEO_REPO_URL:-https://github.com/shahid/sps-seo.git}"
TARGET_DIR=".agents/skills/sps-seo"

echo "===================================================="
echo "          SPS SEO REMOTE ACTIVATION SCRIPT          "
echo "===================================================="
echo "Target directory: $TARGET_DIR"
echo "Repository URL:   $REPO_URL"
echo "----------------------------------------------------"

mkdir -p ".agents/skills"

if [ -d "$TARGET_DIR" ]; then
  echo "Updating existing SPS SEO skill in $TARGET_DIR..."
  (cd "$TARGET_DIR" && git pull --ff-only 2>/dev/null || true)
else
  echo "Cloning SPS SEO skill into $TARGET_DIR..."
  git clone "$REPO_URL" "$TARGET_DIR"
fi

# Ensure sps-seo-config.json exists
if [ ! -f "sps-seo-config.json" ]; then
  if [ -f "$TARGET_DIR/sps-seo-config.example.json" ]; then
    cp "$TARGET_DIR/sps-seo-config.example.json" "sps-seo-config.json"
    echo "✓ Initialized sps-seo-config.json from template."
  fi
fi

# If .sps directory exists, sync
if [ -d ".sps" ] && [ -f "$TARGET_DIR/scripts/sync-config.mjs" ]; then
  node "$TARGET_DIR/scripts/sync-config.mjs" 2>/dev/null || true
fi

echo ""
echo "✅ SPS SEO successfully pulled and activated!"
echo ""
echo "Quick Commands:"
echo "  Run Audit:   node $TARGET_DIR/scripts/audit.mjs"
echo "  Auto-Fix:    node $TARGET_DIR/scripts/fix.mjs --apply"
echo "  Preview:     node $TARGET_DIR/scripts/preview-serp.mjs"
echo ""
