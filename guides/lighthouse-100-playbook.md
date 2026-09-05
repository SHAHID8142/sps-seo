# Lighthouse 100/100 Master Engineering Playbook

This master engineering guide provides the exact architectural requirements to achieve and maintain a **perfect 100/100 score across all four Lighthouse pillars**: **Performance**, **Accessibility**, **Best Practices**, and **SEO**.

---

## 1. Lighthouse Metric Scoring Weights (Performance Pillar)

Lighthouse calculates the Performance score using a weighted average of 5 Core & Synthetic metrics:

| Metric | Lighthouse Weight | Target for 100 Score | Target for Good (Green) |
| :--- | :--- | :--- | :--- |
| **Total Blocking Time (TBT)** | **30%** | **≤ 100 ms** | ≤ 200 ms |
| **Largest Contentful Paint (LCP)** | **25%** | **≤ 1.2 s** | ≤ 2.5 s |
| **Cumulative Layout Shift (CLS)** | **25%** | **0.00** | ≤ 0.10 |
| **First Contentful Paint (FCP)** | **10%** | **≤ 0.8 s** | ≤ 1.8 s |
| **Speed Index (SI)** | **10%** | **≤ 1.3 s** | ≤ 3.4 s |

---

## 2. Performance Pillar: Diagnostics & Remedies

### Audit 1: "Eliminate Render-Blocking Resources"
- **Cause:** CSS `<link>` or JS `<script>` in `<head>` pauses DOM parsing.
- **Fix:**
  1. Add `defer` or `async` to all non-critical scripts:
     ```html
     <script src="/app.js" defer></script>
     ```
  2. For critical styles, inline the critical path CSS directly in a `<style>` tag in `<head>`, and load full stylesheets asynchronously:
     ```html
     <link rel="preload" href="/styles.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
     <noscript><link rel="stylesheet" href="/styles.css"></noscript>
     ```

### Audit 2: "Preload Largest Contentful Paint (LCP) Image"
- **Cause:** The browser discovers the hero image late in the rendering waterfall.
- **Fix:**
  1. Inject an explicit high-priority preload tag into the `<head>`:
     ```html
     <link rel="preload" as="image" href="/hero.webp" fetchpriority="high">
     ```
  2. In Next.js:
     ```tsx
     <Image src="/hero.webp" alt="Hero illustration" priority />
     ```
  3. *Never* apply `loading="lazy"` to the LCP image.

### Audit 3: "Reduce Unused JavaScript & Execution Time" (TBT Optimization)
- **Cause:** Large vendor bundles block the main thread during hydration.
- **Fix:**
  1. **Dynamic Code Splitting:** Lazy-load below-the-fold components:
     ```tsx
     // Next.js
     const HeavyModal = dynamic(() => import('@/components/Modal'), { ssr: false });
     ```
  2. **Third-Party Script Quarantine:** Offload tracking scripts to web workers via Partytown (see [third-party-scripts-strategy.md](third-party-scripts-strategy.md)).
  3. **Main Thread Slicing:** Break long tasks (>50ms) using `scheduler.yield()` or `setTimeout`.

### Audit 4: "Ensure Text Remains Visible During Webfont Load" (FOIT/FOUT)
- **Cause:** Custom fonts hide text until downloaded.
- **Fix:**
  Add `font-display: swap;` to all `@font-face` definitions:
  ```css
  @font-face {
    font-family: 'Inter';
    font-display: swap;
    src: url('/fonts/inter.woff2') format('woff2');
  }
  ```

### Audit 5: "Cumulative Layout Shift (CLS = 0.00)"
- **Cause:** Elements shifting during image loading, dynamic ad injection, or font swapping.
- **Fix:**
  1. Always declare explicit `width` and `height` attributes on `<img alt="Illustration preview">` and `<video>` tags:
     ```html
     <img src="/logo.svg" width="180" height="48" alt="Acme Logo" />
     ```
  2. Reserve container space for dynamic elements:
     ```css
     .banner-slot { min-height: 250px; contain: layout; }
     ```
  3. Match fallback font metrics with `size-adjust` and `ascent-override` (see [asset-optimization-master.md](asset-optimization-master.md)).

---

## 3. Accessibility Pillar (Target: 100/100)

### Rule 1: WCAG 2.1 AA Contrast Ratios
- **Normal Text (< 18pt / 24px):** Minimum contrast ratio of **4.5:1** against the background.
- **Large Text (≥ 18pt or bold ≥ 14pt):** Minimum contrast ratio of **3:1**.
- **UI Components & Icons:** Minimum contrast ratio of **3:1**.

### Rule 2: Discernible Names for Interactive Elements
- Every `<button>`, `<a>`, and `<input>` must have human-readable text:
  ```html
  <!-- BAD: Empty icon button -->
  <button><svg>...</svg></button>

  <!-- GOOD -->
  <button aria-label="Close modal"><svg aria-hidden="true">...</svg></button>
  ```

### Rule 3: Form Input Labeling
- Every input must be explicitly associated with a label:
  ```html
  <label for="user-email">Work Email</label>
  <input type="email" id="user-email" name="email" required />
  ```

### Rule 4: Keyboard Navigation & Focus Visible
- Never remove focus rings without providing an alternative:
  ```css
  /* PROHIBITED */
  *:focus { outline: none; }

  /* COMPLIANT */
  *:focus-visible {
    outline: 2px solid #38bdf8;
    outline-offset: 2px;
  }
  ```

### Rule 5: Viewport Scalability
- The `<meta name="viewport">` must **never** disable zooming:
  ```html
  <!-- PROHIBITED: user-scalable=no or maximum-scale=1 -->
  <!-- COMPLIANT -->
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ```

---

## 4. Best Practices Pillar (Target: 100/100)

- [ ] **HTTPS & HSTS:** Enforce HTTPS redirects with `Strict-Transport-Security` headers.
- [ ] **Content Security Policy (CSP):** Implement strict headers preventing XSS injections.
- [ ] **External Link Security:** Every `target="_blank"` must include `rel="noopener noreferrer"`.
- [ ] **Clean Console:** Zero JavaScript runtime exceptions or 404 resource errors logged on initial page load.
- [ ] **Doctype:** Document begins with exact `<!DOCTYPE html>`.
- [ ] **No Deprecated APIs:** Avoid legacy Web APIs (e.g. synchronous XHR).

---

## 5. SEO Pillar (Target: 100/100)

- [ ] `<title>` is present, unique, and between 40–60 characters.
- [ ] `<meta name="description">` is present and between 140–160 characters.
- [ ] `<link rel="canonical">` specifies the authoritative URL.
- [ ] Page returns HTTP status 200 and is crawlable in `robots.txt`.
- [ ] Document features structured Schema.org JSON-LD rich snippets.
- [ ] Tap targets are spaced appropriately (minimum 48px × 48px touch zone).
- [ ] Font sizes are legible on mobile devices (minimum 12px, recommended 16px body).

---

## 6. Verification Command

Run the SPS SEO Performance and Audit scanner to verify readiness before running Lighthouse:
```bash
npm run audit
npm run perf
```
