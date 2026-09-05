# Windsurf (Codeium Cascade) Host Adapter (SPS SEO)

**Applies to:** Windsurf Editor — Cascade Agent (Write Mode & Chat Mode).

---

## 1. Operating Rules for Windsurf Cascade

- **Global Path:** Load skill instructions from `~/.agents/skills/sps-seo/SKILL.md` (or repo-root `SKILL.md`).
- **Cascade Directives:** Always read `sps-seo-config.json` before proposing any metadata or schema changes. Never invent audit scores — run the engine.
- **Terminal Execution:** Run commands via Cascade's command tool:
  ```bash
  npm run audit        # deterministic baseline (before edits)
  npm run fix:dry      # preview remediations before applying
  npm run fix          # apply remediations
  npm run audit        # verification score (after edits)
  ```
- **Surgical Edits:** Use Cascade's diff-based editing. Never rewrite whole layout files; patch only the missing `<title>`, `alt`, or JSON-LD blocks.
- **Memory Protocol:** Write audit findings to `sps-seo-audit-report.md` (and mirror to `.sps/seo-audit.md` when `./.sps/` exists).
- **Cascade Memories:** Store brand/keyword/domain facts from `sps-seo-config.json` as a Cascade Memory so future sessions stay zero-hallucination.

## 2. Recommended Cascade Workflow

1. **Baseline:** `npm run audit` → read `sps-seo-audit-report.md`.
2. **Plan:** If score < 90, list findings and propose fixes ordered by category weight (25 pts each).
3. **Remediate:** `npm run fix:dry` → review → `npm run fix`.
4. **Verify:** `npm run audit` → confirm score improvement; never claim success without the deterministic score.
5. **Extras:** `npm run preview` (SERP/social preview), `npm run badge` (README badge), `npm run ping-indexnow` (post-deploy indexing).

