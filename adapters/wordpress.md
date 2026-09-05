# WordPress Adapter (SPS SEO)

**Applies to:** WordPress (classic themes, block themes/FSE, WooCommerce).

---

## 1. Where SEO Lives in WordPress

| SEO Element | Location |
| :--- | :--- |
| `<title>` / meta description | SEO plugin (Yoast `WPSEO_Primary_Term`, Rank Math filters) or `pre_get_document_title` |
| JSON-LD schema | SEO plugin graph, or manual `wp_head` injection in `functions.php` / snippet plugin |
| robots.txt | Filter `robots_txt` or physical file (multisite: use filter) |
| sitemap.xml | `wp-sitemap.xml` (core) or SEO plugin sitemap |
| Redirects | Redirection plugin, or server-level `.htaccess`/nginx |
| Security headers | `.htaccess` `Header set` directives or CDN edge rules |

## 2. Recommended Injection Points

- **Theme `header.php`** (classic): add canonical/OG/JSON-LD inside `<head>` guarded by `is_front_page()` / `is_singular()`.
- **`functions.php`** (block themes): hook `wp_head` at priority 1 for schema, priority 2 for meta.
- **Child theme only** — never patch parent themes; updates wipe changes.

## 3. SPS SEO Workflow

```bash
npm run audit      # static scan sees *.php templates via adapters/universal-fallback.md
npm run sitemap    # generate reference sitemap for comparison with wp-sitemap.xml
npm run security   # check header config recipes for .htaccess
npm run fix:dry    # preview robots.txt/llms.txt scaffolding (copy to public root)
```

## 4. WooCommerce Notes (see `npm run ecom`)

- Ensure the active SEO plugin outputs `Product` schema with `offers.price`, `priceCurrency`, `availability` — verify with `npm run validate-schema`.
- Paginated shop archives (`/shop/page/2/`) must self-canonicalize — verify with `npm run ecom`.
- Out-of-stock products: keep pages indexable with `availability: OutOfStock`, never 404 them.
