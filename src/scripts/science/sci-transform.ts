// Chapter 5: a layer transform you can drag, with its matrix built exactly as CutOut builds it,
// and three layers you can restack.
import { live } from './sci-util';
import { layerMatrix } from './sci-lib';

export function init(el: HTMLElement) {
  const pw = Number(el.dataset.w), ph = Number(el.dataset.h);
  const svg = el.querySelector<SVGSVGElement>('[data-xf-svg]')!;
  const group = el.querySelector<SVGGElement>('g[data-xf-m]')!;
  const puppy = el.querySelector<SVGGElement>('[data-xf-puppy]')!;
  const stack = el.querySelector<SVGGElement>('[data-xf-layers]')!;
  const list = el.querySelector<HTMLOListElement>('[data-xf-order]')!;
  const input = (k: string) => el.querySelector<HTMLInputElement>(`[data-xf="${k}"]`)!;
  const out = (k: string) => el.querySelector<HTMLElement>(`[data-xf-out="${k}"]`)!;
  const cell = (k: string) => el.querySelector<HTMLElement>(`mn[data-xf-m="${k}"]`)!;

  const update = () => {
    const x = Number(input('x').value), y = Number(input('y').value);
    const s = Number(input('s').value) / 100, deg = Number(input('r').value);
    const m = layerMatrix(x, y, s, s, (deg * Math.PI) / 180, pw, ph);
    group.setAttribute('transform', `matrix(${m.map((v) => v.toFixed(5)).join(' ')})`);
    const names = ['a', 'b', 'c', 'd', 'e', 'f'];
    names.forEach((n, i) => (cell(n).textContent = (i < 4 ? m[i].toFixed(3) : m[i].toFixed(1)).replace('-0.000', '0.000')));
    out('x').textContent = String(x);
    out('y').textContent = String(y);
    out('s').textContent = `${Math.round(s * 100)} %`;
    out('r').textContent = `${deg}°`;
  };
  for (const k of ['x', 'y', 's', 'r']) input(k).addEventListener('input', update);

  // Drag the puppy: convert pointer movement into SVG units through the screen matrix.
  let drag: { px: number; py: number; x: number; y: number } | null = null;
  const toSvg = (e: PointerEvent) => {
    const p = svg.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    return p.matrixTransform(svg.getScreenCTM()!.inverse());
  };
  puppy.addEventListener('pointerdown', (e) => {
    const p = toSvg(e);
    drag = { px: p.x, py: p.y, x: Number(input('x').value), y: Number(input('y').value) };
    puppy.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  puppy.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const p = toSvg(e);
    input('x').value = String(Math.round(drag.x + p.x - drag.px));
    input('y').value = String(Math.round(drag.y + p.y - drag.py));
    update();
  });
  const end = () => (drag = null);
  puppy.addEventListener('pointerup', end);
  puppy.addEventListener('pointercancel', end);

  // Restacking: the list is top-first, the SVG is bottom-first (painter's order = "over").
  const sync = () => {
    const items = [...list.children] as HTMLElement[];
    items.forEach((li, i) => {
      li.querySelector<HTMLButtonElement>('[data-xf-move="up"]')!.disabled = i === 0;
      li.querySelector<HTMLButtonElement>('[data-xf-move="down"]')!.disabled = i === items.length - 1;
    });
    for (const li of [...items].reverse()) stack.appendChild(stack.querySelector(`[data-xf-layer="${li.dataset.xfItem}"]`)!);
  };
  list.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-xf-move]');
    if (!b) return;
    const li = b.closest('li')!;
    if (b.dataset.xfMove === 'up' && li.previousElementSibling) list.insertBefore(li, li.previousElementSibling);
    if (b.dataset.xfMove === 'down' && li.nextElementSibling) list.insertBefore(li.nextElementSibling, li);
    sync();
    (b.disabled ? li.querySelector<HTMLButtonElement>('[data-xf-move]:not(:disabled)') : b)?.focus();
  });

  live(el);
  sync();
  update();
}
