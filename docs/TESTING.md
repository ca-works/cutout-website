# Testing record

Machine: Apple M1, 16 GB, macOS 27.0.1, Node 24.22.2. Date: 4 November 2026. Production build
(`npm run build`) served by `scripts/serve.mjs` (gzip, like GitHub Pages). Nothing has been
deployed yet, so nothing below was measured on the live address.

## Automated

| Check | Command | Result |
|---|---|---|
| Release-sync rules (fail-closed downloads) | `npm run test:unit` | 14/14 pass |
| Types | `npm run check` | 0 errors, 0 warnings |
| Build gate | `npm run build` → `verify-dist` | Pass: 4 pages; exact CSP; no inline script/style/handlers; every local link, image and anchor resolves; only allow-listed https hosts; no source maps or secrets; JS 4.5 KiB + hero 10.8 KiB, CSS 11.2 KiB gzip |
| Browser tests (20 tests × project) | `npm test` | **Chromium, WebKit (Safari), iPhone 15 (WebKit), Pixel 7 (Chromium): 78 passed, 2 skipped** (mouse drag is skipped on touch profiles) |
| Firefox | `npm test --project=firefox` | **Not verified locally**: Playwright's Firefox fails to start on macOS 27 ("Could not find profile folder"), also outside the sandbox. It runs in the *Check* workflow on Ubuntu. |
| Accessibility | axe-core 4.14 (WCAG 2.0/2.1/2.2 A and AA rules) on home, guide, privacy, 404 | 0 violations in all four projects above (two real findings — horizontally scrolling `<pre>` blocks, an 8–10 px overflow from the hero canvas on phones — were fixed) |
| CSP / Trusted Types | `securitypolicyviolation` listener in every page test | 0 violations |
| Horizontal overflow | every page, every project | 0 px |
| Dependencies | `npm audit` | 0 vulnerabilities |
| Workflows | zizmor 1.32.0 offline, online, pedantic | 0 findings |
| Secrets | Gitleaks 8.30.1: `gitleaks git .` (full history), `gitleaks dir dist`, `gitleaks dir .` | no leaks found |

What the browser tests cover: clean load with no console errors; one `h1`, title, description,
canonical; download links only to the app repository's release assets (none while unreleased);
the open-source text matches the repository's real state; slider by keyboard (arrows, Shift,
Home/End and spoken values) and by pointer drag; sample tabs and backdrop radios; hero static mode
under reduced motion with a working *Show original* toggle; primary button above the fold; the
scene reaching its final step; the no-WebGL fallback; full content without JavaScript; the phone
menu opening and closing.

## Performance (Lighthouse 13.5, simulated throttling)

| Page | Device | Performance | Accessibility | Best practices | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|---|
| Home | Mobile | 96 | 100 | 100 | 100 | 2.7 s | 0 | 0 ms |
| Home | Desktop | 100 | 100 | 100 | 100 | 0.6 s | 0 | 0 ms |
| Guide | Mobile | 100 | 100 | 100 | 100 | 1.4 s | 0 | 0 ms |
| Guide | Desktop | 100 | 100 | 100 | 100 | 0.3 s | 0 | 0 ms |

Raw numbers: `reports/lighthouse/summary.json`. History: the first mobile run scored 51 (TBT
6.7 s) because a WebGL feature probe and the scene initialised at load; both now wait for the
visitor's first interaction (see `docs/ARCHITECTURE.md`). The remaining mobile LCP is the headline
waiting for the web font under simulated slow 4G.

## Visual review

Screenshots were taken with Playwright at 1440 × 900, 1280 × 720, 1366 × 768, 1024 × 768,
768 × 1024 and 390 × 844 (iPhone 15, WebKit), through the hero's scroll states and every section,
and inspected. Fixed during review: hero headline overflowing its column; download button below
the fold on short laptop screens; segmented-control styles missing in the showcase; 3D stack
labels overlapping on desktop and clipped on phones; uneven ΔE swatch labels; cramped mobile step
tabs; nav translucency over the dark section; an overstated sentence ("finished") in Downloads;
a duplicated word in the guide.

## Not verified

* Firefox (see above) and real hardware: the WebGL scene was exercised in headless Chromium and
  WebKit with software rendering only. A pass on a real iPhone, an Android phone and Safari on a
  Mac is recommended after deployment.
* Screen readers by a person (VoiceOver, TalkBack). Roles, names and values are covered by axe
  and the slider/tab tests.
* The live GitHub Pages deployment, CodeQL and Dependabot (they start after the first push).
* Link previews in iMessage/LinkedIn (need the public URL). `og.png` is 1200 × 630 and all Open
  Graph tags are present.
