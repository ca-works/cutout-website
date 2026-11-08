// Chapter 6: the bits of a number in FP32 and FP16, and what rounding costs.
import { f16Bits, f16FromBits, f32Bits, f32FromBits } from './sci-lib';
import { live } from './sci-util';

export function init(el: HTMLElement) {
  const input = el.querySelector<HTMLInputElement>('[data-fp-in]')!;
  const show = (k: '32' | '16', bits: number, value: number, v: number) => {
    const cells = el.querySelectorAll<HTMLElement>(`[data-fp-bits="${k}"] .bit`);
    const nb = Number(k);
    cells.forEach((c, i) => {
      const b = (bits >>> (nb - 1 - i)) & 1;
      c.textContent = String(b);
      c.classList.toggle('is-1', b === 1);
    });
    const line = el.querySelector<HTMLElement>(`[data-fp-val="${k}"]`)!;
    line.replaceChildren();
    const strong = document.createElement('strong');
    if (!Number.isFinite(value)) {
      strong.textContent = value > 0 ? '+∞' : '−∞';
      line.append('Stored as ', strong, ' — too large for this format (overflow).');
      return;
    }
    strong.textContent = value === 0 && v !== 0 ? '0' : value.toPrecision(k === '32' ? 9 : 5).replace(/\.?0+(e|$)/, '$1');
    const err = Math.abs(value - v);
    const rel = v ? err / Math.abs(v) : 0;
    line.append(
      'Stored as ',
      strong,
      err === 0 ? ' — exact.' : ` — off by ${err.toPrecision(2)} (${rel < 1e-3 ? rel.toExponential(1) : (rel * 100).toPrecision(2) + ' %'} of the value).`,
    );
    if (value === 0 && v !== 0) line.append(' Too small: it underflows to zero.');
  };
  const update = () => {
    const v = Number(input.value.replace(/\s/g, '').replace(',', '.'));
    if (!Number.isFinite(v)) return;
    const b32 = f32Bits(v);
    show('32', b32, f32FromBits(b32), v);
    const b16 = f16Bits(v);
    show('16', b16, f16FromBits(b16), v);
  };
  input.addEventListener('input', update);
  for (const b of el.querySelectorAll<HTMLButtonElement>('[data-fp-preset]'))
    b.addEventListener('click', () => {
      input.value = b.dataset.fpPreset!;
      update();
    });
  live(el);
  update();
}
