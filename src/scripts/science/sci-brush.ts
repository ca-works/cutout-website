// Chapter 5: CutOut's eraser and restore brushes, ported from the engine. A stroke accumulates the
// maximum dab coverage and recomputes the mask from its pre-stroke state, so opacity is a ceiling.
import { canvasPoint, live, pixelsOf, radios } from './sci-util';
import { dabFalloff, erase, restore } from './sci-lib';

export async function init(el: HTMLElement) {
  const [F, A] = await Promise.all([pixelsOf(el.dataset.rgb!), pixelsOf(el.dataset.matte!)]);
  const { w, h } = F;
  const n = w * h;
  const cv = el.querySelector<HTMLCanvasElement>('[data-br-canvas]')!;
  const g = cv.getContext('2d')!;
  const img = new ImageData(w, h);
  const original = new Uint8Array(n);
  for (let i = 0; i < n; i++) original[i] = A.data[i * 4];
  let mask = original.slice();
  const st = { mode: 'erase', size: 60, hard: 0.5, op: 1 };
  const inp = (k: string) => el.querySelector<HTMLInputElement>(`[data-br="${k}"]`)!;
  const out = (k: string) => el.querySelector<HTMLElement>(`[data-br-out="${k}"]`)!;

  for (let i = 0; i < n; i++) {
    img.data[i * 4] = F.data[i * 4];
    img.data[i * 4 + 1] = F.data[i * 4 + 1];
    img.data[i * 4 + 2] = F.data[i * 4 + 2];
  }
  const paint = (x0 = 0, y0 = 0, x1 = w, y1 = h) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) img.data[(y * w + x) * 4 + 3] = mask[y * w + x];
    g.putImageData(img, 0, 0, x0, y0, x1 - x0, y1 - y0);
  };

  let stroke: { base: Uint8Array; cov: Uint8Array; last: [number, number] | null } | null = null;
  const dab = (cx: number, cy: number, r: number) => {
    const x0 = Math.max(0, Math.floor(cx - r - 1)), x1 = Math.min(w, Math.ceil(cx + r + 1));
    const y0 = Math.max(0, Math.floor(cy - r - 1)), y1 = Math.min(h, Math.ceil(cy + r + 1));
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const f = dabFalloff(Math.hypot(x + 0.5 - cx, y + 0.5 - cy), r, st.hard);
        const v = Math.round(f * st.op * 255);
        const i = y * w + x;
        if (v > stroke!.cov[i]) stroke!.cov[i] = v;
      }
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const i = y * w + x;
        mask[i] = st.mode === 'erase' ? erase(stroke!.base[i], stroke!.cov[i]) : restore(stroke!.base[i], stroke!.cov[i]);
      }
    if (x1 > x0 && y1 > y0) paint(x0, y0, x1, y1);
  };
  const to = (x: number, y: number) => {
    const r = Math.max(0.5, st.size / 2);
    const spacing = Math.max(0.5, r * 0.2);
    if (!stroke!.last) {
      dab(x, y, r);
      stroke!.last = [x, y];
      return;
    }
    const [px, py] = stroke!.last;
    const d = Math.hypot(x - px, y - py);
    const k = Math.floor(d / spacing);
    for (let i = 1; i <= k; i++) {
      const t = (i * spacing) / d;
      dab(px + (x - px) * t, py + (y - py) * t, r);
      stroke!.last = [px + (x - px) * t, py + (y - py) * t];
    }
  };
  const begin = () => (stroke = { base: mask.slice(), cov: new Uint8Array(n), last: null });

  cv.addEventListener('pointerdown', (e) => {
    begin();
    cv.setPointerCapture(e.pointerId);
    to(...canvasPoint(cv, e));
  });
  cv.addEventListener('pointermove', (e) => stroke && to(...canvasPoint(cv, e)));
  const end = () => (stroke = null);
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);

  const plot = () => {
    const path: string[] = [];
    const r = 100;
    for (let i = 0; i <= 120; i++) {
      const d = (i / 120) * (r + 15);
      const f = dabFalloff(d, r, st.hard) * st.op;
      path.push(`${i ? 'L' : 'M'}${(20 + (212 * d) / (r + 15)).toFixed(1)} ${(90 - 80 * f).toFixed(1)}`);
    }
    path.push('L232 90 L20 90 Z');
    el.querySelector('[data-br-curve]')!.setAttribute('d', path.join(' '));
  };
  const bind = (k: 'size' | 'hard' | 'op', fmt: (v: number) => string, scale = 1) =>
    inp(k).addEventListener('input', () => {
      st[k] = Number(inp(k).value) / scale;
      out(k).textContent = fmt(Number(inp(k).value));
      plot();
    });
  bind('size', (v) => `${v} px`);
  bind('hard', (v) => `${v} %`, 100);
  bind('op', (v) => `${v} %`, 100);
  radios(el.querySelector('[aria-labelledby="br-mode-label"]')!, (b) => (st.mode = b.dataset.brMode!));
  el.querySelector('[data-br-reset]')!.addEventListener('click', () => {
    mask = original.slice();
    paint();
  });
  el.querySelector('[data-br-demo]')!.addEventListener('click', () => {
    begin();
    for (let t = 0; t <= 1; t += 0.02) to(w * (0.5 + 0.32 * t), h * (0.42 + 0.1 * Math.sin(t * Math.PI)));
    stroke = null;
  });

  live(el);
  plot();
  paint();
}
