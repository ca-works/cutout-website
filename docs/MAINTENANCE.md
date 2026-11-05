# Maintenance

## Changing product claims

Every claim with a number or a capability lives in `src/data/facts.ts`, with the application
document it came from. Change it only together with new evidence in the application repository
(`docs/TESTING.md`, `docs/PERFORMANCE.md`, `README.md`). Do not add features that are planned but
not built; the site states unavailable things plainly ("Not available yet").

## Updating the app screenshots

The two windows in *A real Mac app.* are genuine CutOut 0.1 windows that the app rendered itself,
showing the golden retriever photo. To refresh them without changing any app code:

1. In the application repository, build the app as usual (`dist/CutOut.app`).
2. Copy its `bench/all` folder somewhere temporary and replace `cat_fur.jpg` in the copy with the
   photo to show (`design/sources/golden.jpg`). The self-test removes that file's background
   with Best Quality.
3. Run the self-test in dark appearance, then restore the preference:

   ```bash
   defaults write com.ca-works.cutout appearance dark
   ```

   ```bash
   CUTOUT_SELFTEST=<out> CUTOUT_SELFTEST_BENCH=<bench copy> CUTOUT_SELFTEST_COPYCLOSE=1 dist/CutOut.app/Contents/MacOS/CutOut
   ```

   ```bash
   defaults delete com.ca-works.cutout appearance
   ```

   Check that `<out>/selftest.json` reports no failures (21/21 on 4 November 2026).
4. Back in this repository, run `node scripts/import-screens.mjs <out>`. It copies
   `05-best-removed-layers.png` → `app-removed.png` and `08-magic-eraser-tool-layers.png` →
   `app-tools.png` into `src/assets/screens/`, cropping only the empty 104 px strip at the top.
5. If what they show changes, update the alt text in `src/components/AppWindow.astro`.

## Changing the demonstration images

1. Pick photographs with a licence that allows reuse (CC0, public domain, CC BY, CC BY-SA) and
   record author, licence and source in `design/sources/README.md`.
2. Run CutOut on each (`cutout-cli remove …`, see that README) and save the alpha channel as
   `<name>-matte.png`; never retouch it.
3. Add the sample to `SAMPLES` in `scripts/prepare-assets.mjs` and to `samples` in
   `src/components/Compare.astro` (tab name, alt text, credit; optional `--panel-<id>` focus and
   zoom points). Add its credit to the Guide's `#credits` list.
4. `npm run assets && npm run build`.

**The hero** is set by `HERO` in `scripts/prepare-assets.mjs`: `id` (a file pair in
`design/sources/`), `alt`, `widths`, and `wordAt`. `wordAt` is how far down the subject's bounding
box the wordmark's centre sits. It is −0.05 for the mug, putting the centre just above the rim so
the mug covers only the lower part of the letters and the word stays readable. The script writes the photo, the cutout, the shadow, the traced outline (outer edge
plus holes) and `hero.css` (`--ar`, `--word-y`). The hero should be a non-living object with a
clear silhouette, ideally with a hole or gap, photographed on a plain background. After changing
it, run `node scripts/make-og.mjs`, check desktop and phone screenshots (`scripts/shoot-page.mjs`)
before and after the peel, and update the alt text in `src/components/Hero.astro`.

## Adding or changing a platform

1. Add the edition (id and exact asset file name) to `EDITIONS` in `scripts/lib/release.mjs`,
   with a unit test in `tests/unit/release.test.mjs`.
2. Show it in `src/components/Get.astro` (the note under the button names what isn't built) and
   update the requirements and the Guide's FAQ if the system requirements change.
3. Update `docs/RELEASING.md` (asset names) and the guide's Platforms section.

## Renaming the website repository or adding a custom domain

* Repository rename: change `SITE_BASE` and `WEBSITE_REPO` in `site.config.mjs`; nothing else.
* Custom domain (optional, costs money for the domain): verify the domain in the account's Pages
  settings first, add `public/CNAME`, set `SITE_ORIGIN` and `SITE_BASE = '/'`, add the host to
  `ALLOWED_HOSTS` in `scripts/verify-dist.mjs`.

## Regenerating the share image

`node scripts/make-og.mjs` renders `public/og.png` (1200 × 630): the black stage, the giant
wordmark, the hero cutout in front of it, the icon and the headline, in the site font. Run it after
changing the hero or the headline.

## Dependencies

Dependabot opens grouped weekly PRs (after a 7-day cooldown). Before merging: read the changelog,
let *Check* pass, look at the preview. Keep versions exact. See `docs/DEPENDENCIES.md`.

## Known limitations

* GitHub Pages cannot send security headers; the CSP is a `<meta>` tag (see `docs/SECURITY.md`).
* Firefox could not be launched by Playwright on the development Mac (macOS 27); Firefox runs in
  CI on Ubuntu.
* Lighthouse mobile performance on the home page is 94: the LCP is the hero photo (an 8 KB AVIF)
  at ≈ 3.0 s under simulated slow 4G, mostly render delay while the stylesheet and font arrive.
* The scroll scenes and the WebGL print were verified in headless Chromium and WebKit (software
  GL); a hands-on pass on real iPhone/Android hardware and Safari is still recommended.
* The app windows are offscreen renders produced by the app's self-test (the development Mac's
  screen was locked); they are genuine app windows, not mock-ups.

## Future improvements

* When CutOut is signed with a Developer ID and notarized, remove the first-launch steps and the
  "not notarized" notes (`facts.ts`, `Get.astro`, the Guide and its FAQ).
* Short real screen recordings of paste → remove → copy (H.264/AV1, < 2 MB, poster frame), once a
  person can record the app.
* A light appearance, if wanted. Version 2 is dark by design, and the tokens in `global.css` are
  the only place colours are defined.
