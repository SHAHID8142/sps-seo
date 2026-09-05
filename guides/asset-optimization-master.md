# Complete Asset Optimization Master Guide

This guide details the exact production pipelines for optimizing images, fonts, SVGs, video, and bundles to achieve sub-second load times and zero layout shifts.

---

## 1. Image Optimization Pipeline

Images account for over 60% of average web page weight. An unoptimized image pipeline is the leading cause of poor LCP and CLS scores.

### Format Selection Hierarchy
1. **AVIF (`.avif`):** Primary modern format. Provides 20–30% smaller file size than WebP with superior color depth at low bitrates.
2. **WebP (`.webp`):** Universal fallback format supported by 98%+ of browsers.
3. **SVG (`.svg`):** Exclusively for vector logos, icons, and illustrations.
4. **PNG / JPEG:** Legacy formats. Only use if transparency cannot be achieved in AVIF/WebP.

### Responsive Syntax with Modern `<picture>`
Serve modern formats with responsive viewports:

```html
<picture>
  <!-- AVIF for modern browsers -->
  <source
    type="image/avif"
    srcset="/images/hero-400.avif 400w, /images/hero-800.avif 800w, /images/hero-1200.avif 1200w"
    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 1200px"
  />
  <!-- WebP fallback -->
  <source
    type="image/webp"
    srcset="/images/hero-400.webp 400w, /images/hero-800.webp 800w, /images/hero-1200.webp 1200w"
    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 1200px"
  />
  <!-- Default fallback with explicit dimensions -->
  <img
    src="/images/hero-800.webp"
    width="1200"
    height="630"
    alt="Acme Cloud multi-cluster architecture overview"
    loading="eager"
    fetchpriority="high"
    decoding="async"
  />
</picture>
```

### The Critical Image Loading Laws
1. **The LCP Hero Image Law:**
   - **MUST** have `fetchpriority="high"`.
   - **MUST** be preloaded in `<head>`: `<link rel="preload" as="image" href="..." fetchpriority="high">`.
   - **MUST NEVER** have `loading="lazy"`.
2. **Below-the-Fold Images:**
   - **MUST** have `loading="lazy"` and `decoding="async"`.
3. **Dimension Enforcement:**
   - Always specify `width` and `height` attributes (or CSS `aspect-ratio: 16 / 9;`) to reserve DOM space and guarantee **CLS = 0.00**.

---

## 2. Web Font Optimization Pipeline

Web fonts frequently trigger FOIT (Flash of Invisible Text), FOUT (Flash of Unstyled Text), and layout shifts during swap.

### Best Practice: Self-Host Modern WOFF2 Fonts
Avoid external Google Fonts CDN links (`fonts.googleapis.com`), which introduce multiple render-blocking DNS lookups and TLS handshakes. Download and self-host `.woff2` files locally.

### Step 1: Glyph Subsetting
Default font files contain Cyrillic, Greek, mathematical symbols, and thousands of unused glyphs (150KB+). Subsetting to **Latin basic** reduces the font file size to **under 20KB**.

Using `glyphhanger` or `pyftsubset`:
```bash
pyftsubset Inter-Bold.ttf --flavor=woff2 --unicodes="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD" --output-file=inter-bold.woff2
```

### Step 2: Zero-CLS Font Metric Overrides
When the custom web font finishes loading and swaps over the fallback system font (e.g. Arial or Helvetica), small differences in glyph metrics cause the entire page layout to shift (CLS penalty).

Use CSS `@font-face` metric overrides to make the fallback font occupy the exact same physical space:

```css
/* Fallback matching Inter */
@font-face {
  font-family: 'Inter-Fallback';
  src: local('Arial');
  ascent-override: 90.49%;
  descent-override: 22.48%;
  line-gap-override: 0%;
  size-adjust: 107.4%;
}

/* Primary Web Font */
@font-face {
  font-family: 'Inter';
  src: url('/fonts/inter-latin.woff2') format('woff2');
  font-weight: 400 700;
  font-display: swap;
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC;
}

body {
  font-family: 'Inter', 'Inter-Fallback', sans-serif;
}
```

---

## 3. SVG Vector Optimization Pipeline

SVGs exported directly from Figma or Illustrator contain bloated metadata, hidden layers, and unnecessary XML namespaces.

### Clean with SVGO:
```bash
npx svgo input.svg -o output.svg --multipass
```

### Implementation Guidelines:
1. **Critical Icons & Logos:** Inline directly in HTML or use an SVG sprite sheet (`<svg><use href="/sprite.svg#logo" /></svg>`).
2. **Decorative Backgrounds:** Load as CSS background images or external `<img alt="... preview" src="...">` with `alt="" aria-hidden="true"`.
3. **Always Include `viewBox`:** Do not use hardcoded pixel widths without `viewBox="0 0 W H"`.

---

## 4. Background Video & Media Optimization

Heavy video files kill mobile battery and consume critical network bandwidth.

### Compression Pipeline (FFmpeg):
Convert raw `.mp4` files into highly compressed, web-optimized streams:

```bash
# WebM (VP9)
ffmpeg -i input.mov -c:v libvpx-vp9 -b:v 0 -crf 34 -an -threads 4 hero-bg.webm

# MP4 (H.264 baseline fallback)
ffmpeg -i input.mov -vcodec libx264 -crf 28 -an -movflags +faststart hero-bg.mp4
```

### HTML Video Declaration:
```html
<video
  autoplay
  loop
  muted
  playsinline
  preload="metadata"
  poster="/images/hero-video-poster.webp"
  width="1920"
  height="1080"
  class="bg-video"
>
  <source src="/videos/hero-bg.webm" type="video/webm">
  <source src="/videos/hero-bg.mp4" type="video/mp4">
</video>
```
- `preload="metadata"`: Browser downloads only duration and dimensions instead of buffering the whole video immediately.
- `muted playsinline`: Required for mobile autoplay compliance on iOS Safari and Chrome Android.
