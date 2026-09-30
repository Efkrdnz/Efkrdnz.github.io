/* The little DOM kit every toy is built from. No framework: seven toys, each
   a few dozen elements, and the page must work before any of them loads. */

type Attrs = Record<string, string | number | boolean | undefined | ((e: Event) => void)>;
type Child = Node | string | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (typeof v === 'function') el.addEventListener(k.replace(/^on/, ''), v as EventListener);
    else if (k === 'class') el.className = String(v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return el;
}

export function button(label: string, onClick: () => void, cls = 'tbtn'): HTMLButtonElement {
  return h('button', { type: 'button', class: cls, onclick: onClick }, label);
}

export function select(options: { value: string; label: string }[], onChange: (v: string) => void): HTMLSelectElement {
  const s = h('select', { class: 'tselect' });
  for (const o of options) s.append(h('option', { value: o.value }, o.label));
  s.addEventListener('change', () => onChange(s.value));
  return s;
}

export function setOptions(s: HTMLSelectElement, options: { value: string; label: string }[]): void {
  s.textContent = '';
  for (const o of options) s.append(h('option', { value: o.value }, o.label));
}

/** A canvas sized for the device's pixels and drawn in CSS pixels. */
export function canvas(w: number, ht: number): { el: HTMLCanvasElement; ctx: CanvasRenderingContext2D; w: number; h: number } {
  const el = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  el.width = Math.round(w * dpr);
  el.height = Math.round(ht * dpr);
  el.className = 'tcanvas';
  el.style.aspectRatio = `${w} / ${ht}`;
  const ctx = el.getContext('2d')!;
  ctx.scale(dpr, dpr);
  return { el, ctx, w, h: ht };
}

/** Where a pointer event landed, in the canvas's own CSS-pixel space. */
export function pointer(el: HTMLCanvasElement, e: MouseEvent, w: number, ht: number): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * w, y: ((e.clientY - r.top) / r.height) * ht };
}

export const reduced = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A requestAnimationFrame loop that runs only while its element is on screen. */
export function loop(el: Element, frame: (dt: number) => void): void {
  let visible = false;
  let last = 0;
  let raf = 0;
  const tick = (t: number) => {
    const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
    last = t;
    frame(dt);
    if (visible) raf = requestAnimationFrame(tick);
  };
  new IntersectionObserver((entries) => {
    const now = entries.some((e) => e.isIntersecting);
    if (now && !visible) {
      visible = true;
      last = 0;
      raf = requestAnimationFrame(tick);
    } else if (!now && visible) {
      visible = false;
      cancelAnimationFrame(raf);
    }
  }).observe(el);
}

export function alpha(hex: string, a: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
