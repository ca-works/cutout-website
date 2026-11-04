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
  components/             one file per section: Hero, Compare, Showcase, Workflow, Features,
                          Privacy, Free, Downloads, Faq, Nav, Footer, Prose
  scripts/                site.ts (nav, reveal, copy), hero.ts + hero-timeline.ts +
                          hero-scene.ts (signature scene), compare.ts, a11y.ts (tabs/radios)
  styles/global.css       design tokens and shared components
  data/                   facts.ts (every product claim + its evidence), release.json (written
                          by the sync), release.ts (typed access)
  assets/screens/         genuine app renders (from the app repository's docs/screenshots)
  assets/generated/       built by `npm run assets` (git-ignored)
design/sources/           original photos + CutOut's mattes (provenance in README)
design/brand/             the official icon files
scripts/                  prepare-assets, make-icons, make-og, sync-release (+ lib/release),
                          verify-dist, serve, lighthouse, shoot (visual QA helpers)
tests/unit, tests/e2e     node:test and Playwright
```

## Progressive enhancement

Every layer works without the one above it:

1. **HTML + CSS only** (JavaScript off): all content and links; the hero shows the finished cutout
   (`public/noscript.css`); all three comparison samples are shown at a 50 % split; FAQ uses native
   `<details>`; the phone menu is a native `popover`.
2. **JavaScript, reduced motion**: no scroll-driven scene; the hero shows the finished cutout with a
   *Show original* toggle; reveals are instant; the slider moves without springs.
3. **JavaScript, no WebGL 2**: the hero's scroll track drives a dissolve between the two real images.
4. **Full**: the WebGL 2 scene.

## The hero scene

* `hero.ts` measures the sticky track's scroll progress (native scrolling, never intercepted),
  smooths it with a ~90 ms critically damped follower, drives the step captions, and owns mode
  selection and fallbacks.
* `hero-timeline.ts` maps progress to scene parameters (cut, lift, peel, line opacity, tilt). Change
  the choreography only here.
* `hero-scene.ts` (separate chunk, 10.8 KiB gzip) renders four passes:
  1. **ground** — the transparency grid inside the image's rounded rectangle, the print's drop
     shadow outside it, the lifted subject's shadow (the subject texture's alpha sampled at a high
     mip level gives a free, correctly shaped blur), and a contact shadow along the fold;
  2. **sheet** — a 112 × 112 grid whose vertex shader wraps it around a cylinder (radius 0.042)
     moving from the bottom-right corner, then slides it away; its alpha is `1 − matte`, so the
     hole is CutOut's real cut; front = photo with Lambert shading and a specular crest, back =
     the icon's indigo → violet;
  3. **subject** — CutOut's actual cutout, lifted to z = 0.1 (above the curl's 2R = 0.084, so the
     flap passes underneath), with a faint rim light from the same key light;
  4. **cut line** — a ribbon along the outline traced from the matte (marching squares → spur
     removal → RDP → Chaikin → even 3 px resampling), drawn up to the current arc length with
     marching-ants dashes and a glowing head.
* The scene's first frame equals the poster `<img>` (the LCP element), so it is built only on the
  visitor's first scroll/pointer/key/touch, with heavy steps spread over frames. Lighthouse
  measured 0 ms total blocking time after this change (it was 5–7 s on emulated phones when the
  scene, and a throwaway WebGL probe, ran at load).
* The textures are the exact files the poster and fallback `<picture>`s chose (AVIF or WebP,
  1024 or 1536 px), so they come from cache. Device pixel ratio is capped at 2; the frame loop
  stops off-screen, when the tab is hidden and whenever nothing moves.
* WebGL context loss switches back to the dissolve.

## Before/after comparison

Two absolutely positioned `<picture>`s; the cutout layer is clipped with
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

Site JavaScript ≤ 24 KiB gzip (now 4.5), hero scene ≤ 16 KiB (10.8), CSS ≤ 30 KiB (11.2).
Images: AVIF + WebP with `srcset`, explicit dimensions, lazy below the fold, the hero poster
preloaded with high priority.
