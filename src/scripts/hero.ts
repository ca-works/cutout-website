// Hero controller. Decides how the signature scene runs and feeds it scroll progress.
//
//   reduced motion  → static finished cutout + "Show original" toggle (no scroll track)
//   no WebGL 2      → "lite": the two real images dissolve with scroll
//   otherwise       → the WebGL scene (loaded lazily as its own module)
//
// Scrolling is never intercepted: progress is read from the track's position and the visual
// state follows it with a short critically damped lag.

import { clamp, ease, span, STEPS } from './hero-timeline';

export function initHero() {
  const found = document.querySelector<HTMLElement>('[data-hero]');
  if (!found) return;
  const hero: HTMLElement = found;
  const track = hero.querySelector<HTMLElement>('[data-hero-track]')!;
  const canvas = hero.querySelector<HTMLCanvasElement>('[data-stage-canvas]')!;
  const poster = hero.querySelector<HTMLImageElement>('[data-stage-poster]')!;
  const staticLayer = hero.querySelector<HTMLElement>('[data-stage-static]')!;
  const toggle = hero.querySelector<HTMLButtonElement>('[data-stage-toggle]')!;
  const steps = [...hero.querySelectorAll<HTMLElement>('[data-step]')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  // ---- static mode toggle (reduced motion; also used if everything else fails) ----
  toggle.addEventListener('click', () => {
    const showOriginal = toggle.getAttribute('aria-pressed') !== 'true';
    toggle.setAttribute('aria-pressed', String(showOriginal));
    toggle.textContent = showOriginal ? 'Show cutout' : 'Show original';
    hero.dataset.show = showOriginal ? 'original' : 'cutout';
  });

  function enterStatic() {
    hero.classList.remove('is-live', 'is-ready', 'is-lite');
    toggle.hidden = false;
  }

  if (reduced.matches) {
    enterStatic();
    return;
  }

  // ---- scroll progress ----
  let target = 0;
  let current = 0;
  let visible = true;
  let mode: 'live' | 'lite' = 'lite';
  let render: ((p: number, dt: number) => boolean) | null = null;
  let raf = 0;
  let last = 0;

  const measure = () => {
    const r = track.getBoundingClientRect();
    const travel = r.height - innerHeight;
    target = travel > 0 ? clamp(-r.top / travel) : 0;
  };

  const paintSteps = (p: number) => {
    STEPS.forEach(([a, b], i) => {
      const f = span(p, a, b);
      steps[i].style.setProperty('--fill', f.toFixed(3));
      steps[i].classList.toggle('is-active', f > 0 && f < 1);
      steps[i].classList.toggle('is-done', f >= 1);
    });
  };

  const frame = (now: number) => {
    raf = 0;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;
    // Critically damped follow (τ ≈ 90 ms): smooth, but never far behind the scrollbar.
    current += (target - current) * (1 - Math.exp(-dt / 0.09));
    if (Math.abs(target - current) < 0.0005) current = target;
    paintSteps(current);
    let keepGoing = current !== target;
    if (mode === 'lite') {
      staticLayer.style.setProperty('--lite', ease(span(current, 0.3, 0.7)).toFixed(3));
    } else if (render) {
      keepGoing = render(current, dt) || keepGoing;
    }
    if (keepGoing && visible) schedule();
    else last = 0;
  };

  const schedule = () => {
    if (!raf) raf = requestAnimationFrame(frame);
  };

  const onScroll = () => {
    measure();
    schedule();
  };

  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll, { passive: true });
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) onScroll();
  }).observe(track);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) onScroll();
  });

  reduced.addEventListener('change', () => location.reload());

  // ---- choose the renderer ----
  // Creating a WebGL context just to test for one is expensive (≈1 s on software GL), so only
  // the API's presence is checked here; createScene() falls back to lite if a context fails.
  const gl2 = 'WebGL2RenderingContext' in window;

  hero.classList.add('is-lite');
  measure();
  schedule();
  if (!gl2) return;

  const start = () => {
    import('./hero-scene')
      .then(async ({ createScene }) => {
        const scene = await createScene(canvas, poster, hero);
        hero.classList.remove('is-lite');
        hero.classList.add('is-live');
        mode = 'live';
        render = (p, dt) => scene.frame(p, dt);
        scene.onLost(() => {
          mode = 'lite';
          render = null;
          hero.classList.remove('is-live', 'is-ready');
          hero.classList.add('is-lite');
          schedule();
        });
        requestAnimationFrame(() => {
          hero.classList.add('is-ready');
          schedule();
        });
      })
      .catch((err) => {
        console.warn('CutOut hero: WebGL scene unavailable, using the simple version.', err);
      });
  };

  // The scene's first frame is identical to the poster, so it is only built once the visitor
  // shows intent (scroll, pointer, key or touch) — never during the initial load. Until it is
  // ready, the lite dissolve covers the same scroll range.
  let started = false;
  const intents = ['scroll', 'wheel', 'pointermove', 'pointerdown', 'keydown', 'touchstart'] as const;
  const kick = () => {
    if (started) return;
    started = true;
    for (const t of intents) removeEventListener(t, kick);
    const go = () => ('requestIdleCallback' in window ? requestIdleCallback(start, { timeout: 300 }) : setTimeout(start, 50));
    if (poster.complete) go();
    else poster.addEventListener('load', go, { once: true });
  };
  for (const t of intents) addEventListener(t, kick, { passive: true });
  if (target > 0) kick(); // reloaded part-way down the page
}
