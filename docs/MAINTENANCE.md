# Maintenance

## Changing product claims

Every claim with a number or a capability lives in `src/data/facts.ts`, with the application
document it came from. Change it only together with new evidence in the application repository
(`docs/TESTING.md`, `docs/PERFORMANCE.md`, `README.md`). Do not add features that are planned but
not built; the site states unavailable things plainly ("Not available yet").

## Updating screenshots

1. In the application repository, run the self-test that renders them (`scripts/selftest.sh`,
   light and dark appearance) — see its `docs/TESTING.md`.
2. Copy the six files into `src/assets/screens/` with the same names:
   `{light,dark}-{1-empty,2-removed,3-advanced-tools}.png`.
3. If what they show changes, update the captions and alt text in
   `src/components/Showcase.astro`.

## Changing the demonstration images

1. Pick photographs with a licence that allows reuse (CC0, public domain, CC BY, CC BY-SA) and
   record author, licence and source in `design/sources/README.md`.
2. Run CutOut on each (`cutout-cli remove …`, see that README) and save the alpha channel as
   `<name>-matte.png`; never retouch it.
3. Add the sample to `SAMPLES` in `scripts/prepare-assets.mjs` and to `samples` in
   `src/components/Compare.astro` (caption, credit, aspect ratio and focus point classes).
4. `npm run assets && npm run build`.

The hero uses `cat`; a different hero photo needs a square image and a new traced outline (the
script does that) and a look at `CURL_R`/`LIFT_Z` in `hero-scene.ts`.

## Adding or changing a platform

1. Add the edition (id and exact asset file name) to `EDITIONS` in `scripts/lib/release.mjs`,
   with a unit test in `tests/unit/release.test.mjs`.
2. Show it in `src/components/Downloads.astro` (`others` list or a new card) and update
   `requirements`/FAQ text if the system requirements change.
3. Update `docs/RELEASING.md` (asset names) and the guide's Platforms section.

## Renaming the website repository or adding a custom domain

* Repository rename: change `SITE_BASE` and `WEBSITE_REPO` in `site.config.mjs`; nothing else.
* Custom domain (optional, costs money for the domain): verify the domain in the account's Pages
  settings first, add `public/CNAME`, set `SITE_ORIGIN` and `SITE_BASE = '/'`, add the host to
  `ALLOWED_HOSTS` in `scripts/verify-dist.mjs`.

## Regenerating the share image

`node scripts/make-og.mjs` renders `public/og.png` (1200 × 630) from the icon, the hero cutout and
the site font. Run it after changing the headline.

## Dependencies

Dependabot opens grouped weekly PRs (after a 7-day cooldown). Before merging: read the changelog,
let *Check* pass, look at the preview. Keep versions exact. See `docs/DEPENDENCIES.md`.

## Known limitations

* GitHub Pages cannot send security headers; the CSP is a `<meta>` tag (see `docs/SECURITY.md`).
* Firefox could not be launched by Playwright on the development Mac (macOS 27); Firefox runs in
  CI on Ubuntu.
* Lighthouse mobile LCP on the home page is ≈ 2.7 s under simulated slow 4G: the headline waits
  for the 40 KB web font. `font-display: optional` would trade brand consistency for that.
* The hero's WebGL scene was verified in headless Chromium and WebKit (software GL); a hands-on
  pass on real iPhone/Android hardware is still recommended.
* The interface showcase uses offscreen renders produced by the app's self-test (the development
  Mac's screen was locked); they are genuine app windows, not mock-ups.

## Future improvements

* When CutOut is signed with a Developer ID and notarized, remove the first-launch steps and the
  "not notarized" notes (`facts.ts`, Downloads, FAQ, Guide).
* Short real screen recordings of paste → remove → copy (H.264/AV1, < 2 MB, poster frame), once a
  person can record the app.
* A dark appearance for the whole site, if wanted (the current art direction is fixed light/dark
  per section).
