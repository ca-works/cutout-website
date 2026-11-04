// Scroll scenes: every element with [data-scene] is a tall track whose sticky .pin child is
// pinned by CSS. This module measures how far the visitor has scrolled through each track and
// writes it to the element as --p (0–1), plus named sub-ranges declared in data-ranges, e.g.
//   data-ranges="in:0-.3 out:.7-1"  →  --in, --out
// CSS drives the animation with calc(). Native scrolling is never intercepted: positions are only
// read, once per frame, while a scene is on screen. The visual value follows the scroll position
// with a short critically damped lag (τ ≈ 80 ms) so wheel steps don't look jumpy.
//
// JavaScript handlers can subscribe for richer effects (the hero's WebGL, the key sequence).

type Handler = (p: number) => void;
interface Scene {
  el: HTMLElement;
  ranges: { name: string; a: number; b: number }[];
  target: number;
  current: number;
  visible: boolean;
  handlers: Handler[];
}

const scenes = new Map<Element, Scene>();
const pending = new Map<Element, Handler[]>();
let raf = 0;
let last = 0;
let reduced = false;

const clamp = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

function parseRanges(el: HTMLElement) {
  return (el.dataset.ranges ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map((r) => {
      const [name, span] = r.split(':');
      const [a, b] = span.split('-').map(Number);
      return { name: `--${name}`, a, b };
    });
}

function write(s: Scene, p: number) {
  s.el.style.setProperty('--p', p.toFixed(4));
  for (const { name, a, b } of s.ranges) s.el.style.setProperty(name, clamp((p - a) / (b - a)).toFixed(4));
  for (const h of s.handlers) h(p);
}

function measure(s: Scene) {
  const r = s.el.getBoundingClientRect();
  const travel = r.height - innerHeight;
  s.target = travel > 0 ? clamp(-r.top / travel) : r.top < innerHeight / 2 ? 1 : 0;
}

function frame(now: number) {
  raf = 0;
  const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
  last = now;
  let moving = false;
  for (const s of scenes.values()) {
    if (!s.visible) continue;
    measure(s);
    const next = s.current + (s.target - s.current) * (1 - Math.exp(-dt / 0.08));
    const settled = Math.abs(s.target - next) < 0.0004;
    const value = settled ? s.target : next;
    if (value !== s.current) {
      s.current = value;
      write(s, value);
    }
    if (!settled) moving = true;
  }
  if (moving) raf = requestAnimationFrame(frame);
  else last = 0;
}

const schedule = () => {
  if (!raf && !reduced) raf = requestAnimationFrame(frame);
};

/** Subscribe to a scene's (smoothed) progress. Safe to call before initScenes(). */
export function onScene(el: Element, fn: Handler) {
  const s = scenes.get(el);
  if (s) s.handlers.push(fn);
  else pending.set(el, [...(pending.get(el) ?? []), fn]);
}

export function initScenes() {
  const mq = matchMedia('(prefers-reduced-motion: reduce)');
  reduced = mq.matches;
  mq.addEventListener('change', () => location.reload());
  const els = [...document.querySelectorAll<HTMLElement>('[data-scene]')];
  for (const el of els) {
    const s: Scene = { el, ranges: parseRanges(el), target: 0, current: -1, visible: false, handlers: pending.get(el) ?? [] };
    scenes.set(el, s);
    if (reduced) {
      // Without motion every scene shows its finished state.
      s.current = 1;
      write(s, 1);
      continue;
    }
    measure(s);
    s.current = s.target;
    write(s, s.current);
  }
  if (reduced) return;
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const s = scenes.get(e.target)!;
        s.visible = e.isIntersecting;
        if (!s.visible) {
          // Settle at the nearest end so nothing is left half-way off screen.
          measure(s);
          s.current = s.target;
          write(s, s.current);
        }
      }
      schedule();
    },
    { rootMargin: '15% 0px' },
  );
  for (const el of els) io.observe(el);
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule, { passive: true });
}
