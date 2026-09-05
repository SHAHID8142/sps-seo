# Next.js Pages Router Adapter (SPS SEO)

**Applies to:** Next.js projects utilizing the legacy `pages/` or `src/pages/` directory.

---

## 1. File Locations
- **Document Shell:** `pages/_document.tsx` (or `_document.js`)
- **App Shell & Global SEO:** `pages/_app.tsx` (or `_app.js`)
- **Page-Level Head:** `pages/**/*.tsx` using `next/head`
- **Sitemap & Robots:** `public/sitemap.xml` and `public/robots.txt`

---

## 2. Global Document Setup (`pages/_document.tsx`)

```tsx
import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <html lang="en">
      <Head>
        <meta charSet="utf-8" />
        <link rel="icon" href="/favicon.ico" />
        <meta name="theme-color" content="#0f172a" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </html>
  );
}
```

---

## 3. Reusable Head Component (`components/SEO.tsx`)

```tsx
import Head from 'next/head';

interface SEOProps {
  title?: string;
  description?: string;
  canonical?: string;
  ogImage?: string;
  ogType?: string;
  jsonLd?: Record<string, unknown>;
}

export function SEO({
  title = 'Acme Cloud | High-Performance Cloud Orchestration',
  description = 'Enterprise multi-cloud orchestration platform. Zero-trust networking and instant deployments.',
  canonical = 'https://example.com',
  ogImage = 'https://example.com/og-image.jpg',
  ogType = 'website',
  jsonLd,
}: SEOProps) {
  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />

      {/* OpenGraph */}
      <meta property="og:type" content={ogType} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:site_name" content="Acme Cloud" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {/* Structured Data */}
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
    </Head>
  );
}
```

---

## 4. Usage in Pages (`pages/index.tsx`)

```tsx
import { SEO } from '@/components/SEO';

export default function HomePage() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Acme Cloud',
    url: 'https://example.com',
  };

  return (
    <>
      <SEO
        title="Acme Cloud - Enterprise Infrastructure Automation"
        description="Automate your cloud infrastructure with unified policy enforcement."
        canonical="https://example.com"
        jsonLd={schema}
      />
      <main>
        <h1>Next-Gen Cloud Orchestration</h1>
      </main>
    </>
  );
}
```
