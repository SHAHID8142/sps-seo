# Universal Fallback Adapter (SPS SEO)

**Applies to:** Nuxt 3, SvelteKit, Laravel Blade, Django templates, and any other web stack.

---

## 1. Nuxt 3 (Vue)
Use `useSeoMeta` and `useHead` inside `app.vue` or page components:

```vue
<script setup lang="ts">
useSeoMeta({
  title: 'Acme Cloud | High-Performance Cloud Orchestration',
  ogTitle: 'Acme Cloud | High-Performance Cloud Orchestration',
  description: 'Enterprise multi-cloud orchestration platform.',
  ogDescription: 'Enterprise multi-cloud orchestration platform.',
  ogImage: 'https://example.com/og-image.jpg',
  twitterCard: 'summary_large_image',
})

useHead({
  htmlAttrs: { lang: 'en' },
  link: [{ rel: 'canonical', href: 'https://example.com' }],
  script: [
    {
      type: 'application/ld+json',
      children: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'Acme Cloud',
        url: 'https://example.com'
      })
    }
  ]
})
</script>
```

---

## 2. SvelteKit
Use `<svelte:head>` in `src/routes/+layout.svelte` or `+page.svelte`:

```svelte
<svelte:head>
  <title>Acme Cloud | High-Performance Cloud Orchestration</title>
  <meta name="description" content="Enterprise multi-cloud orchestration platform." />
  <link rel="canonical" href="https://example.com" />
  
  <meta property="og:title" content="Acme Cloud" />
  <meta property="og:description" content="Enterprise multi-cloud orchestration platform." />
  <meta property="og:image" content="https://example.com/og-image.jpg" />
  <meta name="twitter:card" content="summary_large_image" />

  {@html `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Acme Cloud",
    "url": "https://example.com"
  })}</script>`}
</svelte:head>

<slot />
```

---

## 3. Laravel (Blade)
In `resources/views/layouts/app.blade.php`:

```blade
<head>
  <meta charset="utf-8">
  <title>@yield('title', 'Acme Cloud | High-Performance Cloud Orchestration')</title>
  <meta name="description" content="@yield('description', 'Enterprise multi-cloud orchestration platform.')">
  <link rel="canonical" href="{{ url()->current() }}">

  <meta property="og:title" content="@yield('title', 'Acme Cloud')">
  <meta property="og:description" content="@yield('description', 'Enterprise multi-cloud orchestration.')">
  <meta property="og:image" content="@yield('og_image', asset('og-image.jpg'))">
  <meta name="twitter:card" content="summary_large_image">

  @stack('schema')
</head>
```
