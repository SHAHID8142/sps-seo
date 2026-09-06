# Antigravity / Gemini Host Adapter (SPS SEO)

**Applies to:** Google Antigravity IDE and Gemini-based agents.

---

## 1. Operating Rules for Antigravity

- **Tooling First:** Use `run_command` to execute `npm run consult` (interactive) or `npm run audit` (manual). Never guess audit scores.
- **Artifact Protocol:** Always write audit findings to `sps-seo-audit-report.md` (and `.sps/seo-audit.md` if `./.sps/` exists).
- **Planning Mode:** For major SEO restructuring (converting pages from client-side to SSR, injecting schema suites), write `implementation_plan.md` before editing files.
- **Visual Feedback:** Direct the user to view `public/seo-preview.html` via `view_file` or browser preview.

---

## 2. Recommended Antigravity Command Sequence

```bash
# Phase 1: Baseline
node scripts/audit.mjs --json
node scripts/internal-links.mjs

# Phase 2: Execution
node scripts/fix.mjs --apply
node scripts/validate-schema.mjs
node scripts/generate-og.mjs

# Phase 3: External
node scripts/ping-indexnow.mjs
```
