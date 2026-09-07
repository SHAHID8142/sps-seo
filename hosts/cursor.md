# Cursor Host Adapter for SPS SEO Engine

**Applies to:** Cursor IDE (Agent, Composer, and Chat modes).

---

## 1. Operating Rules for Cursor

- **`.cursorrules` Mirroring:** Mirror `SYSTEM-PROMPT.md` core directives into `.cursorrules` or `.cursor/rules/seo.mdc`.
- **Terminal Execution:** Run commands directly in Cursor terminal:
  ```bash
  npm run consult    # Interactive SEO consultant (default)
  npm run audit
  npm run fix
  npm run preview
  ```
- **File References:** Reference `@sps-seo-config.json` and `@sps-seo-audit-report.md` in Composer for zero-hallucination context.

## Interactive Consultant Mode

Running `npm run consult` or `sps-seo` launches the interactive SEO consultant. It runs a silent audit, then asks numbered questions about your project goals, keywords, audience, and competitors. After collecting all context, it presents a unified action plan and **waits for your confirmation** before applying changes.

Just reply with numbers (1, 2, 3, etc.) at each prompt.
