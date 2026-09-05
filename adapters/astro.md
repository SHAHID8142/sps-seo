# Astro Adapter (SPS SEO)

**Applies to:** Astro 3.x, 4.x, 5.x+ projects.

---

## 1. File Locations
- **Master Layout:** `src/layouts/Layout.astro` (or `BaseLayout.astro`)
- **Pages:** `src/pages/**/*.astro`
- **Content Collections:** `src/content/config.ts` and `src/pages/blog/[...slug].astro`
- **Sitemap Integration:** `@astrojs/sitemap` in `astro.config.mjs`
- **Static Assets:** `public/robots.txt`, `public/llms.txt`, `public/og-image.jpg`

---

## 2. Idiomatic Astro Layout (`src/layouts/Layout.astro`)

```astro
---
interface Props {
  title?: string;
  description?: string;
  canonical?: string;
  image?: string;
  type?: string;
  jsonLd?: Record<string, any>;
}

const {
  title = "Acme Cloud | High-Performance Cloud Orchestration",
  description = "Enterprise multi-cloud orchestration platform. Zero-trust networking and instant deployments.",
  canonical = Astro.url.href,
  image = new URL("/og-image.jpg", Astro.site).href,
  type = "website",
  jsonLd
} = Astro.props;

const canonicalURL = canonical ? new URL(canonical, Astro.site).href : Astro.url.href;
---

<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="canonical" href={canonicalURL} />
    
    <!-- Primary Meta Tags -->
    <title>{title}</title>
    <meta name="title" content={title} />
    <meta name="description" content={description} />

    <!-- Open Graph / Facebook -->
    <meta property="og:type" content={type} />
    <meta property="og:url" content={canonicalURL} />
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:image" content={image} />

    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image" />
    <meta property="twitter:url" content={canonicalURL} />
    <meta property="twitter:title" content={title} />
    <meta property="twitter:description" content={description} />
    <meta property="twitter:image" content={image} />

    <!-- Schema.org JSON-LD -->
    {jsonLd && (
      <script type="application/ld+json" set:html={JSON.stringify(jsonLd)} />
    )}
  </head>
  <body>
    <slot />
  </body>
</html>
```

---

## 3. Page Implementation (`src/pages/index.astro`)

```astro
---
import Layout from '../layouts/Layout.astro';

const orgSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Acme Cloud",
  "url": "https://example.com",
  "logo": "https://example.com/logo.png"
};
---

<Layout
  title="Enterprise Cloud Orchestration | Acme"
  description="Automate cloud infrastructure with zero-trust networking."
  jsonLd={orgSchema}
>
  <main>
    <h1>Autonomous Cloud Orchestration</h1>
  </main>
</Layout>
```

---

## 4. Astro Sitemap Configuration (`astro.config.mjs`)

```js
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://example.com',
  integrations: [sitemap()],
});
```
