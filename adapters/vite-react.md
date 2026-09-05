# Vite & React SPA Adapter (SPS SEO)

**Applies to:** React SPAs built with Vite, Create React App, or client-side routers.

---

## 1. Dual Strategy for SPAs
SPAs render on the client, which can delay crawler interpretation if JavaScript execution fails or times out.
The SPS SEO strategy for Vite / React SPAs is:
1. **HTML Template Fallback:** Inject solid static fallback tags into root `index.html` so pre-render scrapers (crawlers that don't run JS) see valid metadata immediately.
2. **Dynamic Client Route Management:** Use `react-helmet-async` for route-level title, meta, canonical, and JSON-LD updates.

---

## 2. Root `index.html` Template

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Acme Cloud | High-Performance Cloud Orchestration</title>
    <meta name="description" content="Enterprise multi-cloud orchestration platform. Zero-trust networking and instant deployments." />
    <link rel="canonical" href="https://example.com" />

    <!-- Open Graph -->
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://example.com" />
    <meta property="og:title" content="Acme Cloud | High-Performance Cloud Orchestration" />
    <meta property="og:description" content="Enterprise multi-cloud orchestration platform." />
    <meta property="og:image" content="https://example.com/og-image.jpg" />

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Acme Cloud | High-Performance Cloud Orchestration" />
    <meta name="twitter:description" content="Enterprise multi-cloud orchestration platform." />
    <meta name="twitter:image" content="https://example.com/og-image.jpg" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

---

## 3. Dynamic Helmet Provider (`src/components/SEO.tsx`)

```tsx
import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title?: string;
  description?: string;
  canonical?: string;
  ogImage?: string;
  schema?: Record<string, unknown>;
}

export function SEO({
  title = 'Acme Cloud',
  description = 'Enterprise multi-cloud orchestration platform.',
  canonical = 'https://example.com',
  ogImage = 'https://example.com/og-image.jpg',
  schema,
}: SEOProps) {
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />

      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={ogImage} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {schema && (
        <script type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      )}
    </Helmet>
  );
}
```
