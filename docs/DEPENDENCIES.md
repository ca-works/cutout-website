# Dependencies and licences

All versions are exact and locked in `package-lock.json`; installation never runs package
scripts (`.npmrc`: `ignore-scripts=true`). Direct dependencies were chosen at versions published
at least two weeks before 4 November 2026. Nothing from npm runs in a visitor's browser except
the Mona Sans font files; the shipped JavaScript is this repository's own code.

| Package | Version | Licence | Publisher | Why |
|---|---|---|---|---|
| astro | 7.4.2 | MIT | Astro (withastro) | Static site generation, image optimisation (AVIF/WebP via sharp), bundling |
| @astrojs/sitemap | 3.7.4 | MIT | Astro | `sitemap-index.xml` |
| @fontsource-variable/mona-sans | 5.3.0 | SIL OFL 1.1 (font) | Fontsource; typeface by GitHub | Self-hosted typeface; licence shipped at `/licenses/MonaSans-OFL.txt` |
| @astrojs/check, typescript | 0.9.12, 6.0.3 | MIT, Apache-2.0 | Astro, Microsoft | Type checking (dev) |
| @playwright/test | 1.64.1 | Apache-2.0 | Microsoft | Browser tests, visual QA, share-image rendering (dev) |
| @axe-core/playwright | 4.14.0 | MPL-2.0 | Deque | Accessibility tests (dev) |
| lighthouse, chrome-launcher | 13.5.0, 1.2.2 | Apache-2.0 | Google | Performance measurement (dev) |

Transitive: `sharp` 0.35.5 (Apache-2.0, libvips LGPL-3.0 as a prebuilt binary, used only at build
time) comes with Astro. 701 packages in the full tree; `npm audit`: 0 vulnerabilities on
4 November 2026.

## Considered and not used

Three.js (MIT), GSAP (Standard No-Charge licence), Motion (MIT), Anime.js (MIT), Tailwind CSS
(MIT), React-based component galleries (Kokonut UI, React Bits, Cult UI, Skiper UI, Watermelon UI,
shadcn/ui). Reasons are in `docs/HANDBOOK_MATRIX.md`: in short, the site needs one shader scene
and a few interactions, which its own ~15 KiB of code covers without a framework runtime.

## Fonts and images

* Mona Sans: SIL OFL 1.1, "Mona" is a Reserved Font Name; the Fontsource subset is used unmodified.
* Photographs: see `design/sources/README.md` (CC BY-SA 4.0 and CC0).
* CutOut icon and screenshots: © ca-works, not under the MIT licence.
