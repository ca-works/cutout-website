// Site-wide progressive enhancements. Everything works without this file.

// Nav hairline once the page has scrolled.
const nav = document.querySelector<HTMLElement>('[data-nav]');
if (nav) {
  const onScroll = () => nav.classList.toggle('is-scrolled', scrollY > 8);
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
    { rootMargin: '0px 0px -8% 0px' },
  );
  for (const el of document.querySelectorAll<HTMLElement>('[data-reveal]')) {
    if (el.getBoundingClientRect().top > innerHeight) {
      el.classList.add('reveal-pending');
      io.observe(el);
    }
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
