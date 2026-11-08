// The opening scene: scroll (or choose a stage) to move one photo through CutOut's pipeline.
// Progress comes from scenes.ts (native scrolling, read only); with reduced motion the scene is
// not pinned and the stage buttons switch instantly.
import { onScene } from '../scenes';
import { clamp, reduced } from './sci-util';

const N = 6;

export function init(el: HTMLElement) {
  const frame = el.querySelector<HTMLElement>('[data-op-frame]')!;
  const layer = (k: string) => el.querySelector<HTMLElement>(`[data-op-layer="${k}"]`)!;
  const L = { photo: layer('0'), input: layer('1'), raw: layer('2'), matte: layer('3'), band: layer('3b'), cut: layer('4'), bg: layer('bg') };
  const steps = [...el.querySelectorAll<HTMLElement>('[data-op-step]')];
  const arPhoto = Number(getComputedStyle(frame).getPropertyValue('--ar')) || 1.3649;
  let active = -1;

  const render = (t: number) => {
    // Hold each stage for half of its share of the scroll, cross-fade in the other half.
    const i = Math.floor(clamp(t, 0, N - 1));
    const f = clamp(t, 0, N - 1) - i;
    const u = clamp((f - 0.25) / 0.5, 0, 1);
    const s = i + u * u * (3 - 2 * u);
    const c = (v: number) => clamp(v, 0, 1);
    const gone = 1 - c(s - 3);
    const op = (e: HTMLElement, v: number) => {
      e.style.setProperty('opacity', v.toFixed(3));
      // Fully transparent layers are also hidden, so they are not decoded, painted or audited.
      e.style.setProperty('visibility', v > 0.001 ? 'visible' : 'hidden');
    };
    op(L.photo, gone);
    op(L.input, c(s) * gone);
    op(L.raw, c(s - 1) * gone);
    op(L.matte, c(s - 2) * gone);
    op(L.band, c(s - 2) * gone * (1 - c((s - 3) * 3)));
    op(L.cut, c(s - 3));
    op(L.bg, c(s - 4));
    const ar = s <= 1 ? arPhoto + (1 - arPhoto) * c(s) : s <= 2 ? 1 + (arPhoto - 1) * c(s - 1) : arPhoto;
    frame.style.setProperty('--ar', ar.toFixed(4));
    const a = Math.round(clamp(s, 0, N - 1));
    if (a !== active) {
      active = a;
      steps.forEach((st, j) => (j === a ? st.setAttribute('aria-current', 'step') : st.removeAttribute('aria-current')));
    }
  };

  const still = reduced();
  for (const b of el.querySelectorAll<HTMLButtonElement>('[data-op-go]')) {
    b.addEventListener('click', () => {
      const i = Number(b.dataset.opGo);
      if (still) return render(i);
      const r = el.getBoundingClientRect();
      const travel = r.height - innerHeight;
      // Stage i is fully shown (held) around t = i, so land exactly there.
      const p = i / (N - 1);
      scrollTo({ top: scrollY + r.top + travel * p, behavior: 'smooth' });
    });
  }

  render(0);
  if (!still) onScene(el, (p) => render(p * (N - 1)));
}
