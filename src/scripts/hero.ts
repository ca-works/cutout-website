// Hero controller.
//   reduced motion → static depth composition + a "Remove background" button
//   no WebGL 2     → "lite": the print falls away with the scroll (CSS only)
//   otherwise      → the WebGL print peels off (hero-gl.ts, loaded on first interaction)
// The cut line, the lift, the shadow and the wordmark are DOM/SVG driven by the scene's CSS
// variables (see scenes.ts), so they work in every mode.
import { onScene } from './scenes';

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const span = (p: number, a: number, b: number) => clamp((p - a) / (b - a));

export function initHero() {
  const found = document.querySelector<HTMLElement>('[data-hero]');
  if (!found) return;
  const hero: HTMLElement = found;
  const canvas = hero.querySelector<HTMLCanvasElement>('[data-gl]')!;
  const poster = hero.querySelector<HTMLImageElement>('[data-poster]')!;
  const toggle = hero.querySelector<HTMLButtonElement>('[data-toggle]')!;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduced) {
    toggle.hidden = false;
    toggle.addEventListener('click', () => {
      const off = toggle.getAttribute('aria-pressed') !== 'true';
      toggle.setAttribute('aria-pressed', String(off));
      toggle.textContent = off ? 'Show original' : 'Remove background';
      hero.dataset.bg = off ? 'off' : 'on';
    });
    return;
  }

  hero.classList.add('is-lite');

  // Gentle pointer parallax between the layers (fine pointers only).
  if (matchMedia('(pointer: fine)').matches) {
    let tx = 0, ty = 0, x = 0, y = 0, raf = 0;
    const step = () => {
      x += (tx - x) * 0.08;
      y += (ty - y) * 0.08;
      hero.style.setProperty('--mx', x.toFixed(3));
      hero.style.setProperty('--my', y.toFixed(3));
      raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.002 ? requestAnimationFrame(step) : 0;
    };
    hero.addEventListener('pointermove', (e) => {
      tx = clamp((e.clientX / innerWidth) * 2 - 1, -1, 1);
      ty = clamp((e.clientY / innerHeight) * 2 - 1, -1, 1);
      if (!raf) raf = requestAnimationFrame(step);
    });
    hero.addEventListener('pointerleave', () => {
      tx = ty = 0;
      if (!raf) raf = requestAnimationFrame(step);
    });
  }

  if (!('WebGL2RenderingContext' in window)) return;

  let progress = 0;
  let draw: ((p: number) => void) | null = null;
  onScene(hero, (p) => {
    progress = p;
    draw?.(p);
  });

  const start = () =>
    import('./hero-gl')
      .then(async ({ createPrint }) => {
        const print = await createPrint(canvas, poster, hero.querySelector<HTMLElement>('[data-stage]')!);
        draw = (p) => print.draw({ lift: span(p, 0.27, 0.42), peel: span(p, 0.4, 0.86) });
        print.onLost(() => {
          draw = null;
          hero.classList.remove('is-live');
          hero.classList.add('is-lite');
        });
        draw(progress);
        requestAnimationFrame(() => {
          hero.classList.remove('is-lite');
          hero.classList.add('is-live');
        });
      })
      .catch((err) => console.warn('CutOut hero: WebGL unavailable, using the simple version.', err));

  // The scene's first frame equals the poster, so it is built only when the visitor shows intent
  // — never during the initial load (keeps total blocking time at zero).
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
  if (scrollY > 0) kick();
}
