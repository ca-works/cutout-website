# Design: creative direction and design system

## The brief in one line

Make people feel CutOut's precision before they read a word — and never show them anything the
app cannot actually do.

## Three directions that were explored

| | A. The Clean Cut (chosen) | B. Layers in Space | C. Clipboard Theatre |
|---|---|---|---|
| Idea | A real photograph lies on a pale table like a print. Scrolling traces a cut along the subject's true outline, the subject lifts, and the background peels away like a sticker backing — the icon's own metaphor (dashed cut, curled violet sheet, checkerboard) brought to life. | The page is a dark 3D space in which a composition's layers (photo, cutout, text, arrow) float apart in depth and reassemble as you scroll. | The real app window is the protagonist: a scroll-driven re-enactment of paste → remove → copy, ending in a slide in another app. |
| Originality | High: the peel is specific to CutOut and its icon. | Medium: exploded layer stacks are a common "3D product" trope. | Low–medium: screen-recording style pages are common. |
| Understood in 2 s? | Yes — the background literally comes off. | Partly — reads as "layers", not "background removal". | Yes, but slowly; needs reading. |
| Truthfulness | Uses CutOut's real matte for the cut, the hole and the subject. | Would need invented compositions. | Would need a fabricated destination app UI (Keynote etc.) — rejected. |
| Performance | One WebGL2 canvas, 2 textures, ~10 KB JS; poster image is the LCP. | Three.js + several textures, heavier on phones. | Video or image sequences: several MB. |
| Mobile | Works as a square stage under the headline. | Depth reads poorly on small screens. | Small UI text is illegible on phones. |
| Accessibility | Static final state for reduced motion; no scroll hijacking. | Motion-heavy. | Motion-heavy; long sticky sections. |
| Maintainability | Assets regenerate from any photo + matte with one script. | Many hand-tuned layers. | Every UI change needs re-recording. |

**Decision: A.** It is the only direction whose signature moment is both unique to CutOut and a
literal, truthful demonstration of the product. B's depth idea survives in a restrained form (the
cut subject floats above the sheet and casts a real shadow); C's honesty about the real interface
survives in the interface showcase, which uses only genuine app renders.

## Art direction

* **Paper and ink.** The page is mostly a pale, slightly cool paper (`--paper`) with near-black navy
  ink (`--ink`). Dark is used deliberately, twice: the interface showcase ("the studio") and the
  footer — not as a default theme. This avoids the dark-gradient look of generic AI-made sites and
  lets the transparency checkerboard read naturally.
* **One accent: the cut.** The icon's indigo→violet appears only where something is *cut* or
  *selected*: the cut line, focus rings, the slider handle, the curl's underside. Buttons are ink.
* **Negative space is the subject.** Checkerboards appear only where pixels are genuinely
  transparent.
* **Measured claims, set in tabular figures** with their test machine named next to them.

## Design system

### Colour tokens (`src/styles/tokens.css`)

| Token | Value | Use |
|---|---|---|
| `--paper` | `#f3f3f0` | Page background |
| `--paper-raised` | `#fbfbf9` | Raised surfaces on paper |
| `--ink` | `#0d1020` | Text, primary buttons |
| `--ink-2` | `#4a4e60` | Secondary text (7.4:1 on paper) |
| `--ink-3` | `#666a7a` | Tertiary text, meta (4.8:1 on paper) |
| `--rule` | `rgb(13 16 32 / 0.12)` | Hairlines |
| `--night` | `#0a0d18` | Studio and footer background |
| `--night-2` | `#121628` | Raised surfaces on night |
| `--on-night` | `#eceef6` | Text on night |
| `--on-night-2` | `#a3a8bd` | Secondary text on night (8.2:1) |
| `--cut` | `#5847f0` | The cut line, focus rings, links (5.3:1 on paper) |
| `--cut-bright` | `#8f84ff` | Cut accent on night (6.4:1) |
| `--checker-a/b` | `#ffffff` / `#e4e5ea` | Transparency grid |

Contrast ratios were computed with the WCAG relative-luminance formula; the automated axe checks
in `tests/e2e` guard them.

The colour-distance illustration in Features uses `#d9cbb0` (beige), `#d1c3a8` (beige in shadow,
CIEDE2000 1.98 from it) and `#f0eee9` (white part, 11.82). The app's Magic Eraser default tolerance
of 8 ΔE (visible in its screenshot) separates them as described.

### Typography

* **Mona Sans** (variable, weight axis only, Latin subset, 40 KB, SIL OFL 1.1) for everything —
  one file, self-hosted, `font-display: swap`, preloaded. It is GitHub's open-source typeface,
  a quiet nod to where CutOut lives.
* `ui-monospace` stack for checksums and file names (no download).
* Scale (fluid with `clamp()`): display 44→120 px, h2 34→72 px, h3 22→28 px, body 17→19 px,
  small 14–15 px. Display tracking −0.045em, h2 −0.035em; body +0.
* `text-wrap: balance` for headings, `text-wrap: pretty` for paragraphs (progressive).
* `font-variant-numeric: tabular-nums` wherever numbers are compared or measured.

### Grid and spacing

* 12-column grid, max content width 1240 px, gutters `clamp(20px, 4vw, 48px)`.
* Spacing scale (px): 4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 176. Section rhythm uses the top three.
* Breakpoints: 560 (large phone), 820 (tablet portrait), 1080 (laptop), 1440 (desktop).

### Shape, depth and light

* Radii: 6 (chips), 12 (controls), 18 (media), 28 (stage). Continuous-looking corners via
  generous radii on large surfaces only; small controls stay crisp.
* One light source, top-left, everywhere: hero shadows, window shadows and the icon agree.
* Shadows are layered (ambient + key) and tinted with ink, never pure black.

### Motion principles

1. **Motion explains.** Every animation shows cause and effect (cutting, lifting, peeling,
   revealing). Nothing loops for attention.
2. **Scroll is the timeline, never hijacked.** Native scrolling drives progress; we only smooth the
   visual response (critically damped, ~120 ms).
3. **Easing:** `--ease-out: cubic-bezier(0.2, 0.7, 0.1, 1)` for entrances,
   `--ease-in-out: cubic-bezier(0.6, 0, 0.2, 1)` for state changes. Durations 180–700 ms.
4. **Interruptible:** slider and tabs animate from their current value, not from a reset.
5. **Reduced motion:** the hero shows its finished state with a tap-to-compare, reveals become
   instant, and parallax is off. Nothing essential depends on animation.

### Interaction states

| State | Treatment |
|---|---|
| Hover (pointer devices only) | 2–4 % lift in tone; buttons gain a 1 px inner highlight |
| Active | 0.98 scale, 90 ms |
| Focus-visible | 2 px `--cut` ring with 3 px offset (on night: `--cut-bright`) |
| Disabled / unavailable | Text label says why ("Not available yet"); never a dead button |

### Responsive behaviour

* **Phones:** the hero headline and buttons come first; the stage follows full-bleed and becomes
  sticky for a shorter scroll (180 svh). The before/after slider is full width; tabs scroll.
  The interface showcase crops to the canvas and toolbar rather than shrinking a whole window to
  unreadable size.
* **Tablets:** two-column layouts collapse at 820 px; touch targets ≥ 44 px.
* **Desktop:** the headline and the stage share one sticky viewport (260 vh scroll).
