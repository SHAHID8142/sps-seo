#!/usr/bin/env bash
# SPS SEO Skill Updater
# Version: 1.4.0
# Updates SPS SEO to the latest version from GitHub
# Works on both symlink and copy installations

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_URL="${SPS_SEO_REPO_URL:-https://github.com/shahid/sps-seo.git}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_help() {
  cat << EOF
SPS SEO Skill Updater v1.4.0

Usage:
  ./scripts/update.sh [options]

Options:
  --check         Check for updates without installing
  --force         Force update even if already latest
  --dry-run       Show what would happen without executing
  -h, --help      Show this help message

Environment:
  SPS_SEO_REPO_URL  Override the GitHub repo URL
                    (default: https://github.com/shahid/sps-seo.git)
EOF
}

CHECK_ONLY=false
FORCE=false
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --check) CHECK_ONLY=true; shift ;;
    --force) FORCE=true; shift ;;
    --dry-run) DRY_RUN=true; shift ;;
    -h|--help) print_help; exit 0 ;;
    *) echo "Unknown option: $1"; print_help; exit 1 ;;
  esac
done

echo "=============================================="
echo "        SPS SEO SKILL UPDATER v1.4.0         "
echo "=============================================="
echo ""

# Get current version
get_current_version() {
  if [ -f "$SCRIPT_DIR/VERSION" ]; then
    cat "$SCRIPT_DIR/VERSION"
  else
    echo "unknown"
  fi
}

CURRENT_VERSION=$(get_current_version)
echo "Current version: $CURRENT_VERSION"

# Check if this is a git repo or symlink
if [ -d "$SCRIPT_DIR/.git" ]; then
  INSTALL_TYPE="git"
elif [ -L "$SCRIPT_DIR" ]; then
  # Resolve symlink
  REAL_PATH=$(readlink "$SCRIPT_DIR" 2>/dev/null || readlink -f "$SCRIPT_DIR" 2>/dev/null || echo "$SCRIPT_DIR")
  if [ -d "$REAL_PATH/.git" ]; then
    INSTALL_TYPE="symlink-git"
    GIT_DIR="$REAL_PATH"
  else
    INSTALL_TYPE="symlink"
  fi
else
  INSTALL_TYPE="copy"
fi

# Fetch latest version from GitHub
echo "Checking for updates..."
LATEST_RAW=$(curl -sSL -w "\n%{http_code}" "https://raw.githubusercontent.com/shahid/sps-seo/main/VERSION" 2>/dev/null || echo "")
HTTP_CODE=$(echo "$LATEST_RAW" | tail -1)
LATEST_VERSION=$(echo "$LATEST_RAW" | head -1 | tr -d '[:space:]')

if [ "$HTTP_CODE" != "200" ] || [ -z "$LATEST_VERSION" ]; then
  echo -e "${RED}✗ Could not check for updates (HTTP $HTTP_CODE).${NC}"
  echo "  Repository: $REPO_URL"
  echo "  You can override with: SPS_SEO_REPO_URL=https://github.com/user/repo.git ./scripts/update.sh"
  exit 1
fi

echo "Latest version:  $LATEST_VERSION"

if [ "$CURRENT_VERSION" = "$LATEST_VERSION" ] && ! $FORCE; then
  echo -e "${GREEN}✓ Already up to date!${NC}"
  exit 0
fi

if $CHECK_ONLY; then
  if [ "$CURRENT_VERSION" != "$LATEST_VERSION" ]; then
    echo -e "${YELLOW}⚡ Update available: $CURRENT_VERSION → $LATEST_VERSION${NC}"
    exit 0
  else
    echo -e "${GREEN}✓ Already up to date!${NC}"
    exit 0
  fi
fi

echo ""
echo "Updating from $CURRENT_VERSION to $LATEST_VERSION..."
echo ""

if $DRY_RUN; then
  echo "[DRY RUN] Would update to v$LATEST_VERSION"
  exit 0
fi

case $INSTALL_TYPE in
  git)
    echo "Pulling latest changes..."
    cd "$SCRIPT_DIR"
    git fetch origin main
    git checkout main
    git pull origin main
    echo -e "${GREEN}✓ Updated successfully to v$(cat VERSION)${NC}"
    ;;
    
  symlink-git)
    echo "Updating source repository..."
    cd "$GIT_DIR"
    git fetch origin main
    git checkout main
    git pull origin main
    echo -e "${GREEN}✓ Updated successfully to v$(cat "$GIT_DIR/VERSION")${NC}"
    ;;
    
  symlink|copy)
    echo "Reinstalling from GitHub..."
    TEMP_DIR=$(mktemp -d)
    git clone --depth 1 "$REPO_URL" "$TEMP_DIR/sps-seo"
    
    if [ "$INSTALL_TYPE" = "symlink" ]; then
      # Find what's pointing to us
      TARGET=$(readlink "$SCRIPT_DIR")
      rm -rf "$TARGET"
      mv "$TEMP_DIR/sps-seo" "$TARGET"
    else
      # Copy installation - preserve config
      if [ -f "$SCRIPT_DIR/sps-seo-config.json" ]; then
        cp "$SCRIPT_DIR/sps-seo-config.json" "$TEMP_DIR/sps-seo/"
      fi
      rm -rf "$SCRIPT_DIR"
      mv "$TEMP_DIR/sps-seo" "$SCRIPT_DIR"
    fi
    
    rm -rf "$TEMP_DIR"
    echo -e "${GREEN}✓ Reinstalled successfully!${NC}"
    ;;
esac

echo ""
echo "To verify, run: node scripts/audit.mjs --version"
echo ""