# Ranking Probability Engine — Methodology & Honest Limitations

`npm run ranking` (`scripts/ranking-intel.mjs`) evaluates target pages against **15 weighted on-page ranking signals** and outputs a 0–100 **probability score**.

## What this tool actually does

It performs **deterministic static analysis of your source files**:

1. Search-intent alignment with configured target keywords (title/H1/body)
2. Keyword prominence in title, H1, H2
3. Content depth & topical breadth (word counts, section counts)
4. E-E-A-T credibility markers (author, date, Organization/Article schema)
5. Mobile & Core-Web-Vitals readiness heuristics
6. Internal link integration
7. Structured media, lists & tables
8. Image alt coverage
9. Freshness signals (dates, lastmod)

## What this tool does NOT do (read this before quoting the number)

- **It does NOT fetch live SERPs.** No Google API, no rank tracking, no scraping.
- **It is NOT a prediction of your actual Google position.** Google uses hundreds of signals, most of which are off-page (backlinks, user behavior, brand entity strength) and unknowable to a static scanner.
- **The output is a heuristic readiness estimate** — "how well does this page *signal* relevance to crawlers and AI engines", not "you will rank #4".

### Correct framing when reporting to stakeholders

> "The page scores 72/100 on SPS SEO's 15-signal on-page readiness heuristic. That means title, structure, schema, and content-depth signals are mostly in place. This does not measure backlinks, user engagement, or live rankings — for those, use Search Console (`npm run gsc`) and a rank tracker (`npm run rank-tracker`)."

### Where real ranking data comes from

| Need | Tool | Data Source |
| :--- | :--- | :--- |
| Actual query positions & impressions | `npm run gsc` | Google Search Console API (service account JSON required) |
| Position momentum over time | `npm run rank-tracker` | GSC API or CSV export |
| Lab CWV / Lighthouse | `npm run lighthouse` / `npm run pagespeed` | PSI API (key required) or local Lighthouse |
| Field CWV (real users) | `npm run pagespeed` | CrUX History API |

## How to use the score

1. Run per template/page: `npm run ranking`
2. Anything below 50/100 means on-page signals are weak — fix before worrying about links.
3. Re-run after Phase 2 changes; the score is deterministic, so the delta is meaningful even though the absolute number is an estimate.
4. Pair with `npm run keyword`, `npm run tfidf`, and `npm run snippet` for the content side of the same analysis.
