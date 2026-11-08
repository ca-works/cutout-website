// Science page entry. Every demonstration is optional: the page reads completely without
// JavaScript. Each demo's code is fetched only when its figure approaches the viewport.
const loaders: Record<string, () => Promise<{ init: (el: HTMLElement) => void }>> = {
  pixels: () => import('./sci-pixels'),
  alpha: () => import('./sci-alpha'),
  model: () => import('./sci-model'),
  grid: () => import('./sci-model'),
  edges: () => import('./sci-edges'),
  transform: () => import('./sci-transform'),
  brush: () => import('./sci-brush'),
  wand: () => import('./sci-wand'),
  refine: () => import('./sci-refine'),
  float: () => import('./sci-float'),
};

const start = (el: HTMLElement) => {
  const kind = el.dataset.sci!;
  loaders[kind]?.()
    .then((m) => m.init(el))
    .catch((e) => console.warn(`science demo "${kind}" unavailable`, e));
};

const figures = [...document.querySelectorAll<HTMLElement>('[data-sci]')];
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        start(e.target as HTMLElement);
      }
    },
    { rootMargin: '600px 0px' },
  );
  figures.forEach((f) => io.observe(f));
} else figures.forEach(start);

const op = document.querySelector<HTMLElement>('[data-op]');
if (op) import('./sci-opening').then((m) => m.init(op));

// An equation wider than a phone scrolls inside its own box; make exactly those boxes reachable
// by keyboard (WCAG 2.1.1), and name them so the tab stop makes sense.
const scrollers = [...document.querySelectorAll<HTMLElement>('.eq__math')];
const markScrollers = () => {
  for (const s of scrollers) {
    const wide = s.scrollWidth > s.clientWidth + 1;
    if (wide) {
      s.tabIndex = 0;
      s.setAttribute('role', 'group');
      s.setAttribute('aria-label', 'Equation (scrolls sideways)');
    } else {
      s.removeAttribute('tabindex');
      s.removeAttribute('role');
      s.removeAttribute('aria-label');
    }
  }
};
markScrollers();
let resizeT = 0;
addEventListener('resize', () => {
  clearTimeout(resizeT);
  resizeT = window.setTimeout(markScrollers, 200);
});
