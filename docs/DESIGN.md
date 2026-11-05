# Design: creative direction and design system

## The brief in one line

Make people feel CutOut's precision before they read a word, and never show them anything the
app cannot actually do.

## Version 2 (current) and why it replaced version 1

Version 1 was a pale "paper and ink" page: a headline on the left, the image on the right, black pill
buttons, a lot of explanatory text. The owner's review: too close to the ENG Drawing Viewer site,
too much text, not epic. Version 2 keeps everything that was true and verified (real mattes, real
app renders, measured numbers, fail-closed downloads) and changes the presentation completely.

Inspiration was studied, not copied. Sources were the Apple MacBook Pro page (black stage, one
product at a time, sticky scroll scenes, huge type), Awwwards *Sites of the Day* (oversized
wordmarks, depth through layering, marquees), React Bits (word-split reveals, magnetic buttons)
and the handbook's motion and UI references (see `HANDBOOK_MATRIX.md`). No layouts, assets,
typefaces or code were taken from any of them.

## Directions explored for version 2

| | A. Cut from the word (chosen) | B. Studio light table | C. Exploded layers |
|---|---|---|---|
| Idea | A black stage. A giant **CutOut** wordmark sits *between* a photo and its subject: the subject is in front of the word, the background is behind it. Scrolling traces the cut, the subject lifts and the print peels off the screen. | A photographer's light table: prints slide in, the cut is drawn with a scalpel cursor. | The photo, matte and cutout float apart in 3D depth as you scroll. |
| Epic, at a glance | Yes: the depth trick reads instantly and only works *because* the background was removed. | Calm, editorial; closer to version 1. | Spectacular but a common "3D product" trope. |
| Truthful | Uses CutOut's real matte for the hole, the cut line and the subject. | Same. | Needs invented intermediate layers. |
| Cost | One small WebGL 2 canvas (3.7 KiB gzip), DOM layers for the rest. | CSS only. | Three.js or similar, heavier on phones. |
| Distinct from ENG | Completely (dark, centred, type-as-image). | Partly (light, editorial). | Yes. |

**Decision: A.** The hero subject is a white enamel mug, which follows the owner's direction. It is
a simple, non-living object with a clean silhouette, and the gap inside its handle is a real hole.
A machined crankset was tried first, but the owner found it too busy as the first image, so it
now appears only as the *Gaps* sample. The golden retriever puppy leads the results section. It
is a puppy lying on a plain carpet, chosen so that every leg is visible: the first choice stood
in grass that hid part of a hind leg.

**Revision, 5 November 2026.** The owner liked the wordmark but not having it behind the mug.
The giant **CutOut** now stands alone at the top of the hero, solid white with no blend, and the
mug animation plays in the frame below it. The same wordmark leads the share image.

## Art direction

* **A black stage, one subject at a time.** Near-black (`--bg`) everywhere, so cutouts float and
  transparency (the checkerboard) reads as a material. Sections are full-viewport scenes with one
  idea each.
* **Type as image.** Headlines are huge and few: *Every hair. Every thread.*, *Paste. Remove.
  Copy.*, *A real Mac app.*, *Nothing leaves your Mac.*, *Get CutOut.* Body text is one line where
  possible; details live in the Guide.
* **One accent: the cut.** Violet appears only where something is cut or selected: the marching
  ants, focus rings, the slider handle, key-press glows.
* **Real pixels only.** Every product image is CutOut's own, unretouched output or a window the
  app rendered itself. The checkerboard appears only where pixels are transparent.

## The home page, scene by scene

| Section | What happens | Scroll length |
|---|---|---|
| Hero | The giant **CutOut** wordmark at the top, as wide as the content column (at most a quarter of the screen height). The mug photo sits in a frame below it. Scroll: marching ants trace the outline (outer edge plus the handle's hole), the subject lifts with a shadow, the print curls back from its corner (white paper underside) and is pulled off the screen, leaving the subject on the transparency grid. | 300 svh (240 on phones) |
| Results (`#compare`) | *Every hair. Every thread.* A before/after slider with four real samples (Fur: golden retriever puppy; Threads: hex bolts; Gaps: the crankset; Seeds: a dandelion), four backdrops and a zoom. | normal |
| Keys | *Paste. Remove. Copy.* pinned; a ⌘ key with the letter rolling V → B → C, the bolt photo dissolving into its cutout, then shrinking away with a "Copied" toast. | 330 svh (300) |
| The app (`#app`) | A genuine CutOut window rises and tilts upright, then swaps from the simple view to the full tool panel. | 260 svh (220) |
| Numbers | Three measured figures: 0.5 s to launch, 2.5 s per cutout, 0 images uploaded. | normal |
| Tools | Two opposing marquees: real cutouts, then tool names with their shortcut keys. | normal |
| Privacy (`#privacy`) | *Nothing leaves your Mac.* and four short facts. | normal |
| Get (`#get`) | The icon, *Get CutOut.*, the download (or *Coming soon* until a public release exists), requirements. | normal |
| Footer | Links, a giant outline wordmark, credits. | normal |

## Design system

### Colour tokens (`src/styles/global.css`)

| Token | Value | Use | Contrast on `--bg` |
|---|---|---|---|
| `--bg` | `#050507` | Page background | — |
| `--bg-2` / `--bg-3` | `#0c0c10` / `#16161c` | Raised surfaces | — |
| `--fg` | `#f5f5f7` | Text, primary buttons | 18.7:1 |
| `--fg-2` | `#a6a6b3` | Secondary text | 8.5:1 |
| `--fg-3` | `#7d7d89` | Meta, captions | 5.0:1 |
| `--line` / `--line-2` | white at 10 % / 18 % | Hairlines, control borders | — |
| `--cut` | `#8f84ff` | The cut, focus rings, accents | 6.7:1 |
| `--cut-2` | `#5847f0` | Deep accent (glows, the icon's violet) | decorative |
| `--checker-a/b` | `#17171d` / `#0f0f13` | Transparency grid | — |

The dimmed words in the key sequence are `--fg` at 40 % opacity, which is 3.5:1. That passes for
their size (large text, at least 48 px). Ratios use the WCAG relative-luminance formula, and the
axe checks in `tests/e2e` guard them.

The Guide, privacy and 404 pages use the same tokens through compatibility aliases (`--ink*`,
`--s-*`, `--step-*`) defined at the end of `global.css`.

### Typography

* **Mona Sans** variable (weight 200–900 and width 75–125 % axes, Latin subset, 98 KB, SIL OFL
  1.1), self-hosted and preloaded. The width axis carries the brand: the wordmark is set at
  `font-stretch: 125%`, weight 800, tracking −0.065em.
* Headlines (`.title`) are 44 to 120 px fluid (`.title--m` 36 to 80 px), weight 720, width
  112 %, tracking −0.05em, `text-wrap: balance`. Body text is 16 to 18 px, weight 430.
* `ui-monospace` for checksums and file names.

### Layout

* Content width 1320 px, gutter `clamp(20px, 4vw, 56px)`, fixed 64 px navigation.
* Breakpoints: 820 px (phone ↔ tablet; two-column layouts stack, scenes shorten) and 1080 px.
* Scenes are a tall `section[data-scene]` with a sticky `.pin` child (`100svh`, overflow clipped).

### Motion principles

1. **Scroll is the timeline, never hijacked.** Native scrolling drives every scene. `scenes.ts`
   only *reads* the position and writes it as CSS variables (`--p` and named ranges such as
   `--cut`, `--lift`, `--peel`), smoothed with a critically damped follower (τ ≈ 80 ms).
   Scrolling back plays everything in reverse.
2. **Motion explains.** The cut is traced, the subject lifts, the background is pulled away, the
   key is pressed. Loops (marching ants, marquees) are slow and pause on hover.
3. **Easing:** `--ease: cubic-bezier(0.2, 0.7, 0.1, 1)` for entrances and state changes,
   `--ease-io: cubic-bezier(0.65, 0, 0.25, 1)` for loops. Durations 420 to 900 ms.
4. **Small delights, never in the way.** Words rise into place once (`Split.astro`, the
   `data-split` attribute). The primary button leans slightly towards the pointer (`data-magnetic`).
   The hero layers parallax a few pixels with the pointer, on fine pointers only.
5. **Reduced motion:** scenes collapse to normal-height sections showing their finished state. The
   hero becomes a static depth composition with a *Remove background* button. Reveals are instant
   and marquees become wrapped lists. Nothing essential depends on animation.

### Interaction states

| State | Treatment |
|---|---|
| Hover (pointer devices) | Slight tone lift; magnetic lean on the primary button; marquees pause |
| Active | 0.97 scale (buttons) |
| Focus-visible | 2 px `--cut` outline, 3 px offset |
| Unavailable | Said plainly (*Coming soon*, *Windows: planned, not built*), never a dead button |

### Responsive behaviour

* **Phones:** the hero keeps the photo's square shape so the whole mug stays visible. The
  wordmark spans the screen width above it, and the headline and a full-width button sit at the
  bottom. The slider frame is 4:5. The key sequence puts the image above the words.
* **Tablets and up:** two-column scenes from 820 px. The hero frame grows to 1100 px.
* Touch: every control is at least 44 px. The slider takes horizontal drags while vertical swipes
  still scroll.
