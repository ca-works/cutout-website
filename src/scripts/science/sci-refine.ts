// Chapter 5: Refine Edges on a real one-dimensional slice of CutOut's matte.
import { live } from './sci-util';
import { refineProfile } from './sci-lib';

export function init(el: HTMLElement) {
  const panel = el.querySelector<HTMLElement>('[data-rf]')!;
  const refined: number[] = JSON.parse(panel.dataset.refined!);
  const n = refined.length;
  const path = (a: number[]) => a.map((v, i) => `${i ? 'L' : 'M'}${(40 + (660 * i) / (n - 1)).toFixed(1)} ${(260 - (240 * v) / 255).toFixed(1)}`).join(' ');
  const set = (k: string, a: number[]) => el.querySelector(`[data-rf-path="${k}"]`)!.setAttribute('d', path(a));
  const inp = (k: string) => el.querySelector<HTMLInputElement>(`[data-rf-in="${k}"]`)!;
  const keys = ['smooth', 'shift', 'contrast', 'feather'] as const;
  const update = () => {
    const p = Object.fromEntries(keys.map((k) => [k, Number(inp(k).value)])) as Record<(typeof keys)[number], number>;
    for (const k of keys) el.querySelector(`[data-rf-out="${k}"]`)!.textContent = String(p[k]);
    set('out', refineProfile(refined, p));
  };
  for (const k of keys) inp(k).addEventListener('input', update);
  live(el);
  update();
}
