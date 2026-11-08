// Chapter 3: the architecture diagram (choose a block, switch plain/technical) and the stride
// grid over the network's input.
import { live, radios } from './sci-util';

export function init(el: HTMLElement) {
  if (el.dataset.sci === 'grid') return grid(el);
  const btns = [...el.querySelectorAll<HTMLButtonElement>('[data-arch-node]')];
  const details = [...el.querySelectorAll<HTMLElement>('[data-arch-for]')];
  const show = (id: string) => {
    for (const b of btns) b.setAttribute('aria-pressed', String(b.dataset.archNode === id));
    for (const d of details) d.hidden = d.dataset.archFor !== id;
  };
  for (const b of btns) b.addEventListener('click', () => show(b.dataset.archNode!));
  el.dataset.mode = 'plain';
  radios(el.querySelector('[data-arch-modes]')!, (b) => (el.dataset.mode = b.dataset.archMode!));
  live(el);
}

function grid(el: HTMLElement) {
  const lines = el.querySelector<HTMLElement>('[data-grid-lines]')!;
  const out = el.querySelector<HTMLElement>('[data-grid-out]')!;
  radios(el.querySelector('[data-grid-stages]')!, (b) => {
    const s = Number(b.dataset.gridStride);
    const n = 1024 / s;
    lines.style.setProperty('--n', String(n));
    const stage = [4, 8, 16, 32].indexOf(s) + 1;
    out.textContent = `Stage ${stage}: stride ${s}, a ${n} × ${n} grid, ${(n * n).toLocaleString('en-GB')} positions.`;
  });
  live(el);
}
