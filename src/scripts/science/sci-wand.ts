// Chapter 5: CutOut's Magic Wand in the browser: CIEDE2000 distance from the clicked colour,
// cached per click, then thresholded with a soft ramp and a 4-connected flood fill.
import { canvasPoint, clamp, live, pixelsOf } from './sci-util';
import { wandDistance, wandThreshold } from './sci-lib';

export async function init(el: HTMLElement) {
  const P = await pixelsOf(el.dataset.src!);
  const { w, h } = P;
  const cv = el.querySelector<HTMLCanvasElement>('[data-wd-canvas]')!;
  const g = cv.getContext('2d')!;
  const img = new ImageData(w, h);
  const inp = (k: string) => el.querySelector<HTMLInputElement>(`[data-wd="${k}"]`)!;
  const out = (k: string) => el.querySelector<HTMLElement>(`[data-wd-out="${k}"]`)!;
  const note = el.querySelector<HTMLElement>('[data-wd-note]')!;
  const st = { x: 14, y: 14, cx: 14, cy: 14, dist: null as Uint16Array | null };

  const draw = () => {
    const tol = Number(inp('tol').value), soft = Number(inp('soft').value);
    out('tol').textContent = String(tol);
    out('soft').textContent = String(soft);
    const t0 = performance.now();
    const sel = wandThreshold(st.dist!, w, h, st.x, st.y, tol, soft, inp('contig').checked);
    const ms = performance.now() - t0;
    let count = 0;
    for (let i = 0; i < w * h; i++) {
      const a = sel[i] / 255;
      if (sel[i] >= 128) count++;
      const o = i * 4;
      img.data[o] = P.data[o] * (1 - 0.55 * a) + 143 * 0.55 * a;
      img.data[o + 1] = P.data[o + 1] * (1 - 0.55 * a) + 132 * 0.55 * a;
      img.data[o + 2] = P.data[o + 2] * (1 - 0.55 * a) + 255 * 0.55 * a;
      img.data[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    for (const [c, lw] of [['#fff', 3], ['#5847f0', 1.5]] as const) {
      g.strokeStyle = c;
      g.lineWidth = lw;
      g.beginPath();
      g.arc(st.cx + 0.5, st.cy + 0.5, 6, 0, Math.PI * 2);
      g.moveTo(st.cx - 10, st.cy + 0.5);
      g.lineTo(st.cx + 11, st.cy + 0.5);
      g.moveTo(st.cx + 0.5, st.cy - 10);
      g.lineTo(st.cx + 0.5, st.cy + 11);
      g.stroke();
    }
    const i = (st.y * w + st.x) * 4;
    note.textContent = `Seed (${st.x}, ${st.y}) = rgb(${P.data[i]}, ${P.data[i + 1]}, ${P.data[i + 2]}). Selected ${((100 * count) / (w * h)).toFixed(1)} % of the picture; re-threshold took ${ms.toFixed(1)} ms.`;
  };
  const pick = (x: number, y: number) => {
    st.x = st.cx = clamp(Math.floor(x), 0, w - 1);
    st.y = st.cy = clamp(Math.floor(y), 0, h - 1);
    st.dist = wandDistance(P.data, w, h, st.x, st.y);
    draw();
  };
  cv.addEventListener('click', (e) => pick(...canvasPoint(cv, e)));
  cv.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      return pick(st.cx, st.cy);
    }
    const s = e.shiftKey ? 20 : 4;
    const d = { ArrowLeft: [-s, 0], ArrowRight: [s, 0], ArrowUp: [0, -s], ArrowDown: [0, s] }[e.key];
    if (!d) return;
    e.preventDefault();
    st.cx = clamp(st.cx + d[0], 0, w - 1);
    st.cy = clamp(st.cy + d[1], 0, h - 1);
    draw();
  });
  for (const k of ['tol', 'soft']) inp(k).addEventListener('input', draw);
  inp('contig').addEventListener('change', draw);
  live(el);
  pick(st.x, st.y);
}
