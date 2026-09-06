# Claude Code Host Adapter (SPS SEO)

**Applies to:** Claude Code CLI, Claude Desktop, and Anthropic API agents.

---

## 1. Operating Rules for Claude Code

- **Skill Entrypoint:** Automatically activated via `~/.agents/skills/sps-seo/SKILL.md`.
- **Bash Tool:** Execute `node scripts/audit.mjs` directly in the project shell.
- **Compact Output:** Use `node scripts/audit.mjs --json` to parse score programmatically.
- **Surgical Edits:** Use `Edit` tool with exact target chunks. Never rewrite whole layouts.

---

---
## 2. Interactive Consultant Mode (Default Behavior)

When you run `sps-seo` with no arguments, or `npm run consult`, the skill launches **interactive consultant mode**. This replaces blind auto-fix behavior with a structured conversation:

- Runs a silent audit first
- Asks numbered questions (reply with 1, 2, 3, etc.)
- Presents findings in plain English
- Builds a unified action plan
- **Waits for your confirmation** before applying any changes

Example:
\`\`\`
sps-seo
\`\`\`

The consultant asks about your project type, SEO goals, target keywords, geographic scope, audience, content preferences, competitors, AI search preferences, and performance priorities. Finally, you choose to run all actions, select specific ones, preview changes, or exit.

---
## 3. Command Flow (Manual Mode)
npm run validate-schema
```
