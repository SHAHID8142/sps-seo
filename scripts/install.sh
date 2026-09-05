#!/usr/bin/env bash

# SPS SEO Skill Installer
# Version: 1.4.0
# Installs SPS SEO into global or local agent skills directories.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_MODE="global"
COPY_MODE=false
DRY_RUN=false

print_help() {
  cat << EOF
SPS SEO Skill Installer

Usage:
  ./scripts/install.sh [options]

Options:
  --global        Install globally to ~/.agents/skills/sps-seo (default)
  --local         Install locally to ./.agents/skills/sps-seo in current directory
  --copy          Copy files instead of creating symbolic links
  --dry-run       Show actions without executing
  -h, --help      Show this help message
EOF
}

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --global)
      TARGET_MODE="global"
      shift
      ;;
    --local)
      TARGET_MODE="local"
      shift
      ;;
    --copy)
      COPY_MODE=true
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    -h|--help)
      print_help
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      print_help
      exit 1
      ;;
  esac
done

if [[ "$TARGET_MODE" == "global" ]]; then
  DEST_DIR="$HOME/.agents/skills/sps-seo"
else
  DEST_DIR="$(pwd)/.agents/skills/sps-seo"
fi

echo "=============================================="
echo "          SPS SEO SKILL INSTALLER            "
echo "=============================================="
echo "Source:      $SCRIPT_DIR"
echo "Destination: $DEST_DIR"
echo "Mode:        $([ "$COPY_MODE" = true ] && echo "Copy" || echo "Symlink")"
echo "Dry Run:     $DRY_RUN"
echo "----------------------------------------------"

if [ "$DRY_RUN" = true ]; then
  echo "[DRY RUN] Would create parent directory: $(dirname "$DEST_DIR")"
  if [ "$COPY_MODE" = true ]; then
    echo "[DRY RUN] Would copy $SCRIPT_DIR to $DEST_DIR"
  else
    echo "[DRY RUN] Would link $SCRIPT_DIR -> $DEST_DIR"
  fi
  echo "[DRY RUN] Finished without changes."
  exit 0
fi

# Ensure parent directory exists
mkdir -p "$(dirname "$DEST_DIR")"

# Remove existing link/directory if present
if [ -L "$DEST_DIR" ]; then
  echo "Removing existing symlink at $DEST_DIR..."
  rm "$DEST_DIR"
elif [ -d "$DEST_DIR" ]; then
  echo "Backing up existing directory at $DEST_DIR to ${DEST_DIR}.bak..."
  rm -rf "${DEST_DIR}.bak"
  mv "$DEST_DIR" "${DEST_DIR}.bak"
fi

# Install
if [ "$COPY_MODE" = true ]; then
  echo "Copying SPS SEO skill to $DEST_DIR..."
  cp -R "$SCRIPT_DIR" "$DEST_DIR"
else
  echo "Creating symlink $SCRIPT_DIR -> $DEST_DIR..."
  ln -s "$SCRIPT_DIR" "$DEST_DIR"
fi

# Verify
if [ -f "$DEST_DIR/SKILL.md" ]; then
  echo "✓ Successfully verified SKILL.md in destination!"
  echo ""
  echo "SPS SEO is now installed and ready for use by AI agents."
  echo "Trigger phrases: /sps-seo, 'optimize SEO', 'run technical SEO audit'"
else
  echo "✗ Warning: Destination missing SKILL.md. Please check the install path."
  exit 1
fi
