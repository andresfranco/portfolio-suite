# Website Performance Testing Guide

This guide explains how to verify every performance optimisation that has been applied to the
portfolio-suite stack. Run each section after pulling the latest code to confirm nothing
regressed.

---

## Table of Contents

1. [Quick summary of optimisations](#1-quick-summary-of-optimisations)
2. [Prerequisites](#2-prerequisites)
3. [Test 1 — No CDN Tailwind (index.html)](#3-test-1--no-cdn-tailwind)
4. [Test 2 — Code splitting (React lazy loading)](#4-test-2--code-splitting)
5. [Test 3 — Frontend API cache (in-memory TTL)](#5-test-3--frontend-api-cache)
6. [Test 4 — Backend Cache-Control headers](#6-test-4--backend-cache-control-headers)
7. [Test 5 — GZip compression (API responses)](#7-test-5--gzip-api-responses)
8. [Test 6 — WebP image uploads](#8-test-6--webp-image-uploads)
9. [Test 7 — Nginx gzip + static file serving](#9-test-7--nginx-gzip--static-file-serving)
10. [Test 8 — CI bundle sizes (GitHub Actions)](#10-test-8--ci-bundle-sizes)
11. [Lighthouse / PageSpeed audit](#11-lighthouse--pagespeed-audit)
12. [Regression checklist](#12-regression-checklist)

---

## 1. Quick summary of optimisations

| # | Layer | Change | Expected gain |
|---|-------|--------|---------------|
| 1 | Website HTML | Removed CDN Tailwind CSS v2 link | −1 blocking external request (~50 ms) |
| 2 | Website JS | React.lazy() for pages & CMS components | Initial bundle ~30–40% smaller |
| 3 | Website JS | In-memory 5-min cache for portfolio API calls | 0 ms on repeat navigation |
| 4 | Backend API | Cache-Control: public, max-age=300 on public endpoints | Browser caches portfolio JSON |
| 5 | Backend API | GZipMiddleware (≥1 KB responses) | JSON payloads 60–80% smaller |
| 6 | Backend uploads | Convert all raster uploads to WebP | ~30% smaller than JPEG at equal quality |
| 7 | Nginx | gzip + gzip_static; serve website build from disk | −1 proxy hop per static asset |
| 8 | CI (GitHub Actions) | NODE_OPTIONS + pre-compress .gz files; report bundle sizes | Faster CI, zero-CPU gzip serving |

---

## 2. Prerequisites

```bash
# Backend running locally
cd portfolio-backend
source venv/bin/activate
python run.py          # listens on http://localhost:8000

# Website dev server running locally
cd website
npm start              # listens on http://localhost:3001

# curl, jq, and a modern browser with DevTools
```

---

## 3. Test 1 — No CDN Tailwind

**What changed:** `website/public/index.html` — removed the blocking
`<link>` to `cdn.jsdelivr.net/npm/tailwindcss@2.2.19`.

### Verify in code

```bash
grep -n "cdn.jsdelivr.net" website/public/index.html
# Expected: no output (zero matches)
```

### Verify at runtime

1. Open the website in Chrome (`http://localhost:3001`).
2. Open DevTools → **Network** tab → filter by **Stylesheet**.
3. Confirm there is **no request** to `cdn.jsdelivr.net`.
4. Confirm styles still render correctly (dark background, Tailwind classes applied).

### Verify DNS prefetch is present

```bash
grep -n "dns-prefetch\|preconnect" website/public/index.html
# Expected: two lines referencing REACT_APP_API_URL
```

---

## 4. Test 2 — Code splitting

**What changed:** `website/src/App.js` — lazy-loads `ProjectDetailsPage`,
`ContactPage`, `ExperienceDetailsPage`, `ChatModal`, and `EditModeIndicator`.

### Build and inspect chunks

```bash
cd website
npm run build 2>&1 | tail -40
```

Look for multiple `.chunk.js` files in the build output. Before this change
only one large `main.*.js` existed. After, you should see:

```
static/js/main.HASH.chunk.js          <- app shell (smaller)
static/js/NNN.HASH.chunk.js           <- ContactPage chunk
static/js/NNN.HASH.chunk.js           <- ProjectDetailsPage chunk
...
```

### Verify in DevTools

1. Open the website, clear the cache (Shift+Reload).
2. Open **Network** tab. Note the JS files loaded on first paint.
3. Navigate to `/projects/some-id`.
4. Watch the Network tab — a **new** `.chunk.js` file is fetched on demand.
5. Navigate back and forward — the chunk is **not** re-fetched (browser cache).

---

## 5. Test 3 — Frontend API cache

**What changed:** `website/src/services/portfolioApi.js` — `getDefaultPortfolio`
and `getPortfolio` store responses in an in-memory Map with a 5-minute TTL.

### Verify cache hit in DevTools

1. Open the website.
2. Open DevTools → **Network** tab → filter by `website/default`.
3. Reload the page. Note the request to `/api/website/default`.
4. Navigate away (e.g., `/projects`) and back to `/`.
5. Confirm **no second request** is made to `/api/website/default` within 5 minutes.

### Verify cache expires

Open the browser console and run:

```js
// Access the module's internal cache (dev builds only)
// Navigate away and back after 5 minutes to confirm a fresh request fires.
```

Alternatively, set `_CACHE_TTL_MS` to `5000` temporarily, wait 5 seconds, and
navigate to confirm a new request is issued.

### Verify edit-mode invalidation

If you use edit mode (CMS), mutations should call `invalidatePortfolioCache()`.
After saving a change:

1. Open Network tab.
2. Confirm a new `/api/website/default` request fires immediately.

---

## 6. Test 4 — Backend Cache-Control headers

**What changed:** `portfolio-backend/app/api/endpoints/website.py` — three
public GET endpoints now return `Cache-Control: public, max-age=300, stale-while-revalidate=60`.

### Verify with curl

```bash
# Default portfolio
curl -si http://localhost:8000/api/website/default?language_code=en \
  | grep -i "cache-control"
# Expected:
# cache-control: public, max-age=300, stale-while-revalidate=60

# Specific portfolio (replace 1 with your portfolio ID)
curl -si "http://localhost:8000/api/website/portfolios/1/public?language_code=en" \
  | grep -i "cache-control"
# Expected: same Cache-Control header

# Experiences list
curl -si "http://localhost:8000/api/website/experiences" \
  | grep -i "cache-control"
# Expected: same Cache-Control header
```

### Verify in DevTools

1. Open the website → Network tab.
2. Click the `/api/website/default` request.
3. In the **Response Headers** panel, confirm `cache-control: public, max-age=300...`.

---

## 7. Test 5 — GZip API responses

**What changed:** `portfolio-backend/app/main.py` — `GZipMiddleware` added
with `minimum_size=1024`.

### Verify with curl

```bash
curl -si http://localhost:8000/api/website/default?language_code=en \
  -H "Accept-Encoding: gzip" \
  | grep -i "content-encoding"
# Expected:
# content-encoding: gzip
```

```bash
# Confirm actual compression ratio
original=$(curl -s http://localhost:8000/api/website/default?language_code=en | wc -c)
compressed=$(curl -s http://localhost:8000/api/website/default?language_code=en \
  -H "Accept-Encoding: gzip" --compressed | wc -c)
echo "Original: ${original} bytes  Compressed: ${compressed} bytes"
# Expect compressed to be ~20-40% of original for a large JSON payload
```

### Verify in DevTools

1. Network tab → click the `/api/website/default` request.
2. **Response Headers**: `content-encoding: gzip`.
3. Compare **Size** vs **Content** columns — Size (over wire) should be significantly smaller.

---

## 8. Test 6 — WebP image uploads

**What changed:** `portfolio-backend/app/utils/image_utils.py` — all raster
images (JPEG, PNG with or without transparency) are now saved as WebP.

### Upload a test image

1. Log in to the admin UI (`http://localhost:3000`).
2. Open any project and upload a new image (JPEG or PNG).
3. After upload, note the URL returned in the response.

### Verify the stored file is WebP

```bash
# Check the file extension in the uploads directory
ls portfolio-backend/uploads/projects/ | grep ".webp"
# Expect: at least one .webp file after the upload

# Verify content type
file portfolio-backend/uploads/projects/*.webp | head -5
# Expected: "Web/P image"
```

### Verify the image renders in the browser

1. Open the website.
2. The uploaded image should display correctly in the browser.
3. In DevTools Network tab, the image request should show `image/webp` content-type.

### Verify existing images are untouched

Images uploaded before this change retain their original JPEG/PNG format.
Only new uploads become WebP.

---

## 9. Test 7 — Nginx gzip + static file serving

> This test requires the nginx config from `deployment/nginx/nginx.conf` to be
> applied on the VPS. For local testing, you can spin up nginx manually or
> test with a local nginx install.

### Verify gzip is enabled (VPS or local nginx)

```bash
# Replace with your domain or localhost:80 if testing locally
curl -si https://amfapps.com/ -H "Accept-Encoding: gzip" \
  | grep -i "content-encoding"
# Expected: content-encoding: gzip

curl -si https://amfapps.com/static/js/main.HASH.chunk.js \
  -H "Accept-Encoding: gzip" \
  | grep -i "content-encoding"
# Expected: content-encoding: gzip
```

### Verify static files are served directly (not proxied)

```bash
# The response Server header should be "nginx" not forwarded from Node.js
curl -si https://amfapps.com/static/js/main.HASH.chunk.js \
  | grep -i "server"
# Expected: server: nginx
```

### Verify 1-year caching on hashed assets

```bash
curl -si https://amfapps.com/static/js/main.HASH.chunk.js \
  | grep -i "cache-control\|expires"
# Expected:
# cache-control: public, immutable
# expires: (1 year from now)
```

### Verify index.html is NOT cached

```bash
curl -si https://amfapps.com/ | grep -i "cache-control"
# Expected:
# cache-control: no-cache, no-store, must-revalidate
```

### Verify pre-compressed .gz files are served (gzip_static)

After a CI deployment the `build/` directory contains `.gz` siblings for each
JS/CSS/HTML file. Confirm nginx serves them:

```bash
# On the VPS
ls /opt/portfolio/portfolio-suite/website/build/static/js/*.gz | head -3
# Expected: .gz files present

curl -si https://amfapps.com/static/js/main.HASH.chunk.js \
  -H "Accept-Encoding: gzip" \
  | grep -i "content-encoding"
# Expected: content-encoding: gzip  (served from .gz file, no CPU compression)
```

---

## 10. Test 8 — CI bundle sizes

**What changed:** Both GitHub Actions workflow files now include
`NODE_OPTIONS=--max-old-space-size=4096` and a **Pre-compress** step +
**Report bundle sizes** step.

### Read build logs after a workflow run

1. Open GitHub → **Actions** → select a recent `Deploy Frontend To VPS` or
   `Deploy Full Stack To VPS` run.
2. Expand the **Build website** or **Build backend-ui** job.
3. Look for the `Report bundle sizes` step output, e.g.:

```
=== Website bundle sizes ===
1.2M  static/js/main.abc123.chunk.js
180K  static/css/main.def456.chunk.css
=== Total build size ===
3.4M  .
```

4. Look for the `Pre-compress static assets` step:

```
Pre-compressed files:
47
```

This tells you 47 `.gz` files were created alongside the originals.

### Confirm NODE_OPTIONS is set

```bash
grep "NODE_OPTIONS" .github/workflows/deploy-frontend-vps.yml
grep "NODE_OPTIONS" .github/workflows/deploy-full-stack-vps.yml
# Expected: NODE_OPTIONS: "--max-old-space-size=4096" in both files
```

---

## 11. Lighthouse / PageSpeed audit

Run a full Lighthouse audit against the production site (or a local build):

### Local audit with serve

```bash
cd website
npm run build
npx serve -s build -l 5000 &
npx lighthouse http://localhost:5000 \
  --output=html \
  --output-path=./lighthouse-report.html \
  --chrome-flags="--headless"
open lighthouse-report.html   # macOS / xdg-open on Linux
```

**Target scores after these changes:**

| Metric | Target |
|--------|--------|
| Performance | ≥ 85 |
| First Contentful Paint | < 1.5 s (on fast 3G sim) |
| Largest Contentful Paint | < 3 s |
| Total Blocking Time | < 300 ms |
| CLS | < 0.1 |

### Key Lighthouse checks

- **"Eliminate render-blocking resources"**: Should no longer flag the CDN Tailwind link.
- **"Serve images in next-gen formats"**: Should now pass for newly uploaded images (WebP).
- **"Enable text compression"**: Should pass (gzip on nginx + GZipMiddleware on API).
- **"Efficiently cache static assets"**: Should pass for hashed JS/CSS (1 year Cache-Control).
- **"Use efficient cache policy on static assets"**: index.html should be flagged only if
  you disable the `no-cache` header — that is intentional.

---

## 12. Regression checklist

Run through this after every deployment:

- [ ] Website renders without errors at `/`
- [ ] No CDN requests in the Network tab
- [ ] Navigation to `/projects/ID` loads without a white flash (Suspense fallback is minimal)
- [ ] Navigating away and back does NOT re-fetch portfolio data within 5 minutes
- [ ] New images uploaded in admin appear on the website as `.webp`
- [ ] `/api/website/default` returns `cache-control: public, max-age=300` header
- [ ] `/api/website/default` returns `content-encoding: gzip` when requested with `Accept-Encoding: gzip`
- [ ] Nginx serves `content-encoding: gzip` for JS/CSS files on the public domain
- [ ] `index.html` is served with `Cache-Control: no-cache` (not cached)
- [ ] CI build log shows `Report bundle sizes` step with reasonable file sizes
- [ ] CI build log shows `Pre-compressed files: N` where N > 0

---

*Last updated: February 2026*
