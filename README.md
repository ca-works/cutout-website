<p align="center"><img src="design/brand/icon-512.png" width="96" alt="CutOut icon"></p>

# CutOut website

The website for **CutOut**, the free, offline background-removal and image editor for Mac.
A static [Astro](https://astro.build/) site on a black, cinematic stage, hosted free on GitHub
Pages. In the opening scene a machined crankset sits in front of a giant **CutOut** wordmark
while its background sits behind it. As you scroll, marching ants trace CutOut's own matte, the
part lifts, and the photo peels off the screen like a print (raw WebGL 2, 3.6 KiB). After that
come real before/after results (a golden retriever puppy, threaded bolts, the crankset, a
dandelion), a pinned *Paste. Remove. Copy.* sequence and genuine app windows. Every image is
CutOut's unretouched output.

* Live address (after the first deployment): `https://ca-works.github.io/cutout-website/`
* Application repository: `ca-works/cutout` (downloads come only from its GitHub Releases)

## Quick start

Requires Node 24 (`.nvmrc`).

```bash
npm ci
```

```bash
npm run assets
```

```bash
npm run build
```

```bash
npm run preview
```

Open `http://127.0.0.1:4321/cutout-website/`. `npm run dev` gives a live-reloading dev server
(without the Content-Security-Policy, which is production-only).

| Command | What it does |
|---|---|
| `npm run assets` | Rebuilds demo images, hero textures, the traced outline and favicons from `design/` |
| `node scripts/import-screens.mjs <dir>` | Imports app windows from a CutOut self-test run (see MAINTENANCE) |
| `npm run sync` | Reads the app repository's public release state into `src/data/release.json` |
| `npm run check` | Astro/TypeScript type check |
| `npm run build` | Builds `dist/` and runs `scripts/verify-dist.mjs` (CSP, links, hosts, budgets, secrets) |
| `npm run test:unit` | Release-sync rules (fail-closed download verification) |
| `npm test` | Playwright: Chromium, Firefox, WebKit, iPhone and Android profiles, axe accessibility |
| `npm run lighthouse` | Lighthouse mobile + desktop against the local build (`npm run preview` first) |

## Documentation

| Document | Contents |
|---|---|
| [docs/DESIGN.md](docs/DESIGN.md) | Creative directions, the scene-by-scene page, the design system |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Structure, scroll scenes, the hero layers, progressive enhancement, performance |
| [docs/SECURITY.md](docs/SECURITY.md) | Threat model, controls, GitHub Pages limits, audit record, owner actions |
| [docs/RELEASING.md](docs/RELEASING.md) | Deploying the site; publishing app releases so downloads appear |
| [docs/MAINTENANCE.md](docs/MAINTENANCE.md) | Updating copy, screenshots, demo images, platforms; known limitations |
| [docs/DEPENDENCIES.md](docs/DEPENDENCIES.md) | Every dependency, its licence and why it is here |
| [docs/TESTING.md](docs/TESTING.md) | What was tested, with results |
| [docs/UX_AUDIT.md](docs/UX_AUDIT.md) | The handbook's 20-point UI/UX audit |
| [docs/HANDBOOK_MATRIX.md](docs/HANDBOOK_MATRIX.md) | How the AI Development Reference Handbook shaped the work |

## Licence

Website source: MIT (see [LICENSE](LICENSE)). The CutOut name, icon and screenshots are not
covered; photographs keep their own licences ([design/sources/README.md](design/sources/README.md)).
