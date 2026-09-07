# Enterprise Security Best Practices Guide (SPS SEO)

Definitive reference for the checks performed by `npm run security`, `npm run secrets`, and `npm run deps`. Every finding links back to a section here.

---

## 1. HTTP Response Headers (the non-negotiables)

| Header | Recommended Value | Protects Against |
| :--- | :--- | :--- |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | SSL downgrade, cookie hijacking |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' 'nonce-{random}'; object-src 'none'; frame-ancestors 'self'; base-uri 'self'` | XSS, injection, clickjacking |
| `X-Content-Type-Options` | `nosniff` (exactly) | MIME sniffing attacks |
| `Referrer-Policy` | `strict-origin-when-cross-origin` (or `no-referrer`) | Referrer leakage |
| `X-Frame-Options` | `SAMEORIGIN` or `DENY` | Clickjacking (legacy; CSP `frame-ancestors` supersedes) |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Unwanted feature access |
| `Cross-Origin-Opener-Policy` | `same-origin` | XS-Leaks, Spectre (COOP) |
| `Cross-Origin-Embedder-Policy` | `require-corp` | Spectre (COEP) |
| `Cross-Origin-Resource-Policy` | `same-origin` | Resource inclusion attacks (CORP) |

### CSP Quality Rules (presence is not enough)
1. **Never** ship `unsafe-eval` — it defeats XSS protections entirely.
2. `unsafe-inline` only with a `nonce-{random}` (regenerated per response) or `sha256-{hash}`.
3. `script-src` must not contain `*` or bare `https:` — pin exact origins.
4. Prefer `frame-ancestors 'self'` over `X-Frame-Options` (modern browsers).
5. Start with `Content-Security-Policy-Report-Only` in staging; iterate on reports before enforcing.

### Deprecated / Remove
- `X-XSS-Protection` — ignored by all modern browsers, remove it.
- `Expect-CT` — deprecated, Certificate Transparency is now default.

### Platform recipes

**Vercel (`vercel.json`)**
```json
{
  "headers": [{
    "source": "/(.*)",
    "headers": [
      { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" },
      { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self'; object-src 'none'; frame-ancestors 'self'" },
      { "key": "X-Content-Type-Options", "value": "nosniff" },
      { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
      { "key": "Permissions-Policy", "value": "camera=(), microphone=()" },
      { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" }
    ]
  }]
}
```

**Netlify / Cloudflare Pages (`_headers` / `public/_headers`)**
```
/*
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  Content-Security-Policy: default-src 'self'; script-src 'self'; object-src 'none'; frame-ancestors 'self'
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=()
  Cross-Origin-Opener-Policy: same-origin
```

**Nginx**
```nginx
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; object-src 'none'; frame-ancestors 'self'" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=()" always;
add_header Cross-Origin-Opener-Policy "same-origin" always;
```

Verify live: `npm run security -- --url https://yoursite.com`

---

## 2. Cookies

Every `Set-Cookie` on a session-bearing cookie must have all three flags:

```
Set-Cookie: session=abc123; Secure; HttpOnly; SameSite=Lax; Path=/
```

- **Secure** — never sent over plain HTTP.
- **HttpOnly** — invisible to JavaScript (XSS cannot steal it).
- **SameSite=Lax** (or `Strict` for admin areas) — CSRF defense. Avoid `SameSite=None` unless the cookie is genuinely cross-site (then it must also be `Secure`).

The live probe in `npm run security -- --url ...` validates all three per cookie.

---

## 3. CORS

- `Access-Control-Allow-Origin: *` is acceptable **only** for public static assets — never for APIs that read data.
- **Never** combine `Access-Control-Allow-Origin: *` with `Access-Control-Allow-Credentials: true` — any website can then make credentialed requests as the user. This is a CRITICAL finding.
- Echo an origin allowlist server-side instead.

---

## 4. Secret Hygiene

1. **Never commit secrets.** Use environment variables or a secrets manager (Vault, Doppler, AWS Secrets Manager, Vercel/Netlify encrypted env).
2. **The scanner now covers:** `.env*` variants, `.npmrc` (`_authToken`), `.netrc`, `.git-credentials`, `id_rsa`/`id_ed25519`, `public/` output, HTML/JS comments, and 40+ vendor token families (AWS incl. IAM roles, Azure, GCP service accounts, Stripe, OpenAI, Anthropic, Slack, Telegram, Cloudflare, Vercel, Netlify, Firebase, Supabase, DB connection strings, PKCS#8 keys).
3. **If a secret leaks:**
   - Rotate it immediately (revocation first, cleanup second).
   - Scrub git history: `git filter-repo --replace-text <(echo 'secret==>REDACTED')` then force-push (coordinate with the team).
   - Assume it is compromised the moment it touched a remote.
4. **Test fixtures:** fake secrets in `tests/` are excluded from scanning; do not put real secrets even in fixtures.
5. **Build output** (`.next/`, `dist/`) is scanned only for source maps — never run the dev server with real secrets bound to public env vars (`NEXT_PUBLIC_*` ships to the browser by design).

Run: `npm run secrets`

---

## 5. Dependency Vulnerabilities

- `npm run deps` wraps `npm audit` (pnpm/yarn auto-detected) into the SPS scoring format and **exits non-zero on critical/high** — wire it into CI.
- Auto-fix safely: `npm audit fix` (semver-compatible). Review `npm audit fix --force` manually — major bumps break builds.
- Suppress a false positive only with a documented rationale in `package.json`:

```json
{
  "overrides": {
    "transitive-package": "1.2.4"
  }
}
```

- Schedule weekly CI runs (the included `ci-matrix.yml` already runs a weekly cron).

---

## 6. Source Maps & Debug Endpoints

- Disable source maps in production: remove `productionBrowserSourceMaps: true` from Next.js config. `.map` files in `dist/`/`build/`/`out/` are flagged.
- The live probe checks whether `/.env`, `/.git/config`, `/actuator/env`, `/debug/vars`, `/server-status`, `/phpmyadmin/` answer publicly. Anything responding with 200 is critical.
- Disable framework debug overlays in production (`NEXT_DEV_OVERLAY`, Flask `debug=True`, Spring `devtools`).

---

## 7. security.txt (RFC 9116)

Publish `public/.well-known/security.txt`:

```
Contact: mailto:security@yourdomain.com
Expires: 2027-01-01T00:00:00.000Z
Preferred-Languages: en
Canonical: https://yourdomain.com/.well-known/security.txt
```

This gives researchers a channel to report vulnerabilities instead of posting them publicly.

---

## 8. SRI (Subresource Integrity)

Every cross-origin `<script>` and `<link rel="stylesheet">` should carry:

```html
<script src="https://cdn.example.com/lib.js"
        integrity="sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC"
        crossorigin="anonymous"></script>
```

A tampered CDN response then fails to execute. Generate hashes at https://www.srihash.org or `openssl dgst -sha384 -binary file.js | openssl base64 -A`.

Self-host critical third-party scripts where possible — SRI becomes unnecessary and you remove a DNS/TLS dependency from your critical path.

---

## 9. Served-Directory Exposure

Everything in `public/` (or `static/`, `dist/`, `out/`) is web-accessible verbatim. The audit recursively flags:

- `.env*`, key material (`.pem`, `.key`, `.p12`, SSH keys)
- Database dumps (`.sql`, `.sqlite`, `.dump`, `.db`)
- Backup/editor files (`.bak`, `.swp`, `.old`)
- Service-account / credentials JSON
- Build configs and internal docs

Rule: build artifacts in, source and credentials out. Add a deployment-time check that fails if new dotfiles appear in the served directory.

---

## 10. CI Security Gate (recommended workflow)

```yaml
- run: npm run security -- --url ${{ vars.PROD_URL }}   # headers + cookies + endpoints
- run: npm run secrets                                   # secret patterns
- run: npm run deps                                      # CVE gate (fails on high+)
```

Fail the build on: any critical/high finding, any new secret pattern, any high CVE.
