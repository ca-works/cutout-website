// Chapter 1: the pixel microscope. Real pixels of a lossless crop, magnified with nearest-
// neighbour sampling so every square is exactly one stored value.
import { canvasPoint, clamp, live, pixelsOf } from './sci-util';

const RES = ['Full', '½', '¼', '⅛', '1⁄16', '1⁄32'];

export async function init(el: HTMLElement) {
  const src = await pixelsOf(el.dataset.src!);
  const { w, h } = src;
  const x0 = Number(el.dataset.x0), y0 = Number(el.dataset.y0), fw = Number(el.dataset.fw);
  const cv = el.querySelector<HTMLCanvasElement>('[data-px-canvas]')!;
  const g = cv.getContext('2d')!;
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  const og = off.getContext('2d')!;
  const view = new ImageData(w, h);
  const q = <T extends Element>(s: string) => el.querySelector<T>(s)!;
  const zoomIn = q<HTMLInputElement>('[data-px-zoom]');
  const resIn = q<HTMLInputElement>('[data-px-res]');
  const chBtns = [...el.querySelectorAll<HTMLButtonElement>('[data-px-ch]')];
  const st = { x: 103, y: 46, zoom: 4, ch: [1, 1, 1], block: 1 };

  const rebuild = () => {
    const b = st.block;
    const d = view.data, s = src.data;
    for (let by = 0; by < h; by += b)
      for (let bx = 0; bx < w; bx += b) {
        let r = 0, gg = 0, bl = 0, n = 0;
        for (let y = by; y < Math.min(h, by + b); y++)
          for (let x = bx; x < Math.min(w, bx + b); x++) {
            const i = (y * w + x) * 4;
            r += s[i];
            gg += s[i + 1];
            bl += s[i + 2];
            n++;
          }
        const v = [Math.round(r / n) * st.ch[0], Math.round(gg / n) * st.ch[1], Math.round(bl / n) * st.ch[2]];
        for (let y = by; y < Math.min(h, by + b); y++)
          for (let x = bx; x < Math.min(w, bx + b); x++) {
            const i = (y * w + x) * 4;
            d[i] = v[0];
            d[i + 1] = v[1];
            d[i + 2] = v[2];
            d[i + 3] = 255;
          }
      }
    og.putImageData(view, 0, 0);
  };

  const viewport = () => {
    const vw = w / st.zoom, vh = h / st.zoom;
    const sx = clamp(st.x + 0.5 - vw / 2, 0, w - vw);
    const sy = clamp(st.y + 0.5 - vh / 2, 0, h - vh);
    return { sx, sy, vw, vh, k: cv.width / vw };
  };

  const draw = () => {
    const { sx, sy, vw, vh, k } = viewport();
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, cv.width, cv.height);
    g.drawImage(off, sx, sy, vw, vh, 0, 0, cv.width, cv.height);
    const fx = Math.floor(sx), fy = Math.floor(sy);
    if (k >= 12) {
      g.strokeStyle = 'rgba(0,0,0,0.35)';
      g.lineWidth = 1;
      g.beginPath();
      for (let x = fx; x <= sx + vw + 1; x++) {
        const X = Math.round((x - sx) * k) + 0.5;
        g.moveTo(X, 0);
        g.lineTo(X, cv.height);
      }
      for (let y = fy; y <= sy + vh + 1; y++) {
        const Y = Math.round((y - sy) * k) + 0.5;
        g.moveTo(0, Y);
        g.lineTo(cv.width, Y);
      }
      g.stroke();
    }
    if (k >= 58) {
      g.font = `600 ${Math.min(15, k / 5)}px "Mona Sans Variable", system-ui, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      for (let y = fy; y < sy + vh; y++)
        for (let x = fx; x < sx + vw; x++) {
          const i = (y * w + x) * 4;
          const d = view.data;
          const lum = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
          const cx = (x + 0.5 - sx) * k, cy = (y + 0.5 - sy) * k;
          const line = Math.min(17, k / 4.2);
          const cols = lum > 140 ? ['#a01414', '#0b6b37', '#1d3fa8'] : ['#ffb3b3', '#a9f5c8', '#c3d4ff'];
          for (let c = 0; c < 3; c++) {
            g.fillStyle = cols[c];
            g.fillText(String(d[i + c]), cx, cy + (c - 1) * line);
          }
        }
    }
    // selected pixel
    const X = (st.x - sx) * k, Y = (st.y - sy) * k;
    g.lineWidth = Math.max(2, Math.min(4, k / 10));
    g.strokeStyle = '#ffffff';
    g.strokeRect(X - 2, Y - 2, Math.max(k, 3) + 4, Math.max(k, 3) + 4);
    g.strokeStyle = '#8f84ff';
    g.strokeRect(X, Y, Math.max(k, 3), Math.max(k, 3));
    readout();
  };

  const readout = () => {
    const i = (st.y * w + st.x) * 4;
    const [r, gg, b] = [view.data[i], view.data[i + 1], view.data[i + 2]];
    q('[data-px-x]').textContent = `x = ${x0 + st.x}`;
    q('[data-px-y]').textContent = `y = ${y0 + st.y}`;
    q('[data-px-r]').textContent = String(r);
    q('[data-px-g]').textContent = String(gg);
    q('[data-px-b]').textContent = String(b);
    q<HTMLElement>('[data-px-swatch]').style.setProperty('background', `rgb(${r} ${gg} ${b})`);
    for (const [k, v] of [['r', r], ['g', gg], ['b', b]] as const) q<HTMLElement>(`[data-px-bar="${k}"]`).style.setProperty('width', `${(v / 255) * 100}%`);
    q('[data-px-hex]').textContent = `Hex #${[r, gg, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()} · stored at byte ${(4 * ((y0 + st.y) * fw + x0 + st.x)).toLocaleString('en-GB')} of the decoded photo`;
  };

  const setZoom = () => {
    st.zoom = Math.round(48 ** (Number(zoomIn.value) / 100) * 10) / 10;
    q('[data-px-zoom-out]').textContent = `×${st.zoom < 10 ? st.zoom.toFixed(1) : Math.round(st.zoom)}`;
    draw();
  };
  zoomIn.addEventListener('input', setZoom);
  resIn.addEventListener('input', () => {
    st.block = 2 ** Number(resIn.value);
    q('[data-px-res-out]').textContent = RES[Number(resIn.value)];
    rebuild();
    draw();
  });
  chBtns.forEach((b) =>
    b.addEventListener('click', () => {
      const c = Number(b.dataset.pxCh);
      st.ch[c] = st.ch[c] ? 0 : 1;
      b.setAttribute('aria-pressed', String(!!st.ch[c]));
      rebuild();
      draw();
    }),
  );
  cv.addEventListener('pointerdown', (e) => {
    const [px, py] = canvasPoint(cv, e);
    const { sx, sy, k } = viewport();
    st.x = clamp(Math.floor(sx + px / k), 0, w - 1);
    st.y = clamp(Math.floor(sy + py / k), 0, h - 1);
    draw();
  });
  cv.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 8 : 1;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!d) return;
    e.preventDefault();
    st.x = clamp(st.x + d[0], 0, w - 1);
    st.y = clamp(st.y + d[1], 0, h - 1);
    draw();
  });

  rebuild();
  live(el);
  setZoom();
}
