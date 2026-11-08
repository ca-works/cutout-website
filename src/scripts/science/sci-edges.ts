// Chapter 4: the edge laboratory. Each sample is a full-resolution 360 × 360 crop of the photo and
// of CutOut's mattes (refined, raw, and the exact ground truth for the synthetic scenes).
import { live, pixelsOf, radios } from './sci-util';

type Px = Awaited<ReturnType<typeof pixelsOf>>;
const ON: [number, number, number] = [32, 160, 255];

export function init(el: HTMLElement) {
  const tabs = [...el.querySelectorAll<HTMLButtonElement>('[data-edge-tab]')];
  const panels = [...el.querySelectorAll<HTMLElement>('[data-edge-panel]')];
  const ready = new Map<string, (v: string) => void>();

  const activate = async (id: string, focus = false) => {
    tabs.forEach((t) => {
      const on = t.dataset.edgeTab === id;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
    });
    panels.forEach((p) => (p.hidden = p.dataset.edgePanel !== id));
    if (!ready.has(id)) await setup(panels.find((p) => p.dataset.edgePanel === id)!);
  };

  const setup = async (p: HTMLElement) => {
    const id = p.dataset.edgePanel!;
    ready.set(id, () => {});
    const load = (k: string) => (p.dataset[k] ? pixelsOf(p.dataset[k]!) : Promise.resolve(null));
    const [rgb, matte, raw, gt] = (await Promise.all([load('rgb'), load('matte'), load('raw'), load('gt')])) as [Px, Px, Px | null, Px | null];
    const cv = p.querySelector<HTMLCanvasElement>('[data-edge-canvas]')!;
    const g = cv.getContext('2d')!;
    const img = new ImageData(rgb.w, rgb.h);
    const draw = (view: string) => {
      const d = img.data;
      const n = rgb.w * rgb.h;
      for (let i = 0; i < n; i++) {
        const o = i * 4;
        const a = matte.data[o];
        const f = [rgb.data[o], rgb.data[o + 1], rgb.data[o + 2]];
        let r = 0, gg = 0, b = 0, al = 255;
        switch (view) {
          case 'rgb': [r, gg, b] = f; break;
          case 'matte': r = gg = b = a; break;
          case 'raw': r = gg = b = raw!.data[o]; break;
          case 'gt': r = gg = b = gt!.data[o]; break;
          case 'err': {
            const e = Math.abs(a - gt!.data[o]);
            r = Math.min(255, e * 2);
            gg = Math.min(255, e * 0.6);
            b = Math.min(255, 40 + e * 1.6);
            break;
          }
          case 'cut': [r, gg, b] = f; al = a; break;
          case 'hard': [r, gg, b] = f; al = a >= 128 ? 255 : 0; break;
          case 'on': {
            const t = a / 255;
            r = t * f[0] + (1 - t) * ON[0];
            gg = t * f[1] + (1 - t) * ON[1];
            b = t * f[2] + (1 - t) * ON[2];
          }
        }
        d[o] = r;
        d[o + 1] = gg;
        d[o + 2] = b;
        d[o + 3] = al;
      }
      g.clearRect(0, 0, cv.width, cv.height);
      g.putImageData(img, 0, 0);
    };
    ready.set(id, draw);
    radios(p.querySelector('[data-edge-views]')!, (b) => draw(b.dataset.edgeView!));
    draw('matte');
  };

  tabs.forEach((t, i) => {
    t.addEventListener('click', () => activate(t.dataset.edgeTab!));
    t.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      activate(tabs[(i + d + tabs.length) % tabs.length].dataset.edgeTab!, true);
    });
  });
  live(el);
  activate(tabs[0].dataset.edgeTab!);
}
