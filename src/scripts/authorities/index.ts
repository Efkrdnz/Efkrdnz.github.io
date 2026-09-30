/* The Authorities guide: one chapter shown at a time, chosen from the picker,
   the bar or the URL hash, and each chapter's toy loaded the first time the
   chapter is opened - seven small programs, none of which a reader pays for
   until they look at it. */

type Mount = (el: HTMLElement, color: string) => void;

const TOYS: Record<string, () => Promise<{ mount: Mount }>> = {
  space: () => import('./space'),
  soul: () => import('./soul'),
  mana: () => import('./mana'),
  chaos: () => import('./chaos'),
  causality: () => import('./causality'),
  mind: () => import('./mind'),
  sound: () => import('./sound'),
};

export function initAuthorities(): void {
  const root = document.querySelector<HTMLElement>('[data-authorities]');
  if (!root) return;
  root.classList.add('js-auth');

  const chapters = [...root.querySelectorAll<HTMLElement>('[data-chap]')];
  const picks = [...root.querySelectorAll<HTMLButtonElement>('[data-pick]')];
  const chips = [...root.querySelectorAll<HTMLAnchorElement>('[data-chip]')];
  const mounted = new Set<string>();
  const ids = chapters.map((c) => c.dataset.chap!);

  const mountToy = (id: string) => {
    if (mounted.has(id)) return;
    mounted.add(id);
    const chap = chapters.find((c) => c.dataset.chap === id);
    const stage = chap?.querySelector<HTMLElement>('[data-toy]');
    const color = chap ? getComputedStyle(chap).getPropertyValue('--c').trim() : '';
    if (!stage || !TOYS[id]) return;
    TOYS[id]()
      .then((m) => {
        stage.textContent = '';
        m.mount(stage, color || '#8FD3EC');
      })
      .catch(() => {
        stage.textContent = 'This toy failed to load.';
      });
  };

  const activate = (id: string, scroll: boolean) => {
    if (!ids.includes(id)) return;
    for (const c of chapters) c.dataset.active = c.dataset.chap === id ? 'true' : 'false';
    for (const p of picks) p.setAttribute('aria-selected', p.dataset.pick === id ? 'true' : 'false');
    for (const c of chips) c.setAttribute('aria-current', c.dataset.chip === id ? 'true' : 'false');
    mountToy(id);
    if (scroll) document.getElementById('authorities')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  for (const p of picks) {
    p.addEventListener('click', () => {
      const id = p.dataset.pick!;
      history.replaceState(null, '', `#${id}`);
      activate(id, false);
    });
    p.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const i = picks.indexOf(p);
      const next = picks[(i + (e.key === 'ArrowRight' ? 1 : picks.length - 1)) % picks.length];
      next.focus();
      next.click();
    });
  }

  /* The bar's chips and the iceberg's jump links are plain #id anchors, so
     they work without this script; with it, they open the chapter too. */
  const fromHash = (scroll: boolean) => {
    const id = location.hash.slice(1);
    if (ids.includes(id)) activate(id, scroll);
  };
  window.addEventListener('hashchange', () => fromHash(true));

  if (ids.includes(location.hash.slice(1))) fromHash(true);
  else activate(ids[0], false);

  initIceberg(root);
}

function initIceberg(root: HTMLElement): void {
  const bands = [...root.querySelectorAll<SVGGElement>('[data-layer]')];
  const cards = [...root.querySelectorAll<HTMLElement>('[data-layer-card]')];
  const show = (id: string) => {
    for (const b of bands) b.setAttribute('aria-pressed', b.dataset.layer === id ? 'true' : 'false');
    for (const c of cards) c.hidden = c.dataset.layerCard !== id;
  };
  for (const b of bands) {
    b.addEventListener('click', () => show(b.dataset.layer!));
    b.addEventListener('mouseenter', () => show(b.dataset.layer!));
    b.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        show(b.dataset.layer!);
      }
    });
  }
  show('authorities');
}
