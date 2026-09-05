# Headless CMS Adapter (Sanity, Contentful, Strapi, Payload)

**Applies to:** Headless CMS + SSG/SSR frontend (Next.js, Astro, Nuxt, SvelteKit).

---

## 1. The Headless SEO Contract

In headless stacks, SEO metadata is **data** — it must round-trip:

```
CMS document field  →  API query  →  framework metadata API  →  rendered <head>
```

A missing link anywhere makes the page invisible to crawlers even though "the content exists".

## 2. Required CMS Schema Fields (per content type)

| Field | Type | Purpose |
| :--- | :--- | :--- |
| `seoTitle` | string (<= 60 chars) | `<title>` fallback: content title |
| `seoDescription` | string (140–158) | `<meta name="description">` |
| `ogImage` | image reference + alt | `og:image` (1200×630) |
| `slug` | slug (validated, unique) | canonical route |
| `noindex` | boolean | per-document index control |
| `publishedAt` / `updatedAt` | datetime | `<time>`, NewsArticle dates, sitemap lastmod |
| `author` | reference → author object (name, url, avatar) | E-E-A-T |

## 3. Framework Wiring Checklist

- **Next.js App Router:** map CMS fields into `export const metadata` / `generateMetadata()` (see `adapters/nextjs-app.md`).
- **Astro:** map to `<Layout>` props driving `<title>`, meta, and JSON-LD (see `adapters/astro.md`).
- Every collection that maps to a route needs an entry in `app/sitemap.ts` / sitemap query — audit with `npm run sitemap:validate`.
- Draft/preview content must emit `noindex` (`robots: { index: false }`).

## 4. SPS SEO Workflow

```bash
npm run audit            # scans rendered .tsx/.astro/.vue templates pulling CMS fields
npm run keyword          # keyword placement against CMS-driven copy
npm run dup              # near-duplicate detection across CMS entries (simhash+jaccard)
npm run i18n             # localized slugs/hreflang reciprocity
npm run sitemap:validate # every CMS route resolvable + lastmod correctness
npm run rss              # generate RSS from CMS content collections
```

## 5. Hard Rules

- Never concatenate user/CMS strings into JSON-LD without JSON escaping (`JSON.stringify`).
- Slugs: enforce lowercase-hyphen at the CMS level (validation regex) — URL slugs are a ranking signal.
- One CMS document = one canonical route; slug changes must trigger a 301 in the hosting platform.
