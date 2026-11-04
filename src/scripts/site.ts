// Site-wide progressive enhancements. Everything works without this file.
import { initScenes } from './scenes';

// Nav: transparent over the hero, solid once the page has scrolled past it.
const nav = document.querySelector<HTMLElement>('[data-nav]');
if (nav) {
  const onScroll = () => nav.classList.toggle('is-scrolled', scrollY > innerHeight * 0.6);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

// Close the menu sheet when one of its links is used.
document.querySelectorAll<HTMLElement>('[popover]').forEach((sheet) => {
  sheet.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('a') && 'hidePopover' in sheet) sheet.hidePopover();
  });
});

// Reveal: only elements still below the fold are held back, then shown as they arrive.
if (!matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.remove('reveal-pending');
          io.unobserve(e.target);
        }
      }
    },
    { rootMargin: '0px 0px -10% 0px' },
  );
  for (const el of document.querySelectorAll<HTMLElement>('[data-reveal], [data-split]')) {
    if (el.getBoundingClientRect().top > innerHeight * 0.9) {
      el.classList.add('reveal-pending');
      io.observe(el);
    }
  }
}

// Magnetic buttons: a gentle pull towards the pointer (fine pointers only).
if (matchMedia('(hover: hover) and (pointer: fine)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  for (const el of document.querySelectorAll<HTMLElement>('[data-magnetic]')) {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - (r.left + r.width / 2)) * 0.18;
      const y = (e.clientY - (r.top + r.height / 2)) * 0.28;
      el.style.translate = `${x.toFixed(1)}px ${y.toFixed(1)}px`;
    });
    el.addEventListener('pointerleave', () => (el.style.translate = ''));
  }
}

// Copy buttons (checksums, commands). Text comes from the element named by data-copy.
for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-copy]')) {
  btn.hidden = false;
  btn.addEventListener('click', async () => {
    const source = document.getElementById(btn.dataset.copy!);
    if (!source) return;
    const label = btn.textContent;
    try {
      await navigator.clipboard.writeText(source.textContent!.trim());
      btn.textContent = 'Copied';
    } catch {
      btn.textContent = 'Press ⌘C to copy';
      const range = document.createRange();
      range.selectNodeContents(source);
      getSelection()?.removeAllRanges();
      getSelection()?.addRange(range);
    }
    setTimeout(() => (btn.textContent = label), 1800);
  });
}

initScenes();
