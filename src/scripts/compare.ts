// Before/after comparison: one shared position across samples, pointer + touch + keyboard,
// with a short spring when the position jumps (click, Home/End). No layout is read per frame
// except the frame's rectangle at the start of a drag.

import { wireTabs, wireRadios } from './a11y';

export function initCompare() {
  const root = document.querySelector<HTMLElement>('[data-compare]');
  if (!root) return;
  const panels = [...root.querySelectorAll<HTMLElement>('[data-panel]')];
  const handles = [...root.querySelectorAll<HTMLElement>('[data-handle]')];
  const zoom = root.querySelector<HTMLButtonElement>('[data-zoom]')!;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  root.classList.add('is-enhanced');
  panels[0].classList.add('is-current');
  zoom.hidden = false;

  let pos = 50;
  let target = 50;
  let velocity = 0;
  let raf = 0;

  const apply = () => {
    root.style.setProperty('--pos', `${pos.toFixed(2)}%`);
    root.style.setProperty('--before-label', String(Math.min(1, Math.max(0, (pos - 14) / 10))));
    root.style.setProperty('--after-label', String(Math.min(1, Math.max(0, (86 - pos) / 10))));
    const v = Math.round(target);
    const text = v <= 2 ? 'Cutout only' : v >= 98 ? 'Original only' : `${v}% original, ${100 - v}% cutout`;
    for (const h of handles) {
      h.setAttribute('aria-valuenow', String(v));
      h.setAttribute('aria-valuetext', text);
    }
  };

  // Critically damped spring towards `target` (ω ≈ 22 rad/s): fast, no overshoot.
  const step = (now: number, last = now) => {
    const dt = Math.min(0.032, (now - last) / 1000 || 0.016);
    const w = 22;
    const x = pos - target;
    const a = -w * w * x - 2 * w * velocity;
    velocity += a * dt;
    pos += velocity * dt;
    if (Math.abs(pos - target) < 0.05 && Math.abs(velocity) < 0.05) {
      pos = target;
      velocity = 0;
      raf = 0;
    } else {
      raf = requestAnimationFrame((t) => step(t, now));
    }
    apply();
  };

  const set = (value: number, animate: boolean) => {
    target = Math.min(100, Math.max(0, value));
    if (!animate || reduced) {
      cancelAnimationFrame(raf);
      raf = 0;
      pos = target;
      velocity = 0;
      apply();
    } else if (!raf) {
      raf = requestAnimationFrame((t) => step(t));
    }
  };

  // Pointer: press anywhere on the picture to jump there, then drag.
  for (const panel of panels) {
    const frame = panel.querySelector<HTMLElement>('[data-frame]')!;
    let rect: DOMRect | null = null;
    let startX = 0;
    let startY = 0;
    let dragging = false;
    let decided = false;
    const fromEvent = (e: PointerEvent) => ((e.clientX - rect!.left) / rect!.width) * 100;

    // Images are natively draggable; a native drag would cancel the pointer stream.
    frame.addEventListener('dragstart', (e) => e.preventDefault());
    frame.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      rect = frame.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      decided = e.pointerType === 'mouse';
      dragging = decided;
      if (dragging) {
        frame.setPointerCapture(e.pointerId);
        root.classList.add('is-dragging');
        set(fromEvent(e), true);
      }
    });
    frame.addEventListener('pointermove', (e) => {
      if (!rect) return;
      if (!decided) {
        // Touch: a mostly-horizontal move takes over; a vertical one keeps scrolling the page.
        const dx = Math.abs(e.clientX - startX), dy = Math.abs(e.clientY - startY);
        if (dx < 6 && dy < 6) return;
        decided = true;
        dragging = dx > dy;
        if (dragging) {
          frame.setPointerCapture(e.pointerId);
          root.classList.add('is-dragging');
        }
      }
      if (dragging) set(fromEvent(e), false);
    });
    const end = (e: PointerEvent) => {
      if (rect && !decided && e.type === 'pointerup') set(fromEvent(e), true); // a tap
      rect = null;
      dragging = false;
      root.classList.remove('is-dragging');
    };
    frame.addEventListener('pointerup', end);
    frame.addEventListener('pointercancel', end);
  }

  // Keyboard on the handle.
  for (const h of handles) {
    h.addEventListener('keydown', (e) => {
      const big = e.shiftKey ? 10 : 2;
      const map: Record<string, number> = {
        ArrowLeft: target - big,
        ArrowDown: target - big,
        ArrowRight: target + big,
        ArrowUp: target + big,
        PageDown: target - 10,
        PageUp: target + 10,
        Home: 0,
        End: 100,
      };
      if (e.key in map) {
        e.preventDefault();
        set(map[e.key], e.key === 'Home' || e.key === 'End');
      }
    });
  }

  // Sample tabs and backdrop radios.
  wireTabs(root.querySelector('[data-tabs]')!, (index) => {
    panels.forEach((p, i) => p.classList.toggle('is-current', i === index));
  });
  wireRadios(root.querySelector('[data-backdrops]')!, (value) => {
    root.dataset.bg = value;
  });

  zoom.addEventListener('click', () => {
    const on = zoom.getAttribute('aria-pressed') !== 'true';
    zoom.setAttribute('aria-pressed', String(on));
    zoom.querySelector('span')!.textContent = on ? 'Zoom out' : 'Zoom';
    root.classList.toggle('is-zoomed', on);
  });

  apply();
}
