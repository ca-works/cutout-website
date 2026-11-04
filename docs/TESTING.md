# Testing record

Machine: Apple M1, 16 GB, macOS 27.0.1, Node 24.22.2. Date: 4 November 2026 (version 2 design).
Production build (`npm run build`) served by `scripts/serve.mjs` (gzip, like GitHub Pages).
Nothing has been deployed yet, so nothing below was measured on the live address.

## Automated

| Check | Command | Result |
|---|---|---|
| Release-sync rules (fail-closed downloads) | `npm run test:unit` | 14/14 pass |
| Types | `npm run check` | 0 errors, 0 warnings |
| Build gate | `npm run build` → `verify-dist` | Pass: 4 pages; exact CSP; no inline script/style/handlers; every local link, image and anchor resolves; only allow-listed https hosts; no source maps or secrets; JS 5.3 KiB + hero WebGL 3.6 KiB, CSS 9.8 KiB gzip |
| Browser tests (22 tests × project) | `npm test` | **Chromium, WebKit (Safari), iPhone 15 (WebKit), Pixel 7 (Chromium): 86 passed, 2 skipped** (mouse drag is skipped on touch profiles) |
| Firefox | `npm test --project=firefox` | **Not verified locally**: Playwright's Firefox fails to start on macOS 27 ("Could not find profile folder"), also outside the sandbox. It runs in the *Check* workflow on Ubuntu. |
| Accessibility | axe-core 4.14 (WCAG 2.0/2.1/2.2 A and AA rules) on home, guide, privacy, 404 | 0 violations in all four projects above |
| CSP / Trusted Types | `securitypolicyviolation` listener in every page test | 0 violations |
| Horizontal overflow | every page, every project, plus screenshot runs | 0 px |
| Dependencies | `npm audit` (npm 11.19.1) | 0 vulnerabilities |
| Workflows | zizmor 1.32.0 offline, online, pedantic | 0 findings (workflows unchanged in version 2) |
| Secrets | Gitleaks 8.30.1: `gitleaks git .` (full history), `gitleaks dir dist`, `gitleaks dir .` | no leaks found |

What the browser tests cover:

* **Every page:** a clean load with no console errors; one `h1`, a title, a description and a
  canonical URL.
* **Downloads and source:** download links go only to the app repository's release assets (none
  while it is unreleased). The source-code text matches the repository's real state, and nothing
  links to the private app repository.
* **Before/after slider:** keyboard (arrows, Shift, Home/End, spoken values), pointer drag,
  sample tabs and backdrop radios.
* **Hero:** the wordmark sits between the photo and the cutout in the DOM, and the primary button
  is fully inside the first viewport. Under reduced motion the static mode's *Remove background*
  button works. Scrolling through the scene drives `--cut`, `--lift` and `--peel` past 0.95, and
  the no-WebGL fallback works.
* **Key sequence:** it steps through paste, remove and copy.
* **Fallbacks:** all content, the depth composition and all four samples appear without
  JavaScript. The phone menu opens, navigates and closes.

## Performance (Lighthouse 13.5, simulated throttling)

| Page | Device | Performance | Accessibility | Best practices | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|---|
| Home | Mobile | 91 | 100 | 100 | 100 | 3.3 s | 0 | 0 ms |
| Home | Desktop | 100 | 100 | 100 | 100 | 0.7 s | 0 | 0 ms |
| Guide | Mobile | 100 | 100 | 100 | 100 | 1.7 s | 0 | 0 ms |
| Guide | Desktop | 100 | 100 | 100 | 100 | 0.4 s | 0 | 0 ms |

Raw numbers are in `reports/lighthouse/summary.json`. Runs vary by a few points: one desktop run
of the Guide scored 90 from a speed-index outlier, and the next run was 100.

The home page's mobile LCP element is the hero photo (55 KB AVIF at 960 px) under simulated slow
4G. Version 1 scored 96 with a 2.7 s LCP from a text headline. Version 2's first impression is
the photograph, so the image is the LCP. Two changes moved the score from 88 to 91:

* The comparison samples became lazy-loaded.
* The hero cutout lost its high fetch priority, so it no longer competes with the poster.

The page transfers about 680 KiB on a phone, almost all of it images.

## Visual review

Screenshots were taken with Playwright at 1440 × 900 (Chromium) and 390 × 844 (iPhone, 3×). Each
scroll scene was shot at 5 %, 50 % and 95 %, plus every other section, and every shot was
inspected. Fixed during the version 2 review:

* **Hero rendering:**
  * Horizontal stripes over the print. The shadow texture had been built from a multi-channel
    blur buffer; it is now a single extracted channel, with an assertion.
  * A translucent print mid-peel. The canvas now covers the viewport, and the print is pulled off
    screen.
  * The wordmark hidden behind the round crankset. Its height is now set from the part's top edge
    (`wordAt`).
  * The phone crop hiding the wordmark. Phones now keep the part's own shape.
* **Cut line:** the traced outline collapsed on closed loops, and the crankset's holes were
  erased by spur removal. Both are fixed in `prepare-assets.mjs`.
* **Controls:**
  * The *Remove background* button appeared in motion mode, because `.btn`'s `display` overrode
    `hidden`. A global `[hidden]` rule fixes it.
  * The dimmed words in the key sequence were below 3:1 contrast. They now use 40 % opacity
    (3.5:1), and Lighthouse accessibility is back to 100.
* **Scripts:** a temporal-dead-zone error in `hero-gl.ts` on resize.

## Not verified

* Firefox (see above) and real hardware. The WebGL print was exercised only in headless Chromium
  and WebKit with software rendering. A pass on a real iPhone, an Android phone and Safari on a
  Mac is recommended after deployment, especially for the scroll scenes' feel.
* Screen readers used by a person (VoiceOver, TalkBack). Roles, names and values are covered by
  axe and the slider and tab tests.
* The live GitHub Pages deployment, CodeQL and Dependabot, which start after the first push.
* Link previews in iMessage and LinkedIn, which need the public URL. `og.png` (1200 × 630, the
  wordmark with the crankset cutout) and all Open Graph tags are present.
