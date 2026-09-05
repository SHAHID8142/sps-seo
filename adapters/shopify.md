# Shopify Adapter (SPS SEO)

**Applies to:** Shopify (Online Store 2.0, OS 2.0 themes via Oxygen/CLI).

---

## 1. Where SEO Lives in Shopify

| SEO Element | Location |
| :--- | :--- |
| Title/meta description | Theme `{{ page_title }}` / admin per-resource fields |
| JSON-LD schema | Theme sections/snippets (Liquid) — Shopify auto-emits basic Product/Store schema |
| robots.txt | `robots.txt.liquid` template (limited rules control) |
| sitemap.xml | Auto-generated `sitemap.xml` + `sitemap_products_*.xml` (not editable) |
| Canonicals | Theme `canonical_url` object |
| Redirects | Admin → Online Store → URL Redirects (301 only) |

## 2. Recommended Injection Points

- **`layout/theme.liquid`**: add Organization/WebSite JSON-LD, `og:*` fallbacks, and `<link rel="alternate" hreflang>` block inside `<head>`.
- **`sections/main-product.liquid`**: extend the Product schema with `aggregateRating`, `review`, and full `Offer` (price, availability, sku) — Shopify's default schema omits review data unless reviews app provides it.
- **`snippets/`**: create a `sps-seo-schema.liquid` snippet and render it from templates to keep schema surgical and centralized.

## 3. SPS SEO Workflow

```bash
npm run audit      # theme Liquid files scanned via universal-fallback rules
npm run ecom       # Product schema + pagination (/collections/x?page=2) checks
npm run validate-schema
npm run links      # orphan product/collection detection on exported content
```

## 4. Shopify-Specific Hard Rules

- `{{ canonical_url }}` must never be overridden with a hardcoded domain.
- Collection pagination (`?page=n`) must remain crawlable but self-canonical.
- Vendor/type tag pages: noindex thin tag archives via `robots.txt.liquid` Disallow rules.
- Blog article schema: extend with `author` (Person) for E-E-A-T.
