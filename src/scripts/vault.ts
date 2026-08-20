/* ==========================================================================
   The Vault — expandable knowledge graph

   Deliberately starts collapsed. A 120-node hairball is impressive and
   useless; showing only the roots and growing the graph as you open things
   keeps the structure readable and makes exploring it the interaction.

   No graph library: the simulation is ~60 lines of repulsion + springs, and
   avoiding d3 keeps the whole page under a few KB of script.
   ========================================================================== */

export interface Fact {
  label: string;
  value: string;
}

export interface Section {
  heading: string;
  body: string;
}

export interface WikiNode {
  id: string;
  title: string;
  category: string;
  parents?: string[];
  tagline: string;
  status?: 'live' | 'locked' | 'wip' | 'retired';
  summary: string;
  facts?: Fact[];
  sections?: Section[];
  related?: string[];
  accent?: string;
}

interface Body {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  depth: number;
  pinned: boolean;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const DEFAULT_ACCENT = '#3FC6FF';

/* simulation constants — tuned by eye against the real node counts */
const REPULSE = 5400;
const SPRING = 0.032;
const GRAVITY = 0.012;
const DAMPING = 0.86;
const MIN_ENERGY = 0.02;

function restLength(depth: number): number {
  return depth <= 1 ? 150 : depth === 2 ? 116 : 96;
}

function radiusFor(depth: number, leaf: boolean): number {
  if (depth === 0) return 26;
  if (depth === 1) return leaf ? 9 : 20;
  if (depth === 2) return leaf ? 8 : 15;
  return 7;
}

function hexPath(r: number): string {
  const pts: string[] = [];
  for (let k = 0; k < 6; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 3;
    pts.push(`${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join('L')}Z`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Very small inline formatter: **bold** and `code` only. */
function fmt(s: string): string {
  return escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
}

export function initVault(): void {
  const root = document.querySelector<HTMLElement>('[data-vault]');
  const dataEl = document.getElementById('vault-data');
  if (!root || !dataEl?.textContent) return;

  const nodes: WikiNode[] = JSON.parse(dataEl.textContent);
  const byId = new Map<string, WikiNode>();
  nodes.forEach((n) => byId.set(n.id, n));

  /* ---- derive the tree -------------------------------------------------- */
  const kids = new Map<string, string[]>();
  const roots: string[] = [];
  nodes.forEach((n) => {
    const ps = (n.parents || []).filter((p) => byId.has(p));
    if (!ps.length) {
      roots.push(n.id);
      return;
    }
    ps.forEach((p) => {
      if (!kids.has(p)) kids.set(p, []);
      kids.get(p)!.push(n.id);
    });
  });

  const depthOf = new Map<string, number>();
  const walk = (id: string, d: number, seen: Set<string>) => {
    if (seen.has(id)) return;
    seen.add(id);
    const prev = depthOf.get(id);
    if (prev === undefined || d < prev) depthOf.set(id, d);
    (kids.get(id) || []).forEach((k) => walk(k, d + 1, seen));
  };
  roots.forEach((r) => walk(r, 0, new Set()));
  nodes.forEach((n) => {
    if (!depthOf.has(n.id)) depthOf.set(n.id, 1);
  });

  const hasKids = (id: string) => (kids.get(id) || []).length > 0;

  /* ---- state ------------------------------------------------------------ */
  const expanded = new Set<string>();
  const bodies = new Map<string, Body>();
  let selected: string | null = null;
  let filter = '';

  const svg = root.querySelector<SVGSVGElement>('.vstage__svg')!;
  const gLinks = svg.querySelector<SVGGElement>('.g-links')!;
  const gNodes = svg.querySelector<SVGGElement>('.g-nodes')!;
  const gRoot = svg.querySelector<SVGGElement>('.g-root')!;
  const panel = root.querySelector<HTMLElement>('.vpanel')!;
  const hint = root.querySelector<HTMLElement>('.vhint');

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let W = svg.clientWidth || 1200;
  let H = svg.clientHeight || 700;
  const view = { x: 0, y: 0, k: 1 };

  /* ---- visible set ------------------------------------------------------ */
  function visibleIds(): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    const push = (id: string) => {
      if (seen.has(id)) return;
      seen.add(id);
      out.push(id);
      if (expanded.has(id)) (kids.get(id) || []).forEach(push);
    };
    roots.forEach(push);
    return out;
  }

  function visibleLinks(vis: Set<string>): Array<[string, string]> {
    const out: Array<[string, string]> = [];
    vis.forEach((id) => {
      (kids.get(id) || []).forEach((k) => {
        if (vis.has(k)) out.push([id, k]);
      });
    });
    return out;
  }

  function ensureBody(id: string): Body {
    let b = bodies.get(id);
    if (b) return b;
    const d = depthOf.get(id) ?? 1;
    /* spawn just off the parent so an expansion visibly grows outward */
    const parent = (byId.get(id)?.parents || []).find((p) => bodies.has(p));
    const pb = parent ? bodies.get(parent)! : null;
    const a = Math.random() * Math.PI * 2;
    const r = 40 + Math.random() * 30;
    b = {
      id,
      x: pb ? pb.x + Math.cos(a) * r : W / 2 + Math.cos(a) * 180,
      y: pb ? pb.y + Math.sin(a) * r : H / 2 + Math.sin(a) * 180,
      vx: 0,
      vy: 0,
      depth: d,
      pinned: false,
    };
    bodies.set(id, b);
    return b;
  }

  /* ---- simulation ------------------------------------------------------- */
  let energy = 1;

  function step(vis: string[], links: Array<[string, string]>) {
    const list = vis.map(ensureBody);

    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 1) {
          dx = Math.random() - 0.5;
          dy = Math.random() - 0.5;
          d2 = 1;
        }
        const d = Math.sqrt(d2);
        const f = REPULSE / d2;
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }
    }

    links.forEach(([s, t]) => {
      const a = bodies.get(s)!;
      const b = bodies.get(t)!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 1;
      const rest = restLength(b.depth);
      const f = (d - rest) * SPRING;
      const fx = (dx / d) * f;
      const fy = (dy / d) * f;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    });

    let e = 0;
    list.forEach((b) => {
      b.vx += (W / 2 - b.x) * GRAVITY;
      b.vy += (H / 2 - b.y) * GRAVITY;
      if (b.pinned) {
        b.vx = 0;
        b.vy = 0;
        return;
      }
      b.vx *= DAMPING;
      b.vy *= DAMPING;
      b.x += b.vx;
      b.y += b.vy;
      e += Math.abs(b.vx) + Math.abs(b.vy);
    });
    energy = list.length ? e / list.length : 0;
  }

  /* ---- rendering -------------------------------------------------------- */
  const nodeEls = new Map<string, SVGGElement>();
  const linkEls = new Map<string, SVGLineElement>();

  function buildNode(id: string): SVGGElement {
    const n = byId.get(id)!;
    const d = depthOf.get(id) ?? 1;
    const leaf = !hasKids(id);
    const r = radiusFor(d, leaf);

    const g = document.createElementNS(SVG_NS, 'g') as SVGGElement;
    g.setAttribute('class', 'node');
    g.setAttribute('data-id', id);
    g.setAttribute('data-depth', String(Math.min(d, 4)));
    g.setAttribute('data-leaf', String(leaf));
    if (n.status) g.setAttribute('data-status', n.status);
    g.setAttribute('tabindex', '0');
    g.setAttribute('role', 'button');
    const kidCount = (kids.get(id) || []).length;
    g.setAttribute(
      'aria-label',
      `${n.title}. ${n.tagline}${kidCount ? `. ${kidCount} sub-pages` : ''}`
    );

    const ring = document.createElementNS(SVG_NS, 'circle');
    ring.setAttribute('class', 'node__ring');
    ring.setAttribute('r', String(r + 7));
    g.appendChild(ring);

    const glyph = document.createElementNS(SVG_NS, 'path');
    glyph.setAttribute('class', 'node__glyph');
    glyph.setAttribute('d', leaf ? hexPath(r * 0.86) : hexPath(r));
    g.appendChild(glyph);

    /* generous invisible hit area — the glyphs are small on purpose */
    const hit = document.createElementNS(SVG_NS, 'circle');
    hit.setAttribute('class', 'node__hit');
    hit.setAttribute('r', String(Math.max(r + 10, 18)));
    g.appendChild(hit);

    if (!leaf) {
      const c = document.createElementNS(SVG_NS, 'text');
      c.setAttribute('class', 'node__count');
      c.setAttribute('dy', '3');
      c.textContent = String(kidCount);
      g.appendChild(c);
    }

    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('class', 'node__label');
    label.setAttribute('dy', String(r + 15));
    label.style.fontSize = d === 0 ? '13.5px' : d === 1 ? '12.5px' : '11.5px';
    label.textContent = n.title;
    g.appendChild(label);

    return g;
  }

  function render(vis: string[], links: Array<[string, string]>) {
    const visSet = new Set(vis);

    linkEls.forEach((el, key) => {
      const [s, t] = key.split(' ');
      if (!visSet.has(s) || !visSet.has(t)) {
        el.remove();
        linkEls.delete(key);
      }
    });
    links.forEach(([s, t]) => {
      const key = `${s} ${t}`;
      if (linkEls.has(key)) return;
      const el = document.createElementNS(SVG_NS, 'line');
      el.setAttribute('class', 'link');
      gLinks.appendChild(el);
      linkEls.set(key, el);
    });

    nodeEls.forEach((el, id) => {
      if (!visSet.has(id)) {
        el.remove();
        nodeEls.delete(id);
      }
    });
    vis.forEach((id) => {
      if (nodeEls.has(id)) return;
      const el = buildNode(id);
      gNodes.appendChild(el);
      nodeEls.set(id, el);
    });

    paint(vis, links);
  }

  function paint(vis: string[], links: Array<[string, string]>) {
    linkEls.forEach((el, key) => {
      const [s, t] = key.split(' ');
      const a = bodies.get(s);
      const b = bodies.get(t);
      if (!a || !b) return;
      el.setAttribute('x1', a.x.toFixed(1));
      el.setAttribute('y1', a.y.toFixed(1));
      el.setAttribute('x2', b.x.toFixed(1));
      el.setAttribute('y2', b.y.toFixed(1));
    });

    nodeEls.forEach((el, id) => {
      const b = bodies.get(id);
      if (!b) return;
      el.setAttribute('transform', `translate(${b.x.toFixed(1)},${b.y.toFixed(1)})`);
    });

    void links;
    void vis;
  }

  function applyViewTransform() {
    gRoot.setAttribute(
      'transform',
      `translate(${view.x.toFixed(1)},${view.y.toFixed(1)}) scale(${view.k.toFixed(3)})`
    );
  }

  /* ---- highlight / dim -------------------------------------------------- */
  function highlight(id: string | null) {
    const kin = new Set<string>();
    if (id) {
      kin.add(id);
      (byId.get(id)?.parents || []).forEach((p) => kin.add(p));
      (kids.get(id) || []).forEach((k) => kin.add(k));
    }
    nodeEls.forEach((el, nid) => {
      el.classList.toggle('is-dim', !!id && !kin.has(nid) && !matchesFilter(nid));
      el.classList.toggle('is-lit', !!id && kin.has(nid) && nid !== id);
      el.classList.toggle('is-selected', nid === selected);
    });
    linkEls.forEach((el, key) => {
      const [s, t] = key.split(' ');
      const on = !!id && (s === id || t === id);
      el.classList.toggle('is-lit', on);
      el.classList.toggle('is-dim', !!id && !on);
    });
  }

  function matchesFilter(id: string): boolean {
    if (!filter) return false;
    const n = byId.get(id);
    if (!n) return false;
    const q = filter.toLowerCase();
    return (
      n.title.toLowerCase().includes(q) ||
      n.tagline.toLowerCase().includes(q) ||
      n.category.toLowerCase().includes(q)
    );
  }

  /* ---- panel ------------------------------------------------------------ */
  let lastFocus: HTMLElement | SVGElement | null = null;

  function openPanel(id: string) {
    const n = byId.get(id);
    if (!n) return;
    selected = id;
    root.style.setProperty('--accent', n.accent || DEFAULT_ACCENT);

    const kidList = kids.get(id) || [];
    const rel = (n.related || []).filter((r) => byId.has(r) && r !== id);

    panel.querySelector('.vpanel__eyebrow')!.textContent = n.category;
    panel.querySelector('.vpanel__title')!.textContent = n.title;
    panel.querySelector('.vpanel__tag')!.textContent = n.tagline;

    const body = panel.querySelector<HTMLElement>('.vpanel__body')!;
    const parts: string[] = [];

    if (n.status && n.status !== 'live') {
      const label =
        n.status === 'locked'
          ? 'Not yet obtainable'
          : n.status === 'wip'
            ? 'Work in progress'
            : 'Retired';
      parts.push(
        `<p><span class="vstatus vstatus--${n.status}">${label}</span></p>`
      );
    }

    parts.push(`<p class="vpanel__summary">${fmt(n.summary)}</p>`);

    if (n.facts?.length) {
      parts.push('<dl class="vfacts">');
      n.facts.forEach((f) => {
        parts.push(
          `<div class="vfact"><dt>${escapeHtml(f.label)}</dt><dd>${fmt(f.value)}</dd></div>`
        );
      });
      parts.push('</dl>');
    }

    (n.sections || []).forEach((s) => {
      const paras = s.body
        .split(/\n{2,}/)
        .map((p) => `<p>${fmt(p.trim())}</p>`)
        .join('');
      parts.push(
        `<section class="vsec"><h3>${escapeHtml(s.heading)}</h3>${paras}</section>`
      );
    });

    if (kidList.length) {
      parts.push('<section class="vsec"><h3>Inside this</h3><div class="vchips">');
      kidList.forEach((k) => {
        parts.push(
          `<button class="vchip" data-goto="${k}">${escapeHtml(byId.get(k)!.title)}</button>`
        );
      });
      parts.push('</div></section>');
    }

    if (rel.length) {
      parts.push('<section class="vsec"><h3>See also</h3><div class="vchips">');
      rel.forEach((r) => {
        parts.push(
          `<button class="vchip" data-goto="${r}">${escapeHtml(byId.get(r)!.title)}</button>`
        );
      });
      parts.push('</div></section>');
    }

    body.innerHTML = parts.join('');
    body.scrollTop = 0;
    panel.classList.add('is-open');
    panel.setAttribute('aria-hidden', 'false');
    highlight(id);
  }

  function closePanel() {
    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
    selected = null;
    root.style.setProperty('--accent', DEFAULT_ACCENT);
    highlight(null);
    if (lastFocus && 'focus' in lastFocus) (lastFocus as HTMLElement).focus();
  }

  /* ---- selection -------------------------------------------------------- */
  function select(id: string, opts: { toggle?: boolean } = {}) {
    if (hasKids(id)) {
      if (opts.toggle && expanded.has(id) && selected === id) expanded.delete(id);
      else expanded.add(id);
    }
    /* keep ancestors open so a deep jump does not orphan the node */
    let cur = byId.get(id);
    const guard = new Set<string>();
    while (cur && cur.parents?.length && !guard.has(cur.id)) {
      guard.add(cur.id);
      const p = cur.parents[0];
      expanded.add(p);
      cur = byId.get(p);
    }
    sync();
    openPanel(id);
    centerOn(id);
    energy = 1;
    kick();
  }

  function centerOn(id: string) {
    const b = bodies.get(id);
    if (!b) return;
    const panelW = panel.classList.contains('is-open') && W > 860 ? panel.clientWidth : 0;
    const targetX = (W - panelW) / 2;
    view.x = targetX - b.x * view.k;
    view.y = H / 2 - b.y * view.k;
    applyViewTransform();
  }

  function sync() {
    const vis = visibleIds();
    const links = visibleLinks(new Set(vis));
    vis.forEach(ensureBody);
    render(vis, links);
    highlight(selected);
    return { vis, links };
  }

  /* ---- animation loop --------------------------------------------------- */
  let raf = 0;
  function frame() {
    const vis = visibleIds();
    const links = visibleLinks(new Set(vis));
    step(vis, links);
    paint(vis, links);
    if (energy > MIN_ENERGY) raf = requestAnimationFrame(frame);
    else raf = 0;
  }

  function kick() {
    if (reduce) {
      const vis = visibleIds();
      const links = visibleLinks(new Set(vis));
      for (let i = 0; i < 260; i++) step(vis, links);
      paint(vis, links);
      return;
    }
    if (!raf) raf = requestAnimationFrame(frame);
  }

  /* ---- events ----------------------------------------------------------- */
  gNodes.addEventListener('click', (e) => {
    const g = (e.target as Element).closest('.node') as SVGGElement | null;
    if (!g || dragMoved) return;
    lastFocus = g;
    select(g.getAttribute('data-id')!, { toggle: true });
  });

  gNodes.addEventListener('keydown', (e) => {
    const ke = e as KeyboardEvent;
    if (ke.key !== 'Enter' && ke.key !== ' ') return;
    const g = (ke.target as Element).closest('.node') as SVGGElement | null;
    if (!g) return;
    ke.preventDefault();
    lastFocus = g;
    select(g.getAttribute('data-id')!, { toggle: true });
  });

  gNodes.addEventListener('pointerover', (e) => {
    if (selected) return;
    const g = (e.target as Element).closest('.node') as SVGGElement | null;
    if (g) highlight(g.getAttribute('data-id'));
  });

  gNodes.addEventListener('pointerout', (e) => {
    if (selected) return;
    const g = (e.target as Element).closest('.node');
    if (g) highlight(null);
  });

  panel.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('.vpanel__close')) {
      closePanel();
      return;
    }
    const goto = t.closest<HTMLElement>('[data-goto]');
    if (goto) select(goto.getAttribute('data-goto')!);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panel.classList.contains('is-open')) closePanel();
  });

  /* ---- drag nodes + pan ------------------------------------------------- */
  let dragId: string | null = null;
  let dragMoved = false;
  let panning = false;
  let px = 0;
  let py = 0;

  svg.addEventListener('pointerdown', (e) => {
    const g = (e.target as Element).closest('.node') as SVGGElement | null;
    dragMoved = false;
    px = e.clientX;
    py = e.clientY;
    if (g) {
      dragId = g.getAttribute('data-id');
      const b = bodies.get(dragId!);
      if (b) b.pinned = true;
    } else {
      panning = true;
      svg.classList.add('is-panning');
    }
    svg.setPointerCapture(e.pointerId);
  });

  svg.addEventListener('pointermove', (e) => {
    const dx = e.clientX - px;
    const dy = e.clientY - py;
    if (Math.abs(dx) + Math.abs(dy) > 3) dragMoved = true;
    if (dragId) {
      const b = bodies.get(dragId);
      if (b) {
        b.x += dx / view.k;
        b.y += dy / view.k;
      }
      energy = 1;
      kick();
    } else if (panning) {
      view.x += dx;
      view.y += dy;
      applyViewTransform();
    }
    px = e.clientX;
    py = e.clientY;
  });

  function endDrag(e: PointerEvent) {
    if (dragId) {
      const b = bodies.get(dragId);
      if (b) b.pinned = false;
      dragId = null;
      energy = 1;
      kick();
    }
    panning = false;
    svg.classList.remove('is-panning');
    try {
      svg.releasePointerCapture(e.pointerId);
    } catch {
      /* pointer already released */
    }
  }

  svg.addEventListener('pointerup', endDrag);
  svg.addEventListener('pointercancel', endDrag);

  svg.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const k2 = Math.max(0.35, Math.min(2.4, view.k * (e.deltaY < 0 ? 1.12 : 0.893)));
      view.x = mx - ((mx - view.x) / view.k) * k2;
      view.y = my - ((my - view.y) / view.k) * k2;
      view.k = k2;
      applyViewTransform();
    },
    { passive: false }
  );

  /* ---- search ----------------------------------------------------------- */
  const search = root.querySelector<HTMLInputElement>('.vbar__search input');
  search?.addEventListener('input', () => {
    filter = search.value.trim();
    if (!filter) {
      highlight(selected);
      return;
    }
    /* open every ancestor of a match so results are actually reachable */
    nodes.forEach((n) => {
      if (!matchesFilter(n.id)) return;
      let cur: WikiNode | undefined = n;
      const guard = new Set<string>();
      while (cur && cur.parents?.length && !guard.has(cur.id)) {
        guard.add(cur.id);
        expanded.add(cur.parents[0]);
        cur = byId.get(cur.parents[0]);
      }
    });
    sync();
    nodeEls.forEach((el, id) => {
      const hit = matchesFilter(id);
      el.classList.toggle('is-dim', !hit);
      el.classList.toggle('is-lit', hit);
    });
    linkEls.forEach((el) => el.classList.add('is-dim'));
    energy = 1;
    kick();
  });

  /* ---- view toggle ------------------------------------------------------ */
  const index = root.querySelector<HTMLElement>('.vindex');
  root.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-view');
      root.querySelectorAll('[data-view]').forEach((b) =>
        b.setAttribute('aria-pressed', String(b === btn))
      );
      index?.classList.toggle('is-open', mode === 'index');
    });
  });

  index?.addEventListener('click', (e) => {
    const it = (e.target as HTMLElement).closest<HTMLElement>('[data-goto]');
    if (!it) return;
    index.classList.remove('is-open');
    root.querySelectorAll('[data-view]').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.getAttribute('data-view') === 'graph'))
    );
    select(it.getAttribute('data-goto')!);
  });

  root.querySelector('[data-reset]')?.addEventListener('click', () => {
    expanded.clear();
    roots.forEach((r) => expanded.add(r));
    bodies.clear();
    view.x = 0;
    view.y = 0;
    view.k = 1;
    applyViewTransform();
    closePanel();
    sync();
    energy = 1;
    kick();
  });

  /* ---- resize ----------------------------------------------------------- */
  const ro = new ResizeObserver(() => {
    W = svg.clientWidth || W;
    H = svg.clientHeight || H;
    energy = 1;
    kick();
  });
  ro.observe(svg);

  /* ---- boot ------------------------------------------------------------- */
  /* seed roots on a ring so the first frame is already legible */
  roots.forEach((id, i) => {
    const a = (i / Math.max(1, roots.length)) * Math.PI * 2 - Math.PI / 2;
    bodies.set(id, {
      id,
      x: W / 2 + Math.cos(a) * Math.min(W, H) * 0.26,
      y: H / 2 + Math.sin(a) * Math.min(W, H) * 0.26,
      vx: 0,
      vy: 0,
      depth: 0,
      pinned: false,
    });
  });

  sync();
  applyViewTransform();
  energy = 1;
  kick();

  if (hint) {
    const dismiss = () => hint.classList.add('is-gone');
    svg.addEventListener('pointerdown', dismiss, { once: true });
    window.setTimeout(dismiss, 9000);
  }
}
