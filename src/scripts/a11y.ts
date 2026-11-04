// Accessible tabs and radio groups (WAI-ARIA Authoring Practices: roving tabindex, arrow keys,
// Home/End; tabs activate on focus, which suits instant, local panel changes).

function roving(
  group: HTMLElement,
  selector: string,
  attr: 'aria-selected' | 'aria-checked',
  onChange: (index: number, el: HTMLElement) => void,
) {
  const items = [...group.querySelectorAll<HTMLElement>(selector)];
  const select = (i: number, focus: boolean) => {
    items.forEach((el, j) => {
      el.setAttribute(attr, String(i === j));
      el.tabIndex = i === j ? 0 : -1;
    });
    if (focus) items[i].focus();
    onChange(i, items[i]);
  };
  items.forEach((el, i) => {
    el.addEventListener('click', () => select(i, false));
    el.addEventListener('keydown', (e) => {
      const n = items.length;
      const keys: Record<string, number> = {
        ArrowRight: (i + 1) % n,
        ArrowDown: (i + 1) % n,
        ArrowLeft: (i - 1 + n) % n,
        ArrowUp: (i - 1 + n) % n,
        Home: 0,
        End: n - 1,
      };
      if (e.key in keys) {
        e.preventDefault();
        select(keys[e.key], true);
      }
    });
  });
  return select;
}

export const wireTabs = (group: HTMLElement, onChange: (index: number) => void) =>
  roving(group, '[role="tab"]', 'aria-selected', (i) => onChange(i));

export const wireRadios = (group: HTMLElement, onChange: (value: string) => void) =>
  roving(group, '[role="radio"]', 'aria-checked', (_, el) => onChange(el.dataset.value!));
