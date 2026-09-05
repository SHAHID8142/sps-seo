# Webflow Adapter (SPS SEO)

**Applies to:** Webflow Designer + CMS (sites with editable custom code).

---

## 1. Where SEO Lives in Webflow

| SEO Element | Location |
| :--- | :--- |
| Title/meta description | Page Settings → SEO Settings (per page + CMS collection templates) |
| Open Graph | Page Settings → Open Graph |
| robots.txt | Project Settings → SEO → robots.txt |
| sitemap.xml | Auto-generated (toggle in Project Settings → SEO) |
| Canonicals | Page Settings → Advanced → Canonical URL (CMS: use `{{ cf-slug }}` field) |
| Custom `<head>` code | Project Settings → Custom Code (site-wide) or Page Settings (per page) |
| Redirects | Project Settings → Publishing → 301 redirects |

## 2. Recommended Injection Points

- **Site-wide Custom Code (head):** Organization + WebSite JSON-LD, favicon/apple-touch declarations, security meta.
- **CMS Collection Template `<head>`:** Article/Product schema bound to CMS fields via `{{ }}` merge tags inside a `<script type="application/ld+json">` block.
- **Per-page custom code:** Speakable/FAQ schema for answer-engine pages.

## 3. SPS SEO Workflow

Webflow has no local codebase — export code (Paid plan) or clone via API, then:

```bash
npm run audit            # run against the exported HTML bundle
npm run validate-schema  # validate CMS-bound JSON-LD from exported pages
npm run i18n             # verify hreflang on localized (Localize/Weglot) exports
npm run ecom             # Webflow Ecommerce: Product schema + pagination checks
```

## 4. Webflow-Specific Hard Rules

- CMS collection canonicals must bind to the `slug` field, never a literal string.
- Auto-generated sitemap: keep "sitemap inclusion" toggles OFF for utility/thank-you pages.
- Slider/carousel content must remain in DOM (Webflow renders server-side — good) with real `alt` text.
