#!/usr/bin/env bash
# SPS SEO Skill Uninstaller
# Version: 1.4.0
# Completely removes SPS SEO from all agent directories

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Agent directories where skill might be installed
INSTALL_DIRS=(
  "$HOME/.agents/skills/sps-seo"
  "$HOME/.gemini/config/skills/sps-seo"
  "$HOME/.cursor/skills/sps-seo"
  "$HOME/.windsurf/skills/sps-seo"
  "./.agents/skills/sps-seo"
)

print_help() {
  cat << EOF
SPS SEO Skill Uninstaller v1.4.0

Usage:
  ./scripts/uninstall.sh [options]

Options:
  --force         Skip confirmation prompts
  --dry-run       Show what would be removed without deleting
  -h, --help      Show this help message
EOF
}

FORCE=false
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --force) FORCE=true; shift ;;
    --dry-run) DRY_RUN=true; shift ;;
    -h|--help) print_help; exit 0 ;;
    *) echo "Unknown option: $1"; print_help; exit 1 ;;
  esac
done

echo "=============================================="
echo "      SPS SEO SKILL UNINSTALLER v1.4.0       "
echo "=============================================="
echo ""

FOUND_COUNT=0
REMOVED_COUNT=0

for dir in "${INSTALL_DIRS[@]}"; do
  # Expand path
  dir="${dir/#\~/$HOME}"
  
  if [ -L "$dir" ] || [ -d "$dir" ]; then
    FOUND_COUNT=$((FOUND_COUNT + 1))
    echo "Found: $dir"
    
    if $DRY_RUN; then
      echo "  [DRY RUN] Would remove"
      REMOVED_COUNT=$((REMOVED_COUNT + 1))
      continue
    fi
    
    if ! $FORCE; then
      read -p "  Remove this installation? (y/N) " -n 1 -r
      echo
      if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "  Skipped"
        continue
      fi
    fi
    
    rm -rf "$dir"
    echo "  ✓ Removed"
    REMOVED_COUNT=$((REMOVED_COUNT + 1))
  fi
done

echo ""
if [ $FOUND_COUNT -eq 0 ]; then
  echo "No SPS SEO installations found. Nothing to do."
else
  echo "Removed $REMOVED_COUNT of $FOUND_COUNT installations."
fi

echo ""
echo "Note: This does not remove:"
echo "  - Your project's sps-seo-config.json"
echo "  - Generated files (sitemap.xml, robots.txt, etc.)"
echo "  - Any edits made to your project files"
echo ""
echo "To fully clean up your project, delete those manually."
echo ""