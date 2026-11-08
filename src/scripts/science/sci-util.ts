// Small helpers shared by the Science page demonstrations.

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Decode a same-origin image into RGBA pixels. */
export async function pixelsOf(src: string): Promise<{ data: Uint8ClampedArray; w: number; h: number; img: HTMLImageElement }> {
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(img, 0, 0);
  return { data: g.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height, img };
}

/** Marks a lab as interactive: shows its canvas and controls, hides the static fallback. */
export function live(el: HTMLElement) {
  el.classList.add('is-live');
  el.querySelectorAll<HTMLElement>('[data-lab-panel], [hidden][data-arch-modes], [hidden][data-grid-stages], [hidden][data-edge-views], [hidden][data-fp-presets]').forEach((p) => (p.hidden = false));
}

/**
 * A row of role="radio" buttons with roving focus (arrow keys move and select, as the ARIA
 * radio-group pattern specifies). Calls onChange with the chosen button.
 */
export function radios(group: Element, onChange: (b: HTMLButtonElement) => void) {
  const btns = [...group.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
  const select = (b: HTMLButtonElement, focus = false) => {
    for (const x of btns) {
      const on = x === b;
      x.setAttribute('aria-checked', String(on));
      x.tabIndex = on ? 0 : -1;
    }
    if (focus) b.focus();
    onChange(b);
  };
  for (const b of btns) {
    b.addEventListener('click', () => select(b));
    b.addEventListener('keydown', (e) => {
      const i = btns.indexOf(b);
      const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      select(btns[(i + d + btns.length) % btns.length], true);
    });
  }
  return select;
}

/** Pointer position in the canvas's own pixel coordinates. */
export function canvasPoint(c: HTMLCanvasElement, e: PointerEvent | MouseEvent): [number, number] {
  const r = c.getBoundingClientRect();
  return [((e.clientX - r.left) / r.width) * c.width, ((e.clientY - r.top) / r.height) * c.height];
}

export const fmt = (v: number, d = 2) => v.toFixed(d);
