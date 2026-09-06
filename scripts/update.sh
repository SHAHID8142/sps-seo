#!/usr/bin/env bash
# SPS SEO Skill Updater
# Version: 1.5.0
# Updates SPS SEO to the latest version from GitHub
# Works on both git-clone and copy installations
#
# Improvements over v1.4.0:
#   - Compares git commit hashes, not just VERSION strings (fixes false "up to date")
#   - Handles diverged history caused by force-pushes (resets to origin/main)
#   - Handles dirty working trees (stashes with --force, aborts without)
#   - Shows commit log of what changed

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_URL="${SPS_SEO_REPO_URL:-https://github.com/SHAHID8142/sps-seo.git}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_help() {
  cat << EOF
SPS SEO Skill Updater v1.5.0

Usage:
  ./scripts/update.sh [options]

Options:
  --check         Check for updates without installing
  --force         Force update (discard local uncommitted changes)
  --dry-run       Show what would happen without executing
  -h, --help      Show this help message

Environment:
  SPS_SEO_REPO_URL  Override the GitHub repo URL
                    (default: https://github.com/SHAHID8142/sps-seo.git)
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
echo "        SPS SEO SKILL UPDATER v1.5.0         "
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
echo "Repository:      $REPO_URL"

# Detect install type
INSTALL_TYPE="copy"
GIT_DIR=""
if [ -d "$SCRIPT_DIR/.git" ]; then
  INSTALL_TYPE="git"
  GIT_DIR="$SCRIPT_DIR"
elif [ -L "$SCRIPT_DIR" ]; then
  REAL_PATH=$(readlink "$SCRIPT_DIR" 2>/dev/null || echo "$SCRIPT_DIR")
  if [ -d "$REAL_PATH/.git" ]; then
    INSTALL_TYPE="symlink-git"
    GIT_DIR="$REAL_PATH"
  else
    INSTALL_TYPE="symlink"
  fi
fi
echo "Install type:   $INSTALL_TYPE"

# Fetch latest info from GitHub
echo ""
echo "Checking for updates..."
RAW_URL="${REPO_URL%.git}"
RAW_URL="${RAW_URL/github.com/raw.githubusercontent.com}"
RAW_URL="${RAW_URL}/main/VERSION"
LATEST_RAW=$(curl -sSL -w "\n%{http_code}" "$RAW_URL" 2>/dev/null || echo "")
HTTP_CODE=$(echo "$LATEST_RAW" | tail -1)
LATEST_VERSION=$(echo "$LATEST_RAW" | head -1 | tr -d '[:space:]')

if [ "$HTTP_CODE" != "200" ] || [ -z "$LATEST_VERSION" ]; then
  echo -e "${RED}X Could not check for updates (HTTP $HTTP_CODE).${NC}"
  echo "  Repository: $REPO_URL"
  echo "  You can override with: SPS_SEO_REPO_URL=https://github.com/user/repo.git ./scripts/update.sh"
  exit 1
fi
echo "Latest version:  $LATEST_VERSION"

# Determine if update is needed (version OR commit-hash based)
NEEDS_UPDATE=false
UPDATE_REASON=""
if [ "$CURRENT_VERSION" != "$LATEST_VERSION" ]; then
  NEEDS_UPDATE=true
  UPDATE_REASON="version differs ($CURRENT_VERSION -> $LATEST_VERSION)"
fi

# For git installs, also compare commit hashes
if [ "$INSTALL_TYPE" = "git" ] || [ "$INSTALL_TYPE" = "symlink-git" ]; then
  cd "$GIT_DIR"
  LOCAL_HASH=$(git rev-parse HEAD 2>/dev/null || echo "none")
  if git fetch origin main --quiet 2>/dev/null; then
    REMOTE_HASH=$(git rev-parse origin/main 2>/dev/null || echo "none")
    if [ "$LOCAL_HASH" != "$REMOTE_HASH" ]; then
      NEEDS_UPDATE=true
      UPDATE_REASON="git history differs (local $LOCAL_HASH vs remote $REMOTE_HASH)"
    fi
  fi
fi

if ! $NEEDS_UPDATE && ! $FORCE; then
  echo -e "${GREEN}✓ Already up to date!${NC}"
  exit 0
fi

if $CHECK_ONLY; then
  if $NEEDS_UPDATE; then
    echo -e "${YELLOW}⚡ Update available: $UPDATE_REASON${NC}"
    exit 0
  else
    echo -e "${GREEN}✓ Already up to date!${NC}"
    exit 0
  fi
fi

echo ""
echo -e "${YELLOW}⚡ Update needed: $UPDATE_REASON${NC}"
echo ""

if $DRY_RUN; then
  echo "[DRY RUN] Would sync to latest (v$LATEST_VERSION)"
  if [ -n "$GIT_DIR" ]; then
    echo "[DRY RUN]  - cd $GIT_DIR && git fetch origin main"
    echo "[DRY RUN]  - git reset --hard origin/main"
  else
    echo "[DRY RUN]  - Re-clone $REPO_URL"
  fi
  exit 0
fi

case $INSTALL_TYPE in
  git|symlink-git)
    TARGET_DIR="$GIT_DIR"
    cd "$TARGET_DIR"
    echo "Updating $TARGET_DIR..."
    if ! git fetch origin main --quiet 2>&1; then
      echo -e "${RED}X git fetch failed. Check network and URL.${NC}"
      exit 1
    fi

    DIRTY_FILES=$(git status --porcelain 2>/dev/null || echo "")
    if [ -n "$DIRTY_FILES" ]; then
      echo -e "${YELLOW}⚠ Local uncommitted changes detected:${NC}"
      echo "$DIRTY_FILES" | head -10
      if $FORCE; then
        echo -e "${YELLOW}  --force: stashing local changes...${NC}"
        git stash push -u -m "sps-seo-auto-stash-$(date +%s)" 2>&1 || true
      else
        echo ""
        echo -e "${RED}X Refusing to overwrite local changes. Re-run with --force to stash them.${NC}"
        exit 1
      fi
    fi

    git checkout main 2>/dev/null || git checkout -b main origin/main 2>/dev/null || true
    OLD_HASH=$(git rev-parse HEAD 2>/dev/null || echo "none")
    git reset --hard origin/main 2>&1 | tail -1 || true
    NEW_HASH=$(git rev-parse HEAD 2>/dev/null || echo "none")
    NEW_VERSION=$(cat VERSION 2>/dev/null || echo "$LATEST_VERSION")
    echo ""
    echo -e "${GREEN}✓ Updated successfully to v$NEW_VERSION${NC}"
    echo "  Commit: $OLD_HASH -> $NEW_HASH"
    if [ "$OLD_HASH" != "none" ] && [ "$OLD_HASH" != "$NEW_HASH" ]; then
      echo ""
      echo "Recent changes:"
      git log --oneline "$OLD_HASH..$NEW_HASH" 2>/dev/null | head -15 || true
    fi
    ;;

  symlink|copy)
    echo "Reinstalling from GitHub..."
    TEMP_DIR=$(mktemp -d)
    if ! git clone --depth 1 "$REPO_URL" "$TEMP_DIR/sps-seo" 2>&1; then
      echo -e "${RED}X git clone failed. Check network and URL.${NC}"
      rm -rf "$TEMP_DIR"
      exit 1
    fi
    if [ "$INSTALL_TYPE" = "symlink" ]; then
      TARGET=$(readlink "$SCRIPT_DIR" 2>/dev/null || echo "$SCRIPT_DIR")
      rm -rf "$TARGET"
      mv "$TEMP_DIR/sps-seo" "$TARGET"
    else
      if [ -f "$SCRIPT_DIR/sps-seo-config.json" ]; then
        cp "$SCRIPT_DIR/sps-seo-config.json" "$TEMP_DIR/sps-seo/"
        echo "  Preserved sps-seo-config.json"
      fi
      rm -rf "$SCRIPT_DIR"
      mv "$TEMP_DIR/sps-seo" "$SCRIPT_DIR"
    fi
    rm -rf "$TEMP_DIR"
    NEW_VERSION=$(cat "$SCRIPT_DIR/VERSION" 2>/dev/null || echo "$LATEST_VERSION")
    echo -e "${GREEN}✓ Reinstalled successfully (v$NEW_VERSION)!${NC}"
    ;;
esac

echo ""
echo "To verify, run: node scripts/audit.mjs --version"
echo ""
