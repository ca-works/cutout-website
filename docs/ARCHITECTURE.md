# Architecture

## Why a separate website repository

| Option | Verdict |
|---|---|
| Pages from the application repository `ca-works/cutout` | Not possible today: the repository is private, and GitHub Pages on the Free plan needs a public repository. Making it public is the owner's decision (licence not chosen yet). Even then, mixing website workflows with the app's would widen the blast radius of a website change. |
| **Separate public repository** (chosen; same pattern as `ca-works/eng-drw`) | The website can be public now without exposing app source. Its workflows hold no app secrets. Downloads still come from the app repository's Releases, read at build time. |
| `ca-works.github.io` user site | Would occupy the account's root address for one product. |

The address is `https://ca-works.github.io/<website repository>/`. The name is set in one place,
`site.config.mjs` (`SITE_BASE`, `WEBSITE_REPO`).

## Layout

```
site.config.mjs           addresses and repository names (single source)
src/
  layouts/Base.astro      <head>: metadata, CSP, icons, Open Graph; nav + footer
  pages/                  index (home), docs (guide), privacy, 404
  components/             one file per home-page scene: Hero, Compare, Keys, AppWindow, Numbers,
                          Tools, Private, Get; shared: Nav, Footer, Prose, Split (word reveal)
  scripts/                scenes.ts (scroll scenes), site.ts (nav, reveal, magnetic, copy),
                          hero.ts + hero-gl.ts (the peeling print), compare.ts, a11y.ts
  styles/global.css       design tokens and shared components
  data/                   facts.ts (every product claim + its evidence), release.json (written
                          by the sync), release.ts (typed access)
  assets/screens/         genuine app windows rendered by the app's own self-test
  assets/generated/       built by `npm run assets` (git-ignored)
design/sources/           original photos + CutOut's mattes (provenance in README)
design/brand/             the official icon files
scripts/                  prepare-assets, make-icons, make-og, sync-release (+ lib/release),
                          verify-dist, serve, lighthouse, import-screens,
                          shoot + shoot-page (visual QA helpers)
tests/unit, tests/e2e     node:test and Playwright
```

## Progressive enhancement

Every layer works without the one above it:

1. **HTML + CSS only** (JavaScript off, `public/noscript.css`): scenes become normal sections; the
   hero shows the depth composition (photo, wordmark, cutout); all four comparison samples are
   shown at a 50 % split; the key sequence is a plain list; the phone menu is a native `popover`.
2. **JavaScript, reduced motion**: scenes collapse to their finished state; the hero shows a
   *Remove background* button that does it in one step; reveals are instant; marquees wrap.
3. **JavaScript, no WebGL 2** (`is-lite`): the same scroll choreography, with the print fading and
   blurring away in CSS instead of curling.
4. **Full** (`is-live`): the WebGL 2 print.

## Scroll scenes (`scenes.ts`)

A scene is a tall `section[data-scene]` whose `.pin` child is `position: sticky`. One
`requestAnimationFrame` loop, running only while a scene is on screen (IntersectionObserver),
reads each visible scene's rectangle, computes progress 0–1, smooths it (critically damped,
τ ≈ 80 ms) and writes `--p` plus the named ranges from `data-ranges`
(`"cut:.03-.3 lift:.27-.42"` → `--cut`, `--lift`). CSS does the rest with `calc()`. Scripts can
subscribe with `onScene(el, fn)` (the hero's WebGL, the key sequence's steps). Scrolling is never
intercepted, and with reduced motion every value is 1.

## The hero

Layers, bottom to top, all aligned to one photo frame (`.hero__stage`):

| Layer | What it is |
|---|---|
| `canvas.hero__gl` | WebGL 2, **full viewport**: the transparency grid inside the frame and the photo as a print with a hole where CutOut's matte says the subject is. The canvas is as large as the viewport so the print can be pulled right off the screen. |
| `picture.hero__poster` | The same photo as an `<img>`: the LCP element, the first frame, and the no-WebGL / reduced-motion view. |
| `img.hero__shadow` | A blurred copy of the matte, shown as the subject lifts. |
| `p.hero__word` | The giant wordmark with `mix-blend-mode: difference`: dark where it crosses the photo, light on the black stage. |
| `picture.hero__subject` | CutOut's actual cutout of the photo. It sits above the word, so the part is in front of the wordmark and the background behind it. |
| `svg.hero__line` | The cut, drawn as marching ants along the outline traced from the matte. |

The blend only reaches layers in the same stacking context, so `.hero__stage` deliberately has no
`transform`, `filter` or `opacity`.

* `hero.ts` picks the mode, adds pointer parallax (fine pointers), and loads `hero-gl.ts`
  (separate chunk, 3.6 KiB gzip) on the visitor's first scroll, wheel, pointer, key or touch,
  never during load. That keeps total blocking time at 0 ms.
* `hero-gl.ts` draws two programs. **ground** is the checker inside a rounded rectangle, with a
  contact shadow along the fold. **sheet** is a 96 × 96 grid whose vertex shader curls the corner
  back around a cylinder (radius 0.05). It then slides the whole print off the screen along the
  diagonal while it keeps curling. The front face is the photo with the subject's alpha cut out;
  the back is white paper. The camera looks straight at the frame, so the hole stays aligned with
  the DOM cutout. Each frame is a pure function of `(lift, peel)`, so scrolling back reverses it.
* The textures are the files the `<picture>`s already chose (AVIF or WebP, 960/1400/1800 px), so
  they come from cache. Device pixel ratio is capped at 1.75. Frames are drawn only when the
  state or size changes. WebGL context loss switches back to `is-lite`.
* The outline (`scripts/prepare-assets.mjs`) uses marching squares on the matte. The outer loop
  gets Ramer–Douglas–Peucker simplification (split at its far point so closed rings don't
  collapse), spur removal and two Chaikin passes. Inner holes whose contour is longer than 5 % of
  the outer one are simplified without spur removal and added as extra `M…Z` subpaths. Drawing uses an SVG mask
  with `pathLength="1"`, so `--cut` is the fraction traced.

## Before/after comparison

Two absolutely positioned `<picture>`s per sample; the cutout layer is clipped with
`clip-path: inset(0 0 0 var(--pos))`. One shared position across samples. Pointer: press to jump
(spring), drag to follow; on touch a horizontal gesture takes over while vertical scrolling still
scrolls. Keyboard: `role="slider"` handle with arrows (±2, Shift ±10), Page Up/Down, Home/End and a
spoken value. Tabs and backdrop radios follow the ARIA Authoring Practices (roving tab index).

## Release data flow

```
app repository Releases ──(build-time, read-only API)──► scripts/sync-release.mjs
   verifies SHA256SUMS.txt == GitHub digest, host, upload state ──► src/data/release.json
   ──► Astro renders download cards / hero button / FAQ text ──► verify-dist ──► Pages
```

No visitor's browser ever talks to the GitHub API.

## Performance budget (enforced by verify-dist)

Site JavaScript ≤ 24 KiB gzip (now 5.3), hero WebGL ≤ 16 KiB (3.6), CSS ≤ 30 KiB (9.8).
Images: AVIF + WebP with `srcset`, explicit dimensions, lazy below the fold (including the
comparison samples); only the hero poster is preloaded with high priority. One font file (98 KB).
