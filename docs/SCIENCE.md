# The Science Behind CutOut (`/science/`)

An interactive explanation of the mathematics, the neural network and the image processing behind
CutOut. This file records how the page was designed, where every technical claim comes from, how
it was tested, and what it does not claim.

## Brief

Make a visitor fascinated by what it takes to remove a background, without ever showing them
anything CutOut does not actually do. Three readers at once: a casual visitor (pictures and
interactions), an engineer (the actual computational steps) and a researcher (equations,
references, measured limits).

## Directions explored

| | A. One specimen, seven magnifications (chosen) | B. Lab notebook | C. The machine |
|---|---|---|---|
| Idea | One photograph (the golden retriever that leads the home page's results) is examined at ever smaller scales: the whole picture, a pixel, 1/255 of a pixel, the network's 32 × 32 grid, a hair, a 3 × 3 matrix, 16 bits. Each chapter says its scale. | An editorial, Tufte-style page: narrow text column, figures and equations in the margins, numbered notes. | The pipeline as a horizontal conveyor you scroll sideways through, one station per stage. |
| Clarity | High: one subject throughout, so differences come from the science, not from changing photos. | Very high for readers, low for skimmers. | High for the pipeline, weak for maths and editing. |
| Cohesion with the site | Black stage, huge type, one subject at a time, pinned scroll scene: the site's own grammar. | Close to the rejected v1 "paper and ink". | Sideways scrolling hijacks the wheel, which the site's motion rules forbid. |
| Truthfulness | Every picture can be real CutOut output for that one photo. | Same. | Tempts invented intermediate stages. |
| Phones, accessibility | Chapters stack; every demo has a static fallback. | Margins collapse awkwardly. | Horizontal scroll is poor on touch and with keyboards. |

**Decision: A**, with B's best idea (depth in the margins) turned into the three levels below.

## Three levels

* **Visual**: chapter headers, the interactive figures and their one-line captions. A visitor can
  scroll through and understand everything without reading an equation.
* **Technical**: closed `<details>` panels labelled *Technical*: what CutOut's code does exactly,
  with parameters.
* **Mathematical**: closed panels labelled *Mathematics* with the formulas. The few equations
  every reader needs (pixels, the compositing equation, the transform matrix, the brush) are
  shown openly.

## Three kinds of statement

Every claim is tagged with a small chip, so the three are never confused:

| Chip | Meaning | Evidence |
|---|---|---|
| **In CutOut** (violet) | What CutOut 0.1's code does, or a measurement of it | Published engine source (ca-works/cutout-app `54db95b`), or a measurement with machine, date and settings |
| **In the paper** (amber) | How the cited authors describe their method | The cited paper or model card |
| **Concept** (hollow) | General background | Textbook material, cited where useful |

## Storyboard

| # | Chapter | Learning objective | Visual / interaction | Key equation | Source | Technique |
|---|---|---|---|---|---|---|
| 0 | The invisible boundary | A cutout is a pipeline of concrete steps | Pinned scroll scene: photo → 1024² network input → raw prediction → refined matte (changed pixels in violet) → cutout → composite. Six stage buttons; reduced motion = buttons only | — | Real engine output, 8 Nov 2026 | CSS layers + `scenes.ts` progress |
| 1 | A photograph is a table of numbers | Pixels, channels, indexing, tensors | Pixel microscope (zoom, select, R/G/B on/off, block-average resolution); stacked R/G/B planes of the real network input | (1) I(x,y), (2) normalisation, (3) tent resampling, (4) flattening | Engine pre-processing; HF model card for the constants | Canvas 2D, nearest-neighbour |
| 2 | Transparency is a fourth number | Binary mask vs matte; C = αF + (1−α)B; straight vs premultiplied | Alpha lab: real matte recomposited live; opacity, background, binary/soft/α view, drag the subject across two colours; numbers for one pixel | (5)–(8) incl. the exact `mul255` identity | Porter & Duff; engine compositor | Canvas 2D |
| 3 | Inside the network | What BiRefNet is and how it is organised; what CutOut adds | Original U-shaped diagram (9 blocks, plain/technical); stride grid over the input (labelled concept); the four post-processing steps | (9) loss, (10) attention, (11) deformable conv, (12) Catmull–Rom, (13) colour guided filter, (14) uncertain band | BiRefNet paper, Swin, DCNv2, He et al., Keys; engine post-processing | HTML buttons on a CSS grid + SVG wires |
| 4 | Why hair, fur and glass are hard | Edges are sub-pixel; the inverse problem is ill-posed; real failures | Edge lab: 5 samples × 8 views (photo, matte, cutout, on colour, binary, raw, truth, error), 360 × 360 full-resolution crops; measured IoU / errors | (15) 3 knowns vs 7 unknowns; (16)–(17) blur-fusion | Smith & Blinn; Forte; CutOut benchmark | Canvas 2D |
| 5 | Editing is arithmetic too | Non-destructive transforms, brushes, perceptual selection, Refine Edges | Transform playground with live matrix and layer restacking; eraser/restore ported from the engine with falloff plot; Magic Wand (CIEDE2000) on the mug; 1-D Refine Edges on a real matte column | (18) M = T R S T, (19) dab falloff, (20) erase/restore, (21) ΔE₀₀, (22) refine operators | Engine geometry, brush, selection, colour and refine code; Sharma et al. | SVG + Canvas 2D |
| 6 | One network, three engines | Where the model runs, FP16 vs FP32, measured speed and memory | Routing diagram (macOS / Windows, fallbacks); FP32/FP16 bit explorer; model-size bars; small-multiple benchmark charts with a table view | (23) float format, (24) rounding bound | Engine AI module, app docs, measurements, IEEE 754, vendor docs | SVG rendered at build time |
| — | How we know | Provenance | Chip legend, 18 numbered references | — | — | Static |

## Technology choices

* **No new runtime dependencies.** The demos are ≈ 13 KiB (gzip) of this repository's own
  TypeScript, split per chapter and loaded only as each figure approaches the viewport.
  `verify-dist.mjs` enforces a separate 40 KiB budget for them; the rest of the site keeps its
  24 KiB.
* **KaTeX 0.19.1 at build time only** (MIT, KaTeX organisation; published 23 Oct 2026; no install
  scripts; reviewed). It renders every equation to **MathML**, not KaTeX's HTML+CSS output,
  because the HTML output relies on inline `style` attributes that the site's CSP forbids. The
  component fails the build if a style attribute ever appears. Browsers lay MathML out natively
  with the system math font (STIX Two Math on Apple systems, Cambria Math on Windows), and screen
  readers read it as mathematics. Nothing from KaTeX ships to visitors. A bundled math webfont
  (STIX Two Math, 396 KB) was evaluated and rejected for weight.
* **Colour-coded variables** use KaTeX `\textcolor` placeholders that are swapped for classes at
  build time (`.v-f`, `.v-b`, `.v-a` …), so colours come from CSS tokens.
* **Not used, and why:** Three.js / React Three Fiber (nothing here is three-dimensional, so 3D
  would add spectacle, not understanding); D3 (the charts are static and small, so build-time SVG
  needs no runtime); Motion, Anime.js, GSAP (scroll progress already comes from `scenes.ts`, and
  every other transition is CSS); React component galleries (no React on the site). Anatomy (the
  handbook's interactive-diagram skill) informed the diagram approach: original SVG/HTML, every
  number checked. No third-party skill was installed.
* **Interactions are ports, not imitations.** `src/scripts/science/sci-lib.ts` reimplements the
  engine's `mul255`, premultiply/unpremultiply, source-over, sRGB→CIELAB, CIEDE2000, Magic Wand
  threshold and flood fill, brush falloff, erase/restore, layer matrix and Refine Edges operators
  line by line. `tests/unit/science.test.mjs` checks them numerically.

## Source map (claim → evidence)

Engine files are in the public application repository,
[ca-works/cutout-app at commit `54db95b`](https://github.com/ca-works/cutout-app/tree/54db95bc09958373abf44aa66071371c2244c982),
whose engine sources (`core/src/*.rs`), `docs/MODELS.md`, `app/src/models.rs` and
`app/src/settings.rs` are byte-identical to the development tree that was read (compared on
8 November 2026). Figures marked "development record" come from the application's performance
and parity notes, which are not published.

| Claim on the page | Evidence |
|---|---|
| Input: transparency flattened onto grey 128; triangle resize to 1024 × 1024, aspect not kept; ImageNet mean/std; planar 1 × 3 × 1024 × 1024 | `core/src/ai.rs` (`preprocess`); mean/std also in the BiRefNet model card's example |
| Final model output used; sigmoid if values lie outside [0, 1]; Catmull–Rom upscale; refinement when the photo is larger than 1024 | `core/src/ai.rs` (`predict`, `postprocess`, `upscale_bicubic`); `image` 0.25 `CatmullRom` = BC-spline (B = 0, C = ½) = Keys a = −½ |
| Guided filter: colour version, ε = 10⁻⁴, r = clamp(2·max(W,H)/1024, 2, 12), working copy ≤ 2.5 MP, band where dilate ≥ 4 and erode ≤ 251, interiors untouched | `core/src/filters.rs` (`refine_alpha`, `guided_filter_color`, `morph_u8`) |
| 2.35 % of the puppy's pixels changed by refinement; 97.67 % exactly 0 or 255 | Computed from the two real mattes by `scripts/prepare-science.mjs` (printed at build) |
| Matte stored as layer mask; effective α = pixel α × mask × opacity; nothing deleted | `core/src/composite.rs`; macOS removal flow sets the layer mask (`set_layer_mask`) |
| Premultiplied source-over, exact integer path, bilinear premultiplied sampling for transformed layers, straight-alpha export | `core/src/composite.rs`; `core/src/image.rs` (`mul255`, `unpremultiply`) |
| Layer matrix M = T(x,y) R(θ) S(sx,sy) T(−w/2,−h/2); inverse mapping | `core/src/geometry.rs` (`Transform::matrix`) |
| Brush: spacing 0.2 r, smoothstep falloff, 1 px rim when hard, max coverage, erase/restore formulas, Restore brings back original colours | `core/src/brush.rs` |
| Magic Wand: CIEDE2000 in CIELAB (D65) with an alpha term, distance cached per click, linear soft ramp, 4-connected fill where ramp pixels don't spread | `core/src/color.rs`, `core/src/selection.rs` (`distance_map`, `threshold_region`) |
| Quick Selection: k-means (≤ 6) in Lab, region growing stopped by luma edges and ΔE thresholds | `core/src/selection.rs` (`quick_select`) |
| Lasso/polygon: scanline with 4 × 4 supersampling; ellipse = 128-gon; combine = max / a(1−b) / min | `core/src/geometry.rs` (`rasterize_polygon`), `core/src/selection.rs` (`combine`) |
| Refine Edges order and formulas; Gaussian = 3 box passes, r = round(√(4σ²+1)/2) | `core/src/engine.rs` (`refine_layer`), `core/src/filters.rs` (`gaussian`) |
| Decontaminate: blur-fusion, 2 passes (6·max(s,4), max(s,2)), s = 1.5·max(r,2), only 0 < α < 1 | `core/src/filters.rs` (`decontaminate`); method: Forte, ICIP 2021 (sole author; the engine comment's "Forte & Pitié" is inaccurate) |
| BiRefNet: LM + RM, BiRef (inward: image patches; outward: gradient attention), Swin-L default, strides 4–32, ASPP at the bottleneck, classification head for training, deformable reconstruction blocks (1×1, 3×3, 7×7 + pooling), multi-stage supervision, losses and weights | BiRefNet paper (arXiv 2401.03407 v7), §3–4 |
| Swin-L widths 192/384/768/1536, 18 blocks in stage 3 | Swin Transformer paper |
| Core ML: FP16 ML Program, CPU+GPU; ANE compile not finished after 25 min; 20 deformable convs rewritten via `grid_sample`, max \|Δ\| 8 × 10⁻⁵; rank-6 → rank-5 reshapes | `docs/MODELS.md`, `tools/convert/README.md` |
| Fallbacks: accelerator load failure → CPU; Core ML failure → ONNX CPU | `core/src/ai.rs` (`Model::load`); `docs/MODELS.md` |
| Windows: ONNX CPU FP32 default, FP16 option, DirectML in the engine but not in published builds (unverified; sequential + no mem-pattern when built), Fast = BiRefNet Lite | `app/src/settings.rs` (`use_directml: false`), `app/src/models.rs`, `core/src/ai.rs`, `docs/WINDOWS.md`; the installer and CI build with `cargo build --release` and no `directml` feature, so published builds do not offer it; ONNX Runtime DirectML docs |
| Model file sizes | `docs/MODELS.md` (file table) |
| Benchmarks (Core ML 1.93–2.50 s inference …) | Development record (performance notes): two independent runs, 3–4 Nov 2026, M1 16 GB, macOS 27.0.1; the ONNX timings are also in `docs/MODELS.md` |
| FP16 vs FP32 mattes; FP16 slower on CPU | Measured for this page, 8 Nov 2026 (`design/sources/science/README.md`) |
| Strands IoU 0.992 vs raw 0.956; disc IoU 0.105 | Measured for this page, 8 Nov 2026; equal to the application's published values |
| Chrome-bracket slot kept; white gear IoU 0.9994 | `docs/MODELS.md` (results) |
| Model loaded lazily, released after 4 min (macOS) / 45 s (Windows); threads 8/4/2 → 14.0/16.5/24.8 s | Development record (performance notes); `docs/MODELS.md` (threads) |

## Testing

* `tests/unit/science.test.mjs` (17 tests): `mul255` exhaustively over all 65,536 byte pairs; the
  engine's own source-over test; CIEDE2000 against five Sharma et al. reference pairs; every
  finite binary16 pattern round-trips, and rounding agrees with the platform's `Math.f16round`;
  the brush, transform and refine maths.
* `tests/e2e/science.spec.ts` (15 tests per browser): navigation; no request leaves the site's
  origin; no style attributes; equations never overflow on desktop; scroll and reduced-motion
  stage switching; every demonstration driven by keyboard or pointer, with its numbers checked
  against the stated formula; the no-JavaScript fallback.
* `tests/e2e/site.spec.ts` now includes `/science/`: no console errors or CSP violations, no
  horizontal overflow, axe WCAG 2.2 A/AA.
* Results and the visual review are in `docs/TESTING.md`.

## Limits and disclosures

* The architecture diagram is simplified (two of the decoder stages are drawn) and conceptual. No
  activations were extracted from the model; the stride grid is labelled as a concept.
* The 1-D Refine Edges demo applies the app's 2-D operators to a single column of a real matte.
* Benchmarks are from one Apple M1. No Windows hardware has been measured, so none is shown.
* The demos run on images reduced for the web (720 px wide for the alpha and brush labs, 420 px
  for the Magic Wand). The edge lab's crops are at full resolution.
* "Fast" mode (Apple Vision, BiRefNet Lite) is described but not demonstrated.
