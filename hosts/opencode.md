# OpenCode Host Adapter (SPS SEO)

**Applies to:** OpenCode CLI (agent mode).

---

## 1. Operating Rules for OpenCode

- **Global Path:** Load skill from `~/.agents/skills/sps-seo/SKILL.md` (or repo-root `SKILL.md`).
- **Command Runner:** Execute commands using native bash tools:
  ```bash
  npm run audit      # deterministic baseline
  npm run fix        # remediate
  npm run audit      # verify score improved
  ```
- **Zero Hallucination:** Never report an SEO score without running `node scripts/audit.mjs`. Reference `sps-seo-config.json` before proposing metadata changes.
- **Artifacts:** Write findings to `sps-seo-audit-report.md` (mirror to `.sps/seo-audit.md` when `./.sps/` exists).

## 2. Recommended Workflow

1. `npm run audit` → read `sps-seo-audit-report.md`.
2. Fix findings in weight order (25 pts per category).
3. `npm run audit` again → confirm deterministic improvement.
4. `npm run preview` + `npm run badge` for visual feedback and README badge.
