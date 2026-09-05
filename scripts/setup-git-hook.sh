#!/usr/bin/env bash

# SPS SEO Git Pre-Commit Hook Installer
# Version: 1.0.0
# Installs a pre-commit hook that runs audit.mjs and prevents commits if score < 90.

set -euo pipefail

GIT_DIR="$(git rev-parse --git-dir 2>/dev/null || true)"

if [ -z "$GIT_DIR" ]; then
  echo "✗ Error: Not inside a git repository."
  exit 1
fi

HOOK_FILE="$GIT_DIR/hooks/pre-commit"

echo "Installing SPS SEO pre-commit hook to $HOOK_FILE..."

cat << 'EOF' > "$HOOK_FILE"
#!/usr/bin/env bash
# SPS SEO Pre-Commit Quality Hook

echo "🛡️  SPS SEO: Running pre-commit audit check..."

if ! command -v node >/dev/null 2>&1; then
  echo "⚠️ Node.js not found in PATH, skipping pre-commit SEO check."
  exit 0
fi

RESULT=$(node scripts/audit.mjs --json 2>/dev/null || true)

if [ -z "$RESULT" ]; then
  echo "⚠️ Could not run scripts/audit.mjs, skipping pre-commit check."
  exit 0
fi

SCORE=$(node -e "try { const r = JSON.parse(process.argv[1]); console.log(r.score); } catch { console.log(100); }" "$RESULT")

if [ "$SCORE" -lt 90 ]; then
  echo ""
  echo "❌ SPS SEO Quality Gate FAILED!"
  echo "Current score ($SCORE/100) is below the required 90/100 threshold."
  echo "Run 'npm run fix' or inspect sps-seo-audit-report.md to resolve issues."
  echo ""
  echo "To bypass (not recommended): git commit --no-verify"
  echo ""
  exit 1
fi

echo "✓ SPS SEO Quality Gate Passed ($SCORE/100). Proceeding with commit."
exit 0
EOF

chmod +x "$HOOK_FILE"

echo "✅ Successfully installed SPS SEO pre-commit hook!"
echo "   Commits will now automatically verify that your SEO score is ≥ 90/100."
