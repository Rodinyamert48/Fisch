/** Küçük DOM yardımcıları. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string | null,
  text?: string | null,
  parent?: HTMLElement | null,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}

export function button(text: string, cls: string, onClick: () => void, parent?: HTMLElement | null): HTMLButtonElement {
  const b = el('button', `btn ${cls}`.trim(), text, parent);
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
  });
  return b;
}

export function clear(e: HTMLElement): void {
  while (e.firstChild) e.removeChild(e.firstChild);
}

/** Basit SVG balık simgesi (çekme oyunu için). */
export function fishSvg(color: string): string {
  return `<svg viewBox="0 0 46 30" width="46" height="30" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 15 L0 4 L12 11 Q22 2 34 6 Q46 10 45 15 Q46 20 34 24 Q22 28 12 19 L0 26 Z" fill="${color}" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="36" cy="13" r="2.6" fill="#111"/>
  </svg>`;
}
