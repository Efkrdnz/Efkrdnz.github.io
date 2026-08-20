/**
 * The Codex — view switching, faceted filtering, the matrix, the panel.
 *
 * Everything here is enhancement. The three views, all 150 index rows and the
 * whole matrix are already in the document when this runs; the script adds
 * panning, focus, filtering and the detail panel on top. Nothing below is
 * required to read the data, which is why the noscript path is a sentence
 * rather than a fallback renderer.
 */

type Ability = {
  stone: string;
  power: number;
  key: string;
  ref: string;
  name: string;
  desc: string;
  control: string;
  hint: string;
  role: string;
  origin: 'original' | 'expanded';
};

type Stone = {
  key: string;
  id: number;
  name: string;
  lore: string;
  domain: string;
  summary: string;
  reads: string;
  color: string;
  color2: string;
  count: number;
  original: number;
  roles: Record<string, number>;
  retired: number[];
  signature: string[];
};

type Data = {
  stones: Stone[];
  abilities: Ability[];
  controls: Record<string, { label: string; note: string }>;
  roles: Record<string, string>;
};

type View = 'stones' | 'matrix' | 'index';

const VIEWS: View[] = ['stones', 'matrix', 'index'];

export function initCodex(): void {
  const root = document.querySelector<HTMLElement>('[data-codex]');
  const raw = document.getElementById('cx-data');
  if (!root || !raw?.textContent) return;

  const data: Data = JSON.parse(raw.textContent);
  const stoneOf = new Map(data.stones.map((s) => [s.key, s]));
  const abilityOf = new Map(data.abilities.map((a) => [a.ref, a]));
  const byStone = new Map<string, Ability[]>();
  for (const a of data.abilities) {
    const list = byStone.get(a.stone) ?? [];
    list.push(a);
    byStone.set(a.stone, list);
  }

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------- dom -- */
  const views = new Map<View, HTMLElement>();
  root.querySelectorAll<HTMLElement>('[data-cx-panel-view]').forEach((el) => {
    views.set(el.dataset.cxPanelView as View, el);
  });
  const viewButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-cx-view]'));

  const search = root.querySelector<HTMLInputElement>('[data-cx-search]')!;
  const rowsBox = root.querySelector<HTMLElement>('[data-cx-rows]')!;
  const rows = Array.from(rowsBox.querySelectorAll<HTMLElement>('[data-cx-row]'));
  const groups = Array.from(rowsBox.querySelectorAll<HTMLElement>('[data-cx-group]'));
  const countOut = root.querySelector<HTMLElement>('[data-cx-count]')!;
  const empty = root.querySelector<HTMLElement>('[data-cx-empty]')!;

  const panel = root.querySelector<HTMLElement>('[data-cx-detail]')!;
  const panelBody = root.querySelector<HTMLElement>('[data-cx-detail-body]')!;
  const panelTitle = root.querySelector<HTMLElement>('[data-cx-title]')!;
  const panelEyebrow = root.querySelector<HTMLElement>('[data-cx-eyebrow]')!;
  const panelRef = root.querySelector<HTMLElement>('[data-cx-ref]')!;
  const panelBack = root.querySelector<HTMLButtonElement>('[data-cx-back]')!;
  const panelBackLabel = root.querySelector<HTMLElement>('[data-cx-back-label]')!;
  const panelClose = root.querySelector<HTMLButtonElement>('[data-cx-close]')!;

  const mapBox = root.querySelector<HTMLElement>('[data-cx-map]')!;
  const svg = mapBox.querySelector<SVGSVGElement>('svg')!;
  const mapRoot = svg.querySelector<SVGGElement>('.m-root')!;

  /* --------------------------------------------------------------- text -- */
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const label = (a: Ability) => data.controls[a.control]?.label ?? a.control;

  /* =================================================================== */
  /* views                                                               */
  /* =================================================================== */

  let view: View = 'stones';

  function setView(next: View, push = true) {
    if (!VIEWS.includes(next)) return;
    view = next;
    views.forEach((el, key) => el.classList.toggle('is-on', key === next));
    viewButtons.forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.cxView === next))
    );
    if (push) writeHash();
    /* A view swap is a route change: park focus at the top of the new region
       so a screen reader is not left reading the old one. */
    const el = views.get(next);
    if (el && document.activeElement && root.contains(document.activeElement)) {
      el.setAttribute('tabindex', '-1');
      el.focus({ preventScroll: true });
    }
  }

  viewButtons.forEach((b) =>
    b.addEventListener('click', () => setView(b.dataset.cxView as View))
  );

  /* =================================================================== */
  /* filtering                                                           */
  /* =================================================================== */

  const filters = { stone: '', role: '', control: '', q: '' };

  function apply() {
    const q = filters.q.trim().toLowerCase();
    let shown = 0;

    for (const row of rows) {
      const ok =
        (!filters.stone || row.dataset.stone === filters.stone) &&
        (!filters.role || row.dataset.role === filters.role) &&
        (!filters.control || row.dataset.control === filters.control) &&
        (!q || (row.dataset.text ?? '').includes(q));
      row.classList.toggle('is-hidden', !ok);
      if (ok) shown++;
    }

    /* A group header with nothing under it is noise, not structure. */
    for (const g of groups) {
      const any = g.querySelector('[data-cx-row]:not(.is-hidden)');
      g.classList.toggle('is-hidden', !any);
    }

    empty.classList.toggle('is-hidden', shown > 0);
    countOut.textContent = `${shown} of ${data.abilities.length}`;
  }

  root.querySelectorAll<HTMLButtonElement>('[data-cx-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const facet = btn.dataset.cxFilter as 'stone' | 'role' | 'control';
      const value = btn.dataset.cxValue ?? '';
      /* Clicking the active chip clears it — one control, both directions. */
      filters[facet] = filters[facet] === value && value ? '' : value;
      root
        .querySelectorAll<HTMLButtonElement>(`[data-cx-filter="${facet}"]`)
        .forEach((b) =>
          b.setAttribute('aria-pressed', String((b.dataset.cxValue ?? '') === filters[facet]))
        );
      apply();
    });
  });

  root.querySelector('[data-cx-clear]')?.addEventListener('click', () => {
    filters.stone = filters.role = filters.control = filters.q = '';
    search.value = '';
    root
      .querySelectorAll<HTMLButtonElement>('[data-cx-filter]')
      .forEach((b) => b.setAttribute('aria-pressed', String(!b.dataset.cxValue)));
    apply();
    search.focus();
  });

  let searchTimer = 0;
  search.addEventListener('input', () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      filters.q = search.value;
      apply();
      /* Typing in a database search means "show me the results", so the
         search box owns the view while there is a query in it. */
      if (filters.q.trim() && view !== 'index') setView('index');
    }, 120);
  });

  /* =================================================================== */
  /* panel                                                               */
  /* =================================================================== */

  let opener: HTMLElement | null = null;
  let mode: 'stone' | 'ability' | null = null;
  let current = '';
  let parentStone = '';

  function openPanel() {
    panel.classList.add('is-open');
    panel.setAttribute('aria-hidden', 'false');
  }

  function closePanel() {
    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
    mode = null;
    current = '';
    parentStone = '';
    rows.forEach((r) => r.classList.remove('is-sel'));
    svg.querySelectorAll('.m-node.is-sel').forEach((n) => n.classList.remove('is-sel'));
    writeHash();
    opener?.focus({ preventScroll: true });
    opener = null;
  }

  panelClose.addEventListener('click', closePanel);

  panelBack.addEventListener('click', () => {
    if (parentStone) showStone(parentStone, false);
  });

  function showStone(key: string, remember = true) {
    const s = stoneOf.get(key);
    if (!s) return;
    if (remember) parentStone = '';
    mode = 'stone';
    current = key;
    parentStone = '';

    panel.style.setProperty('--gem', s.color);
    panelBack.classList.add('is-hidden');
    panelEyebrow.textContent = `Stone ${s.id} · ${s.count} abilities`;
    panelTitle.textContent = s.name;
    panelRef.textContent = s.domain;

    const list = byStone.get(key) ?? [];
    const roleBits = Object.entries(s.roles)
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `${data.roles[k]} ${n}`)
      .join(' · ');

    panelBody.innerHTML = `
      <p class="lead">${esc(s.summary)}</p>
      <p>${esc(s.reads)}</p>
      <div class="cxdl">
        <div class="cxdl__r"><span class="cxdl__k">Lore line</span><span class="cxdl__v">${esc(s.lore)}</span></div>
        <div class="cxdl__r"><span class="cxdl__k">Abilities</span><span class="cxdl__v">${s.count}, ${s.original} of them original</span></div>
        <div class="cxdl__r"><span class="cxdl__k">Roles</span><span class="cxdl__v">${esc(roleBits)}</span></div>
        ${
          s.retired.length
            ? `<div class="cxdl__r"><span class="cxdl__k">Retired IDs</span><span class="cxdl__v">${s.retired.join(', ')} — never reassigned</span></div>`
            : ''
        }
      </div>
      <p class="cxsub">All ${s.count} abilities</p>
      <div class="cxplist">
        ${list
          .map(
            (a) => `<button type="button" class="cxpitem" data-cx-open="${a.ref}">
              <span class="cxpitem__i">${String(a.power).padStart(2, '0')}</span>
              <span><span class="cxpitem__n">${esc(a.name)}</span>
              <span class="cxpitem__c">${esc(label(a))} · ${esc(data.roles[a.role])}</span></span>
            </button>`
          )
          .join('')}
      </div>
    `;
    panelBody.scrollTop = 0;
    openPanel();
    focusSector(key);
    writeHash();
  }

  function showAbility(ref: string, fromStone = '') {
    const a = abilityOf.get(ref);
    if (!a) return;
    const s = stoneOf.get(a.stone)!;
    mode = 'ability';
    current = ref;
    parentStone = fromStone;

    panel.style.setProperty('--gem', s.color);
    panelBack.classList.toggle('is-hidden', !fromStone);
    panelBackLabel.textContent = s.name;
    panelEyebrow.textContent = `${s.name} · Power ${a.power}`;
    panelTitle.textContent = a.name;
    panelRef.textContent = a.ref;

    const siblings = byStone.get(a.stone) ?? [];
    const at = siblings.findIndex((x) => x.ref === ref);
    const prev = siblings[at - 1];
    const next = siblings[at + 1];

    panelBody.innerHTML = `
      <p class="lead">${esc(a.desc)}</p>
      <div class="cxdl">
        <div class="cxdl__r"><span class="cxdl__k">Control</span><span class="cxdl__v">${esc(label(a))}</span></div>
        <div class="cxdl__r"><span class="cxdl__k">How</span><span class="cxdl__v">${esc(a.hint)}</span></div>
        <div class="cxdl__r"><span class="cxdl__k">Role</span><span class="cxdl__v">${esc(data.roles[a.role])}</span></div>
        <div class="cxdl__r"><span class="cxdl__k">Added</span><span class="cxdl__v">${
          a.origin === 'original' ? 'Shipped with the original catalog' : 'Catalog expansion'
        }</span></div>
        <div class="cxdl__r"><span class="cxdl__k">Reference</span><span class="cxdl__v">${esc(a.ref)} · stone ${s.id}, power ${a.power}</span></div>
      </div>
      <div class="cxpnav">
        <button type="button" class="cxchip cxchip--plain" data-cx-open="${prev?.ref ?? ''}" ${prev ? '' : 'disabled'}>&larr; ${prev ? esc(prev.name) : 'Start'}</button>
        <button type="button" class="cxchip cxchip--plain" data-cx-open="${next?.ref ?? ''}" ${next ? '' : 'disabled'}>${next ? esc(next.name) : 'End'} &rarr;</button>
      </div>
      <p class="cxsub" style="margin-top:20px">More from ${esc(s.name)}</p>
      <button type="button" class="cxchip" style="--gem:${s.color}" data-cx-open-stone="${s.key}">All ${s.count} abilities</button>
    `;
    panelBody.scrollTop = 0;
    openPanel();

    rows.forEach((r) => r.classList.toggle('is-sel', r.dataset.cxRow === ref));
    svg.querySelectorAll('.m-node.is-sel').forEach((n) => n.classList.remove('is-sel'));
    svg.querySelector(`[data-node="${CSS.escape(ref)}"]`)?.classList.add('is-sel');
    focusSector(a.stone);
    writeHash();
  }

  /* One delegated listener covers every control the panel writes into
     itself, so re-rendering never leaves a dead button behind. */
  panelBody.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const openRef = target.closest<HTMLElement>('[data-cx-open]')?.dataset.cxOpen;
    if (openRef) {
      showAbility(openRef, mode === 'stone' ? current : parentStone);
      return;
    }
    const stone = target.closest<HTMLElement>('[data-cx-open-stone]')?.dataset.cxOpenStone;
    if (stone) showStone(stone);
  });

  /* Hovering an entry in the panel list lights the matching dot on the map,
     which is the only thing tying the two representations together. */
  panelBody.addEventListener('pointerover', (e) => {
    const item = (e.target as HTMLElement).closest<HTMLElement>('[data-cx-open]');
    svg.querySelectorAll('.m-node.is-hot').forEach((n) => n.classList.remove('is-hot'));
    const ref = item?.dataset.cxOpen;
    if (ref) svg.querySelector(`[data-node="${CSS.escape(ref)}"]`)?.classList.add('is-hot');
  });

  panelBody.addEventListener('pointerleave', () => {
    svg.querySelectorAll('.m-node.is-hot').forEach((n) => n.classList.remove('is-hot'));
  });

  /* =================================================================== */
  /* entry points                                                        */
  /* =================================================================== */

  function openAbilityFrom(el: HTMLElement, ref: string) {
    opener = el;
    showAbility(ref);
  }

  rows.forEach((row) =>
    row.addEventListener('click', () => openAbilityFrom(row, row.dataset.cxRow!))
  );

  root.querySelectorAll<HTMLElement>('[data-cx-goto]').forEach((el) =>
    el.addEventListener('click', () => openAbilityFrom(el, el.dataset.cxGoto!))
  );

  root.querySelectorAll<HTMLElement>('[data-cx-stone]').forEach((el) =>
    el.addEventListener('click', () => {
      opener = el;
      setView('matrix');
      showStone(el.dataset.cxStone!);
    })
  );

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (panel.classList.contains('is-open')) {
      closePanel();
      return;
    }
    if (mapBox.dataset.focus) clearFocus();
  });

  /* =================================================================== */
  /* the matrix                                                          */
  /* =================================================================== */

  const t = { x: 0, y: 0, k: 1 };

  function draw() {
    mapRoot.setAttribute('transform', `translate(${t.x} ${t.y}) scale(${t.k})`);
  }

  function ease(to: { x: number; y: number; k: number }) {
    if (reduce) {
      Object.assign(t, to);
      draw();
      return;
    }
    const from = { ...t };
    const start = performance.now();
    const dur = 420;
    /* Explicitly assigns the final values on the last frame rather than
       trusting the animation to land there, so an interrupted move still
       leaves the transform in a known state. */
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      t.x = from.x + (to.x - from.x) * e;
      t.y = from.y + (to.y - from.y) * e;
      t.k = from.k + (to.k - from.k) * e;
      draw();
      if (p < 1) raf = requestAnimationFrame(step);
      else {
        Object.assign(t, to);
        draw();
      }
    };
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(step);
  }

  let raf = 0;

  /* Screen pixels to viewBox units. Recomputed per gesture because the stage
     resizes with the window. */
  function unitsPerPixel() {
    const ctm = svg.getScreenCTM();
    return ctm ? 1 / ctm.a : 1;
  }

  function pointerInViewBox(e: { clientX: number; clientY: number }) {
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = svg.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    const u = p.matrixTransform(ctm.inverse());
    return { x: u.x, y: u.y };
  }

  function zoomAbout(px: number, py: number, factor: number) {
    const k = Math.min(3.4, Math.max(0.55, t.k * factor));
    t.x = px - ((px - t.x) * k) / t.k;
    t.y = py - ((py - t.y) * k) / t.k;
    t.k = k;
    draw();
  }

  svg.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const p = pointerInViewBox(e);
      zoomAbout(p.x, p.y, e.deltaY < 0 ? 1.12 : 1 / 1.12);
    },
    { passive: false }
  );

  let dragging = false;
  let moved = 0;
  let last = { x: 0, y: 0 };

  svg.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    dragging = true;
    moved = 0;
    last = { x: e.clientX, y: e.clientY };
    svg.setPointerCapture(e.pointerId);
    svg.classList.add('is-drag');
  });

  svg.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const scale = unitsPerPixel();
    const dx = e.clientX - last.x;
    const dy = e.clientY - last.y;
    moved += Math.abs(dx) + Math.abs(dy);
    t.x += dx * scale;
    t.y += dy * scale;
    last = { x: e.clientX, y: e.clientY };
    draw();
  });

  const endDrag = (e: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    svg.releasePointerCapture?.(e.pointerId);
    svg.classList.remove('is-drag');
  };

  svg.addEventListener('pointerup', endDrag);
  svg.addEventListener('pointercancel', endDrag);

  root.querySelectorAll<HTMLButtonElement>('[data-cx-zoom]').forEach((b) =>
    b.addEventListener('click', () => {
      const how = b.dataset.cxZoom;
      if (how === 'fit') {
        clearFocus();
        ease({ x: 0, y: 0, k: 1 });
      } else zoomAbout(0, 0, how === 'in' ? 1.25 : 1 / 1.25);
    })
  );

  /* Nodes and gems. A drag that happens to end on a node is a pan, not a
     click, so anything past a few pixels of travel is ignored here. */
  svg.addEventListener('click', (e) => {
    if (moved > 6) return;
    const target = e.target as Element;
    const gem = target.closest<SVGGElement>('[data-stone]');
    if (gem) {
      opener = gem as unknown as HTMLElement;
      const key = gem.dataset.stone!;
      if (mapBox.dataset.focus === key && mode === 'stone') closePanel();
      else showStone(key);
      return;
    }
    const node = target.closest<SVGGElement>('[data-node]');
    if (node) {
      opener = node as unknown as HTMLElement;
      showAbility(node.dataset.node!, mapBox.dataset.focus ?? '');
    }
  });

  svg.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const gem = (e.target as Element).closest<SVGGElement>('[data-stone]');
    if (!gem) return;
    e.preventDefault();
    opener = gem as unknown as HTMLElement;
    showStone(gem.dataset.stone!);
  });

  function focusSector(key: string) {
    mapBox.dataset.focus = key;
    svg.querySelectorAll('.m-sector').forEach((s) => {
      s.classList.toggle('is-focus', (s as SVGGElement).dataset.sector === key);
      /* Only the focused fan is reachable by pointer, so a dimmed sector
         cannot swallow a click meant for the one on top of it. */
      (s as SVGGElement).style.pointerEvents =
        (s as SVGGElement).dataset.sector === key ? 'auto' : 'none';
    });
    if (view !== 'matrix') return;
    const gem = svg.querySelector<SVGGElement>(`[data-stone="${CSS.escape(key)}"] .m-hit`);
    if (!gem) return;
    const cx = Number(gem.getAttribute('cx')) * 2.4;
    const cy = Number(gem.getAttribute('cy')) * 2.4;
    const k = 1.42;
    ease({ x: -cx * k, y: -cy * k, k });
  }

  function clearFocus() {
    delete mapBox.dataset.focus;
    svg.querySelectorAll('.m-sector').forEach((s) => {
      s.classList.remove('is-focus');
      (s as SVGGElement).style.pointerEvents = '';
    });
  }

  /* Clicking the hub is the way out of a focused stone. */
  svg.querySelector('.m-hub')?.addEventListener('click', () => {
    if (moved > 6) return;
    clearFocus();
    closePanel();
    ease({ x: 0, y: 0, k: 1 });
  });

  /* =================================================================== */
  /* addressing                                                          */
  /* =================================================================== */

  function writeHash() {
    let hash = view === 'stones' ? '' : `#${view}`;
    if (mode === 'ability' && current) hash = `#a/${current}`;
    else if (mode === 'stone' && current) hash = `#s/${current}`;
    const next = location.pathname + location.search + hash;
    history.replaceState(null, '', next);
  }

  function readHash() {
    const h = decodeURIComponent(location.hash.replace(/^#/, ''));
    if (!h) return;
    if (h.startsWith('a/')) {
      const ref = h.slice(2);
      if (!abilityOf.has(ref)) return;
      setView('index', false);
      showAbility(ref);
      document.getElementById(`a-${ref.replace('.', '-')}`)?.scrollIntoView({ block: 'center' });
      return;
    }
    if (h.startsWith('s/')) {
      const key = h.slice(2);
      if (!stoneOf.has(key)) return;
      setView('matrix', false);
      showStone(key);
      return;
    }
    if (VIEWS.includes(h as View)) setView(h as View, false);
  }

  draw();
  apply();
  readHash();
}
