# Core Web Vitals & Technical Performance Checklist (2026 Standards)

Google heavily weights page experience signals. Slow or unstable websites suffer ranking suppression in both traditional SERPs and AI Overviews.

---

## 1. Core Web Vitals Thresholds (Good / Needs Improvement / Poor)

| Metric | Target (Good) | Needs Improvement | Poor |
| :--- | :--- | :--- | :--- |
| **LCP (Largest Contentful Paint)** | **≤ 2.5 s** | 2.5 s – 4.0 s | > 4.0 s |
| **INP (Interaction to Next Paint)** | **≤ 200 ms** | 200 ms – 500 ms | > 500 ms |
| **CLS (Cumulative Layout Shift)** | **≤ 0.1** | 0.1 – 0.25 | > 0.25 |

*Note:* **INP** officially replaced FID (First Input Delay) as a Core Web Vital. INP measures the latency of all user interactions (clicks, taps, keypresses) throughout the full page lifecycle.

---

## 2. LCP Optimization Checklist (Target: ≤ 2.5s)
- [ ] **Preload Hero Image:** If the LCP element is a hero image, add `<link rel="preload" as="image" href="..." fetchpriority="high">` or in Next.js use `<Image priority ... />`.
- [ ] **Modern Image Formats:** Serve images in WebP or AVIF formats.
- [ ] **Font Optimization:** Use `font-display: swap;` and preload key web fonts (`<link rel="preload" as="font" type="font/woff2" crossorigin>`).
- [ ] **Eliminate Render-Blocking Scripts:** Defer or mark third-party scripts with `async` / `defer`.

---

## 3. INP Optimization Checklist (Target: ≤ 200ms)
- [ ] **Break Up Long Tasks:** Ensure JavaScript tasks on the main thread execute in < 50ms chunks using `scheduler.yield()` or `setTimeout`.
- [ ] **Debounce Input Handlers:** Debounce heavy search filters or resize listeners.
- [ ] **Avoid Heavy Hydration Cascades:** In React/Next.js/Astro, minimize client-side bundle size. Use server components and Astro islands.

---

## 4. CLS Optimization Checklist (Target: ≤ 0.1)
- [ ] **Explicit Dimensions:** Always set `width` and `height` attributes on all `<img>` and `<video>` tags to reserve layout space.
- [ ] **Dynamic Content Placeholders:** Reserve minimum height (`min-height`) for banners, dynamic ads, and cookie consent modals.
- [ ] **Font Fallbacks:** Define matching font fallback metrics (`ascent-override`, `descent-override`, `size-adjust`) to avoid text layout jumping when custom fonts load.

---

## 5. Mobile & Viewport Standards
- [ ] Ensure `<meta name="viewport" content="width=device-width, initial-scale=1.0">` is present.
- [ ] Touch targets must be at least 48px × 48px with appropriate spacing.
- [ ] No horizontal scrolling on mobile viewports (360px–430px).
