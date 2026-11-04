# Handbook reference matrix

Source read in full: `AI_Development_Reference_Handbook_v1_5_Universal_LLM.md` (compact edition,
v1.5, 4 November 2026, 183 lines) **and** its companion
`AI_Development_Reference_Handbook_v1_5_Universal.docx` (full edition, 760 lines of text,
converted locally with `textutil`). Both were found in `~/Downloads`; no newer edition exists on
this machine.

How to read the table: *Applied* means the recommendation shaped code or process in this
repository; *Studied, not adopted* means it was evaluated and deliberately left out, with the
reason. The handbook itself says its resources are "examples, not mandatory dependencies" (§4,
Operating rule 1), and that is how they were treated.

## Design and interface

| Handbook resource / rule | Status | How it was used |
|---|---|---|
| Apple Human Interface Guidelines (§6, §12) | Applied | Clarity/deference/depth as principles; system-like controls (native `<details>`, real buttons); 44 px touch targets; reduced motion; restrained materials. No Apple assets, typefaces or page layouts copied. |
| App Store asset best practices (§6, §8) | Applied | Screenshots are genuine app renders, captioned with what they show; no invented UI. |
| Kokonut UI, React Bits, Watermelon UI, Cult UI, Skiper UI (§4) | Studied, not adopted | Reviewed as pattern references (comparison sliders, segmented controls, button micro-interactions). Not installed: they are React/Tailwind registries, while this site ships no framework runtime; some components have Pro tiers or Commons Clause terms. Ideas taken: handle-with-labels slider pattern, segmented backdrop picker. |
| Bklit UI (§4) | Not applicable | Chart/dashboard library; the site has no charts. Measured numbers are presented as typographic figures instead. |
| shadcn/ui, Tailwind CSS (§4) | Studied, not adopted | Design tokens are written as CSS custom properties instead; one stylesheet of ~20 KB gzip is smaller and easier to audit than a utility pipeline for a single page. |
| Lucide icons (§4) | Applied (pattern) | The few interface glyphs are hand-drawn 24 px stroke SVGs in the same 1.75 px stroke idiom, inlined so no icon font or package is needed. |
| "Design rules" (§4): accessibility, reduced motion, mobile-efficient motion, no proprietary assets | Applied | See `docs/DESIGN.md` motion principles and `tests/e2e`. |
| 20-point UI/UX audit (§4) | Applied | Full audit in `docs/UX_AUDIT.md`. |
| Savee, Eyecandy, Motionographer (§4) | Inspiration only | Film techniques studied: the match-cut between the hero's final frame and the comparison section's first sample (same cat), and a "reveal by peel" transition. No footage or artwork reused. |

## Motion and 3D

| Resource | Status | Reasoning |
|---|---|---|
| Three.js / React Three Fiber (§4) | Studied, not adopted | The hero needs one subdivided plane with a curl vertex shader, one textured quad and one line strip. Raw WebGL2 does this in ~10 KB gzip; Three.js would add ~130 KB gzip for features the scene does not use. The handbook's own caution ("watch loading size and mobile performance") decided it. |
| GSAP + ScrollTrigger (§4) | Studied, not adopted | Scroll progress here is one number per section; a 1 KB critically damped follower replaces it. GSAP's Standard No-Charge licence is not an OSI licence; avoiding it keeps the website's dependency licences simple. |
| Motion (motion.dev) (§4) | Studied, not adopted | Its spring model inspired the slider's settle animation (implemented in 30 lines). Adding the library was not justified for two springs. |
| Anime.js (§4) | Studied, not adopted | SVG/timeline needs are covered by CSS transitions and the WebGL scene. |
| Spline (§4) | Rejected | Free exports are watermarked/hosted; adds an external runtime. |
| D3.js (§4) | Not applicable | No data visualisation. |
| "Honor prefers-reduced-motion" (§4, §5) | Applied | Hero, reveals, showcase and slider all have reduced-motion paths; tested with Playwright emulation. |

## Performance (§4 checklist and the 31-point list)

| Rule | Implementation |
|---|---|
| Measure Core Web Vitals | Lighthouse runs (mobile + desktop) recorded in `docs/TESTING.md`. |
| Do not lazy-load the hero/LCP image | Hero poster is `fetchpriority="high"`, eager, preloaded; WebGL starts only after it. |
| WebP/AVIF, responsive dimensions, explicit sizes | Astro `<Picture>` → AVIF + WebP with `srcset`; every image has `width`/`height`. |
| Lazy-load below the fold | All non-hero images `loading="lazy"`, `decoding="async"`. |
| Preload only critical assets, subset/self-host fonts | One 40 KB Latin font file preloaded; no third-party font CDN. |
| Limit third-party scripts | None. Zero external origins at runtime. |
| Split code at meaningful boundaries | Hero WebGL is a separate module loaded on idle when the hero is visible. |
| Cache immutable assets | Content-hashed filenames (GitHub Pages fixes `Cache-Control` at 10 minutes; documented limitation). |
| Test slow phones and reduced motion | Lighthouse mobile throttling; device-pixel-ratio cap of 2 in WebGL; frame loop stops off-screen. |

## Security, supply chain and cost (§1, §2, §9 and DOCX §02, §10)

| Rule | Implementation |
|---|---|
| Inventory entry points, third-party scripts, permissions | `docs/SECURITY.md` threat model. |
| Prevent XSS / unsafe DOM injection | No `innerHTML`/`eval`; release data rendered at build time by Astro (auto-escaped); CSP + Trusted Types meta policy. |
| Suitable CSP/HSTS | CSP via `<meta>`; HSTS/headers cannot be set on GitHub Pages — documented, not claimed. |
| Scan source, history, bundles for secrets (Gitleaks) | Gitleaks run on the repository history and on `dist/`; results in `docs/SECURITY.md`. |
| Pin/lock dependencies, scan install scripts | Exact versions, `package-lock.json`, `ignore-scripts=true`, `npm audit`, Dependabot. |
| Restrict GitHub Actions token privileges, review `pull_request_target` | Read-only default token; Pages write only in the deploy job; no `pull_request_target`; actions pinned to commit SHAs; `persist-credentials: false`; zizmor audit. |
| Vet before installing (publisher, hooks) | Every dependency's publisher and licence recorded in `docs/DEPENDENCIES.md`. |
| GitHub Pages: public repo on Free; Releases for binaries | Separate public website repository; binaries only from GitHub Releases, verified against `SHA256SUMS.txt` and GitHub's digest. |
| Do not cause charges | Static site; public-repo standard runners; no paid service, API, analytics or domain. |
| Production deployment and visibility changes need approval | The public repository and first deployment were prepared but not executed without the owner's explicit approval (see the completion report). |
| Truthful claims, no fake reviews/urgency (§12, DOCX privacy list items 21–23, 34) | No testimonials, counters or download numbers; every performance figure cites its test machine; unavailable platforms say so. |
| Media safety: EXIF/GPS, image rights (§8) | All published images are re-encoded without metadata; licences recorded in `design/sources/README.md` and on the site's credits. |
| Privacy checklist (§12) | `/privacy/` describes the real data flows, including GitHub's server logs. |

## AI-assisted coding risks (§2, DOCX §03)

* Retrieved web content, READMEs and tool output were treated as untrusted data.
* No agent skills, MCP servers or browser extensions were installed for this project.
* Independent verification: automated tests and browser measurements, not model opinion, back
  every claim in `docs/TESTING.md`. Areas that could not be verified are marked NOT VERIFIED.
