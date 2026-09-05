# Next.js App Router Adapter (SPS SEO)

**Applies to:** Next.js 13.4+, Next.js 14, 15, 16+ using the `app/` or `src/app/` directory.

---

## 1. File Locations
- **Root Metadata & Global Layout:** `app/layout.tsx` (or `src/app/layout.tsx`)
- **Page-Level Metadata:** `app/**/page.tsx` (or `src/app/**/page.tsx`)
- **Static & Dynamic Sitemaps:** `app/sitemap.ts`
- **Robots Rules:** `app/robots.ts`
- **Dynamic OpenGraph Image:** `app/opengraph-image.tsx` or `app/**/opengraph-image.tsx`

---

## 2. Root Layout Metadata Implementation

In `app/layout.tsx`:

```tsx
import type { Metadata, Viewport } from 'next';
import './globals.css';

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL('https://example.com'),
  title: {
    default: 'Acme Cloud | High-Performance Infrastructure Orchestration',
    template: '%s | Acme Cloud',
  },
  description: 'Enterprise multi-cloud orchestration platform. Zero-trust networking, instant deployments, and real-time observability.',
  keywords: ['cloud orchestration', 'kubernetes automation', 'devops platform'],
  authors: [{ name: 'Jane Doe', url: 'https://example.com/team/jane-doe' }],
  creator: 'Acme Inc.',
  publisher: 'Acme Inc.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://example.com',
    siteName: 'Acme Cloud',
    title: 'Acme Cloud | High-Performance Infrastructure Orchestration',
    description: 'Enterprise multi-cloud orchestration platform. Zero-trust networking, instant deployments, and real-time observability.',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Acme Cloud Orchestration Platform Preview',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@acmecloud',
    creator: '@janedoe',
    title: 'Acme Cloud | High-Performance Infrastructure Orchestration',
    description: 'Enterprise multi-cloud orchestration platform. Zero-trust networking, instant deployments, and real-time observability.',
    images: ['/og-image.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

---

## 3. Dynamic Page Metadata (`generateMetadata`)

For dynamic routes like `app/blog/[slug]/page.tsx`:

```tsx
import type { Metadata } from 'next';

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);

  if (!post) {
    return { title: 'Post Not Found' };
  }

  return {
    title: post.title,
    description: post.excerpt,
    alternates: {
      canonical: `/blog/${slug}`,
    },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: 'article',
      publishedTime: post.publishedAt,
      authors: [post.author.name],
      images: [
        {
          url: post.coverImage,
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
    },
  };
}
```

---

## 4. Native JSON-LD Structured Data Injection

In Next.js App Router, inject JSON-LD via an inline `<script>` tag inside `app/layout.tsx` or specific page components:

```tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Acme Cloud',
    url: 'https://example.com',
    logo: 'https://example.com/logo.png',
    sameAs: ['https://twitter.com/acmecloud', 'https://github.com/acme'],
  };

  return (
    <html lang="en">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
```

---

## 5. Next.js Native `app/sitemap.ts` & `app/robots.ts`

### `app/sitemap.ts`:
```ts
import type { MetadataRoute } from 'next';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://example.com';
  
  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
  ];
}
```

### `app/robots.ts`:
```ts
import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/private/', '/api/'],
    },
    sitemap: 'https://example.com/sitemap.xml',
  };
}
```

---

## 6. Image Alt Enforcement
When using `next/image`:
- Always provide explicit, context-rich `alt` strings.
- Never use empty string `alt=""` unless the image is purely decorative and marked with `aria-hidden="true"`.
