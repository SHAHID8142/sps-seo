# Caching, CDN & HTTP Headers Architecture

Proper caching and compression architecture ensures that returning visitors experience instantaneous 0ms page loads and minimizes origin server load.

---

## 1. Optimal `Cache-Control` Header Policies

Modern web bundlers (Vite, Next.js, Astro) embed unique content hashes into asset filenames (e.g. `main.a8b1c4.js`). This enables safe, long-term immutable caching.

### Policy 1: Hashed Static Assets (JavaScript, CSS, Fonts, Images)
```http
Cache-Control: public, max-age=31536000, immutable
```
- **Explanation:** Informs browsers and CDNs that this file will **never change**. If you deploy updated code, the hash in the filename changes, preventing stale asset bugs.

### Policy 2: Dynamic HTML Pages (SSR / Static HTML)
```http
Cache-Control: public, max-age=0, must-revalidate, s-maxage=3600, stale-while-revalidate=86400
```
- `max-age=0, must-revalidate`: The user's browser always checks for the latest version.
- `s-maxage=3600`: The CDN edge caches the HTML for 1 hour.
- `stale-while-revalidate=86400`: The CDN serves a cached copy instantly while fetching fresh HTML in the background.

---

## 2. HTTP Compression: Brotli vs. Gzip

Text assets (HTML, CSS, JavaScript, JSON-LD, SVG) must be compressed over the wire.

- **Brotli (`br`):** Modern standard. Achieves **15–25% smaller file sizes** than Gzip for web text. Supported by all modern browsers.
- **Gzip (`gzip`):** Legacy fallback for older clients.
- *Rule:* Ensure your hosting platform or CDN has Brotli compression enabled at the edge.

---

## 3. Critical Resource Hints (`preconnect` & `dns-prefetch`)

Save 100–300ms of initial connection latency for critical third-party origins:

### In `<head>`:
```html
<!-- Preconnect: Resolves DNS, establishes TCP handshake, and negotiates TLS -->
<link rel="preconnect" href="https://api.example.com" crossorigin>

<!-- DNS-Prefetch: Fallback resolving only the DNS IP address -->
<link rel="dns-prefetch" href="https://cdn.example.com">
```
*Rule:* Only preconnect to **1–2 origins** that are required for initial above-the-fold render. Overusing preconnect wastes client socket pools and hurts performance.

---

## 4. Platform Configuration Recipes

### Vercel (`vercel.json`):
```json
{
  "headers": [
    {
      "source": "/_next/static/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    },
    {
      "source": "/(fonts|images)/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

### Cloudflare Pages / Netlify (`_headers` file):
```http
# Hashed static assets
/_astro/*
  Cache-Control: public, max-age=31536000, immutable
/assets/*
  Cache-Control: public, max-age=31536000, immutable

# Security headers
/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
```

### Nginx (`nginx.conf`):
```nginx
# Enable Brotli
brotli on;
brotli_comp_level 6;
brotli_types text/plain text/css application/javascript application/json image/svg+xml;

# Static asset caching
location ~* \.(js|css|woff2|webp|avif|svg)$ {
    expires 1y;
    add_header Cache-Control "public, max-age=31536000, immutable";
    access_log off;
}
```
