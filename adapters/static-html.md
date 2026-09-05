# Static HTML Adapter (SPS SEO)

**Applies to:** Static websites, landing pages, Hugo, Jekyll, 11ty, or raw `.html` files.

---

## 1. Golden Static `<head>` Structure

Place this block inside the `<head>` section of every static HTML page:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <!-- Primary SEO -->
  <title>Acme Cloud | High-Performance Cloud Orchestration</title>
  <meta name="title" content="Acme Cloud | High-Performance Cloud Orchestration">
  <meta name="description" content="Enterprise multi-cloud orchestration platform. Zero-trust networking and instant deployments.">
  <link rel="canonical" href="https://example.com/index.html">
  <link rel="icon" href="/favicon.ico">

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://example.com/">
  <meta property="og:title" content="Acme Cloud | High-Performance Cloud Orchestration">
  <meta property="og:description" content="Enterprise multi-cloud orchestration platform. Zero-trust networking and instant deployments.">
  <meta property="og:image" content="https://example.com/og-image.jpg">

  <!-- Twitter -->
  <meta property="twitter:card" content="summary_large_image">
  <meta property="twitter:url" content="https://example.com/">
  <meta property="twitter:title" content="Acme Cloud | High-Performance Cloud Orchestration">
  <meta property="twitter:description" content="Enterprise multi-cloud orchestration platform. Zero-trust networking and instant deployments.">
  <meta property="twitter:image" content="https://example.com/og-image.jpg">

  <!-- Structured Data JSON-LD -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Acme Cloud",
    "url": "https://example.com"
  }
  </script>
</head>
<body>
  <header>
    <nav>...</nav>
  </header>
  <main>
    <h1>Autonomous Cloud Orchestration</h1>
    <!-- Content -->
  </main>
  <footer>...</footer>
</body>
</html>
```

---

## 2. Heading & Image Alt Audits
- Exactly one `<h1>` per `.html` page.
- All `<img>` tags must feature meaningful `alt="..."`.
