# UI/UX quality audit (handbook §4, 20 checks)

Status: **Present** · **Improve** · **Missing** · **N/A**. Website context: a static product page.

| # | Practice | Status | Notes |
|---|---|---|---|
| 1 | Skeletons | N/A | Nothing loads asynchronously into layout; images have fixed dimensions. |
| 2 | Optimistic updates | N/A | No server actions. |
| 3 | Command palette | N/A | Nine sections; a nav and a guide TOC suffice. |
| 4 | Shortcut hints | Present | Real app shortcuts shown as keycaps (workflow) and tables (guide). On the site, the slider's keys are in its instructions and accessible name. |
| 5 | Undo toast | N/A | No destructive actions. |
| 6 | Stale-while-revalidate | N/A (by design) | Release data is fetched at build time and verified; the browser never fetches it, so it can't be stale-but-unverified. |
| 7 | Pre-render/prefetch | Present | Fully static pre-rendered pages; no speculative prefetch (unneeded, and avoids wasted requests). |
| 8 | Blurred image placeholders | Present (adapted) | Paper-toned backgrounds behind images; the hero poster has a matching neutral colour; no layout shift (CLS 0). |
| 9 | View transitions | N/A | Multi-page with three pages; anchors use smooth scroll only without reduced motion. |
| 10 | Swipe-dismiss sheets | Present (native) | The phone menu is a native `popover` with light dismiss and an explicit Close button. |
| 11 | Interruptible motion | Present | Hero follows scroll in both directions at any point; slider springs start from the current value; tabs switch instantly. |
| 12 | Predictive back | N/A | Ordinary links and anchors; browser back works. |
| 13 | Tap targets | Present | Buttons ≥ 44 px (CTA 52 px, slider grip 44 px with a 48 px hit area, nav links 44 px). |
| 14 | Safe-area insets | Present | `viewport-fit=cover`; content uses side gutters ≥ 20 px; no fixed bottom UI. |
| 15 | OTP autofill | N/A | No authentication. |
| 16 | Tabular numerals | Present | Measured figures, step numbers, file sizes and checksums. |
| 17 | Balanced headlines | Present | `text-wrap: balance` on headings, `pretty` on paragraphs; hero headline sized to its column (container query units) and to short screens. |
| 18 | Continuous corners | Present | One radius scale (6/12/18/28); large surfaces only. |
| 19 | Idempotency keys | N/A | No transactions. |
| 20 | Safe-triangle menus | N/A | No submenus. |

Apple HIG principles applied: clarity (one idea per section, plain verbs), deference (the
product images lead, chrome recedes), depth (one consistent light, real shadows), accessibility
(contrast ≥ 4.5:1, focus rings, reduced motion, VoiceOver-friendly slider and tabs).
