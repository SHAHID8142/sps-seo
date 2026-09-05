# Claude Code Host Adapter (SPS SEO)

**Applies to:** Claude Code CLI, Claude Desktop, and Anthropic API agents.

---

## 1. Operating Rules for Claude Code

- **Skill Entrypoint:** Automatically activated via `~/.agents/skills/sps-seo/SKILL.md`.
- **Bash Tool:** Execute `node scripts/audit.mjs` directly in the project shell.
- **Compact Output:** Use `node scripts/audit.mjs --json` to parse score programmatically.
- **Surgical Edits:** Use `Edit` tool with exact target chunks. Never rewrite whole layouts.

---

## 2. Command Flow

```bash
npm run audit
npm run fix
npm run validate-schema
```
