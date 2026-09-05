# Third-Party Script & Analytics Loading Strategy

Third-party tracking scripts (Google Tag Manager, GA4, Meta Pixel, Hotjar, Intercom, HubSpot) are the **#1 cause of poor Lighthouse performance**, often reducing a site's score from 100 down to 40 by monopolizing the main thread.

---

## 1. The Core Problem: Main Thread Starvation

When a browser encounters a typical third-party tag snippet:
1. It downloads large vendor bundles (often 200KB–1MB+).
2. It parses and executes JavaScript on the **main thread**.
3. It creates long tasks (> 50ms), causing severe **Total Blocking Time (TBT)** penalties and high **Interaction to Next Paint (INP)** latency (> 200ms).

---

## 2. Solution 1: Offload Scripts to Web Workers (Partytown)

[Partytown](https://partytown.builder.io/) executes third-party scripts inside a dedicated background Web Worker, freeing up the main thread exclusively for user interface rendering and interactions.

### Astro Integration:
```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import partytown from '@astrojs/partytown';

export default defineConfig({
  integrations: [
    partytown({
      config: {
        forward: ['dataLayer.push', 'fbq'],
      },
    }),
  ],
});
```

### Tag Markup:
Change `<script>` tags to `type="text/partytown"`:
```html
<script type="text/partytown" src="https://www.googletagmanager.com/gtag/js?id=G-XXXXX"></script>
<script type="text/partytown">
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXX');
</script>
```

---

## 3. Solution 2: Framework Native Script Strategies (Next.js)

When using Next.js, leverage the built-in `next/script` component with appropriate scheduling strategies:

```tsx
import Script from 'next/script';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}

        {/* Essential Analytics - Loads during browser idle time */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-XXXXX"
          strategy="lazyOnload"
        />

        {/* Heavy Non-Critical Widget (e.g. Chatbot / Feedback) */}
        <Script
          src="https://widget.intercom.io/widget/xxxx"
          strategy="lazyOnload"
        />
      </body>
    </html>
  );
}
```

### Strategy Hierarchy:
- **`beforeInteractive`:** Critical polyfills and bot-detection *only*. Never for analytics.
- **`afterInteractive`:** Core analytics needed immediately on page load.
- **`lazyOnload`:** Marketing pixels, heatmaps, and secondary trackers. Loads only after all page assets are downloaded and main thread is idle.
- **`worker`:** Runs via Partytown in an experimental background worker thread.

---

## 4. Solution 3: The "Facade" Pattern for Heavy Widgets

Never load 2MB chatbot or video players on initial page render. Use lightweight static "facades" that hydrate only upon user interaction.

### Example: YouTube Video Embed Facade
Instead of embedding a heavy `<iframe>` (which loads 600KB+ of scripts), render a lightweight static thumbnail with a play button. Swap in the real `<iframe>` only when clicked:

```html
<div class="video-facade" onclick="this.innerHTML='<iframe width=\'100%\' height=\'450\' src=\'https://www.youtube-nocookie.com/embed/XXXXX?autoplay=1\' frameborder=\'0\' allow=\'autoplay\' allowfullscreen></iframe>'">
  <img src="https://img.youtube.com/vi/XXXXX/maxresdefault.jpg" width="800" height="450" alt="Video tutorial thumbnail" loading="lazy" />
  <button class="play-btn" aria-label="Play video">▶</button>
</div>
```

---

## 5. Interaction-Deferred Analytics (Vanilla / SPA)

For non-Next.js projects, load tracking scripts on the first user interaction (`scroll`, `pointerdown`, or `keydown`):

```javascript
function loadAnalytics() {
  if (window.__analyticsLoaded) return;
  window.__analyticsLoaded = true;

  const script = document.createElement('script');
  script.src = 'https://www.googletagmanager.com/gtag/js?id=G-XXXXX';
  script.async = true;
  document.head.appendChild(script);

  // Remove event listeners once loaded
  ['scroll', 'pointerdown', 'keydown'].forEach(e =>
    window.removeEventListener(e, loadAnalytics)
  );
}

// Attach listener to first interaction
['scroll', 'pointerdown', 'keydown'].forEach(e =>
  window.addEventListener(e, loadAnalytics, { once: true, passive: true })
);

// Fallback idle timeout (5 seconds) if user does not interact
if ('requestIdleCallback' in window) {
  requestIdleCallback(() => setTimeout(loadAnalytics, 5000));
} else {
  setTimeout(loadAnalytics, 5000);
}
```
