// Chapter 2: the alpha-compositing laboratory. F is the photo, α is CutOut's real matte for it,
// B is a chosen background; C = αF + (1 − α)B is computed here for every pixel and shown with the
// numbers for one of them.
import { canvasPoint, clamp, live, pixelsOf, radios } from './sci-util';
import { mul255 } from './sci-lib';

const BG: Record<string, [number, number, number] | 'split'> = {
  split: 'split',
  grey: [138, 138, 146],
  white: [255, 255, 255],
  black: [0, 0, 0],
  violet: [88, 71, 240],
};
const LEFT: [number, number, number] = [236, 231, 220];
const RIGHT: [number, number, number] = [29, 53, 87];

export async function init(el: HTMLElement) {
  const [F, A] = await Promise.all([pixelsOf(el.dataset.rgb!), pixelsOf(el.dataset.matte!)]);
  const { w, h } = F;
  const cv = el.querySelector<HTMLCanvasElement>('[data-al-canvas]')!;
  const g = cv.getContext('2d')!;
  const out = new ImageData(w, h);
  const q = <T extends Element = HTMLElement>(s: string) => el.querySelector<T>(s)!;
  const opIn = q<HTMLInputElement>('[data-al-op]');
  const dxIn = q<HTMLInputElement>('[data-al-dx]');
  const st = { px: Number(el.dataset.px), py: Number(el.dataset.py), dx: 0, op: 1, bg: 'split', mode: 'soft' };

  const bgAt = (x: number): [number, number, number] => {
    const b = BG[st.bg];
    return b === 'split' ? (x < w / 2 ? LEFT : RIGHT) : b;
  };
  /** α of the layer at canvas pixel (x, y), 0..255, after mode and opacity. */
  const alphaAt = (x: number, y: number) => {
    const sx = x - st.dx;
    if (sx < 0 || sx >= w) return 0;
    let a = A.data[(y * w + sx) * 4];
    if (st.mode === 'hard') a = a >= 128 ? 255 : 0;
    return a * st.op;
  };

  const render = () => {
    const d = out.data;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 4;
        const a = alphaAt(x, y) / 255;
        if (st.mode === 'alpha') {
          const v = Math.round(a * 255);
          d[o] = d[o + 1] = d[o + 2] = v;
        } else {
          const b = bgAt(x);
          const sx = clamp(x - st.dx, 0, w - 1);
          const i = (y * w + sx) * 4;
          d[o] = a * F.data[i] + (1 - a) * b[0];
          d[o + 1] = a * F.data[i + 1] + (1 - a) * b[1];
          d[o + 2] = a * F.data[i + 2] + (1 - a) * b[2];
        }
        d[o + 3] = 255;
      }
    g.putImageData(out, 0, 0);
    // cross-hair on the probed pixel
    g.strokeStyle = '#fff';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(st.px + 0.5, st.py + 0.5, 9, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = '#8f84ff';
    g.lineWidth = 1.5;
    g.stroke();
    readout();
  };

  const readout = () => {
    const x = st.px, y = st.py;
    const a8 = Math.round(alphaAt(x, y));
    const a = alphaAt(x, y) / 255;
    const sx = clamp(x - st.dx, 0, w - 1);
    const i = (y * w + sx) * 4;
    const f = [F.data[i], F.data[i + 1], F.data[i + 2]];
    const b = bgAt(x);
    const c = f.map((v, k) => Math.round(a * v + (1 - a) * b[k]));
    q('[data-al-xy]').textContent = `(${x}, ${y})`;
    q('[data-al-a]').textContent = a.toFixed(2);
    q('[data-al-ia]').textContent = (1 - a).toFixed(2);
    for (let k = 0; k < 3; k++) {
      q(`[data-al-v="f${k}"]`).textContent = String(f[k]);
      q(`[data-al-v="b${k}"]`).textContent = String(b[k]);
      q(`[data-al-v="c${k}"]`).textContent = String(c[k]);
    }
    q('[data-al-sw="f"]').style.setProperty('background', `rgb(${f.join(' ')})`);
    q('[data-al-sw="b"]').style.setProperty('background', `rgb(${b.join(' ')})`);
    q('[data-al-sw="c"]').style.setProperty('background', `rgb(${c.join(' ')})`);
    q('[data-al-note]').textContent =
      a8 === 255 ? 'Fully opaque: the background is invisible, C = F.' : a8 === 0 ? 'Fully transparent: only the background shows, C = B.' : `Partly transparent: ${Math.round(a * 100)} % subject, ${Math.round((1 - a) * 100)} % background.`;
    q('[data-al-s]').textContent = `(${f.join(', ')}, α ${a8})`;
    q('[data-al-p]').textContent = `(${f.map((v) => mul255(v, a8)).join(', ')}, α ${a8})`;
  };

  opIn.addEventListener('input', () => {
    st.op = Number(opIn.value) / 100;
    q('[data-al-op-out]').textContent = `${opIn.value} %`;
    render();
  });
  const setDx = (v: number) => {
    st.dx = Math.round(clamp(v, -260, 260));
    dxIn.value = String(st.dx);
    q('[data-al-dx-out]').textContent = `${st.dx > 0 ? '+' : ''}${st.dx} px`;
    render();
  };
  dxIn.addEventListener('input', () => setDx(Number(dxIn.value)));
  radios(q('[aria-labelledby="al-bg-label"]'), (b) => {
    st.bg = b.dataset.alBg!;
    render();
  });
  radios(q('[aria-labelledby="al-mode-label"]'), (b) => {
    st.mode = b.dataset.alMode!;
    render();
  });

  // Click/tap: inspect a pixel. Horizontal drag: move the puppy (vertical swipes still scroll).
  let drag: { x: number; dx: number; moved: boolean } | null = null;
  cv.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, dx: st.dx, moved: false };
    cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const r = cv.getBoundingClientRect();
    const moveX = ((e.clientX - drag.x) / r.width) * w;
    if (Math.abs(moveX) > 6) drag.moved = true;
    if (drag.moved) setDx(drag.dx + moveX);
  });
  cv.addEventListener('pointerup', (e) => {
    if (drag && !drag.moved) {
      const [x, y] = canvasPoint(cv, e);
      st.px = clamp(Math.floor(x), 0, w - 1);
      st.py = clamp(Math.floor(y), 0, h - 1);
      render();
    }
    drag = null;
  });
  cv.addEventListener('pointercancel', () => (drag = null));
  cv.addEventListener('keydown', (e) => {
    const s = e.shiftKey ? 10 : 1;
    const d = { ArrowLeft: [-s, 0], ArrowRight: [s, 0], ArrowUp: [0, -s], ArrowDown: [0, s] }[e.key];
    if (!d) return;
    e.preventDefault();
    st.px = clamp(st.px + d[0], 0, w - 1);
    st.py = clamp(st.py + d[1], 0, h - 1);
    render();
  });

  live(el);
  render();
}
