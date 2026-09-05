#!/usr/bin/env bash
# SPS SEO Skill Installer
# Version: 1.4.0
# Installs SPS SEO into global or local agent skills directories.
# Supports: Claude, Cursor, Codex, Windsurf, OpenCode, Antigravity/Gemini

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_MODE="global"
COPY_MODE=false
DRY_RUN=false
FORCE=false

# Agent directories
GLOBAL_DIR="$HOME/.agents/skills/sps-seo"
GEMINI_DIR="$HOME/.gemini/config/skills/sps-seo"
CURSOR_DIR="$HOME/.cursor/skills/sps-seo"
WINDSURF_DIR="$HOME/.windsurf/skills/sps-seo"
LOCAL_DIR="$(pwd)/.agents/skills/sps-seo"

print_help() {
  cat << EOF
SPS SEO Skill Installer v1.4.0

Usage:
  ./scripts/install.sh [options]

Options:
  --global        Install globally to ~/.agents/skills/sps-seo (default)
  --local         Install locally to ./.agents/skills/sps-seo
  --copy          Copy files instead of creating symbolic links
  --force         Overwrite existing installation without prompting
  --dry-run       Show actions without executing
  -h, --help      Show this help message

Examples:
  ./scripts/install.sh                  # Global install (symlink)
  ./scripts/install.sh --copy           # Global install (copy)
  ./scripts/install.sh --local          # Local install for current project
  ./scripts/install.sh --force          # Overwrite existing
EOF
}

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --global) TARGET_MODE="global"; shift ;;
    --local) TARGET_MODE="local"; shift ;;
    --copy) COPY_MODE=true; shift ;;
    --force) FORCE=true; shift ;;
    --dry-run) DRY_RUN=true; shift ;;
    -h|--help) print_help; exit 0 ;;
    *) echo "Unknown option: $1"; print_help; exit 1 ;;
  esac
done

install_to_dir() {
  local dest_dir="$1"
  local dest_name="$2"
  
  if $DRY_RUN; then
    echo "[DRY RUN] Would install to $dest_dir"
    return
  fi
  
  # Create parent directory
  mkdir -p "$(dirname "$dest_dir")"
  
  # Handle existing installation
  if [ -L "$dest_dir" ] || [ -d "$dest_dir" ]; then
    if ! $FORCE; then
      echo "⚠️  $dest_name already installed at $dest_dir"
      read -p "Overwrite? (y/N) " -n 1 -r
      echo
      if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Skipping $dest_name"
        return
      fi
    fi
    echo "Removing existing $dest_name installation..."
    rm -rf "$dest_dir"
  fi
  
  # Install
  if $COPY_MODE; then
    echo "Copying SPS SEO to $dest_dir..."
    cp -R "$SCRIPT_DIR" "$dest_dir"
  else
    echo "Creating symlink $SCRIPT_DIR -> $dest_dir..."
    ln -s "$SCRIPT_DIR" "$dest_dir"
  fi
  
  # Verify
  if [ -f "$dest_dir/SKILL.md" ]; then
    echo "✓ Successfully installed $dest_name!"
  else
    echo "✗ Error: Installation failed for $dest_name"
    return 1
  fi
}

echo "=============================================="
echo "       SPS SEO SKILL INSTALLER v1.4.0        "
echo "=============================================="
echo "Source:      $SCRIPT_DIR"
echo "Mode:        $([ "$COPY_MODE" = true ] && echo "Copy" || echo "Symlink")"
echo "Dry Run:     $DRY_RUN"
echo "Force:       $FORCE"
echo "----------------------------------------------"

if [[ "$TARGET_MODE" == "global" ]]; then
  echo "Installing to all detected agent directories..."
  install_to_dir "$GLOBAL_DIR" "Global (Claude/OpenCode)"
  install_to_dir "$GEMINI_DIR" "Gemini/Antigravity"
  install_to_dir "$CURSOR_DIR" "Cursor"
  install_to_dir "$WINDSURF_DIR" "Windsurf"
else
  install_to_dir "$LOCAL_DIR" "Local"
fi

echo ""
echo "=============================================="
echo "  SPS SEO v1.4.0 installed successfully!      "
echo "=============================================="
echo ""
echo "Quick Start:"
echo "  1. Run: node scripts/init.mjs          # Configure your project"
echo "  2. Run: node scripts/audit.mjs         # Get baseline SEO score"
echo "  3. Run: node scripts/fix.mjs --apply   # Auto-fix issues"
echo "  4. Run: node scripts/audit.mjs         # Verify improvement"
echo ""
echo "Trigger phrases for AI agents:"
echo "  /sps-seo, 'optimize SEO', 'run technical SEO audit'"
echo "  'fix meta tags', 'generate schema', 'improve ranking'"
echo ""
echo "To update: ./scripts/update.sh"
echo "To uninstall: ./scripts/uninstall.sh"
echo ""