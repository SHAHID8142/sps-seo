# OpenCode Host Adapter (SPS SEO)

**Applies to:** OpenCode CLI (agent mode).

---

## 1. Operating Rules for OpenCode

- **Global Path:** Load skill from `~/.agents/skills/sps-seo/SKILL.md` (or repo-root `SKILL.md`).
- **Command Runner:** Execute commands using native bash tools:
  - **Interactive (default):** `npm run consult` or `sps-seo` → launches interactive SEO consultant
  - **Manual:** `npm run audit` → `npm run fix` → `npm run audit` (verify)
- **Zero Hallucination:** Never report an SEO score without running `node scripts/audit.mjs`. Reference `sps-seo-config.json` before proposing metadata changes.
- **Artifacts:** Write findings to `sps-seo-audit-report.md` (mirror to `.sps/seo-audit.md` when `./.sps/` exists).

## 2. Recommended Workflow

1. Run `npm run consult` for the interactive SEO consultant, or manually:
2. `npm run audit` → read `sps-seo-audit-report.md`.
3. Fix findings in weight order (25 pts per category).
4. `npm run audit` again → confirm deterministic improvement.
5. `npm run preview` + `npm run badge` for visual feedback and README badge.
