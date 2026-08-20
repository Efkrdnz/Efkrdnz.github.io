/* ==========================================================================
   The Vault — expandable knowledge graph

   Layout is a radial tidy tree, not a force simulation. A physics sim treats
   every node as equal and settles into a ball; this content is a hierarchy,
   so children fan outward from their parent along the direction the branch
   was already travelling. Deterministic, no overlap, reads as a tree.

   No graph library. Positions tween toward their computed targets, which
   costs a few lines and keeps the whole page tiny.
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

interface Pos {
  x: number;
  y: number;
  tx: number;
  ty: number;
  ox: number;
  oy: number;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const DEFAULT_ACCENT = '#3FC6FF';
const DRAG_SLOP = 4;

function radiusFor(depth: number, leaf: boolean): number {
  if (depth === 0) return 25;
  if (depth === 1) return leaf ? 10 : 19;
  if (depth === 2) return leaf ? 9 : 15;
  return 8;
}

/** How far a child sits from its parent. Wider fans get pushed further out. */
function branchLength(depth: number, siblings: number): number {
  const base = depth === 0 ? 250 : depth === 1 ? 190 : depth === 2 ? 155 : 130;
  return base + Math.max(0, siblings - 3) * 15;
}

/**
 * The angular wedge a node hands to its children. Narrows with depth so
 * branches stay separated, but widens again when a node has many children
 * rather than crushing them into one arc.
 */
function fanFor(depth: number, parentFan: number, siblings = 1): number {
  const inherited =
    depth === 0 ? (150 * Math.PI) / 180 : Math.max((46 * Math.PI) / 180, parentFan * 0.66);
  const needed = siblings * ((9.5 * Math.PI) / 180);
  return Math.min((172 * Math.PI) / 180, Math.max(inherited, needed));
}

/**
 * Sibling sets larger than this alternate between two radii. Staggering the
 * ring is what stops long labels colliding: neighbours end up at different
 * distances from the parent instead of side by side on one arc.
 */
const STAGGER_FROM = 7;
const STAGGER_GAP = 66;

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

  /* ---- tree ------------------------------------------------------------- */
  const kids = new Map<string, string[]>();
  const parentOf = new Map<string, string>();
  const roots: string[] = [];

  nodes.forEach((n) => {
    const ps = (n.parents || []).filter((p) => byId.has(p) && p !== n.id);
    if (!ps.length) {
      roots.push(n.id);
      return;
    }
    /* one structural parent keeps the layout a tree; extra links live in
       "See also" inside the panel instead of tangling the picture */
    const p = ps[0];
    parentOf.set(n.id, p);
    if (!kids.has(p)) kids.set(p, []);
    kids.get(p)!.push(n.id);
  });

  const depthOf = new Map<string, number>();
  const setDepth = (id: string, d: number, seen: Set<string>) => {
    if (seen.has(id)) return;
    seen.add(id);
    depthOf.set(id, d);
    (kids.get(id) || []).forEach((k) => setDepth(k, d + 1, seen));
  };
  roots.forEach((r) => setDepth(r, 0, new Set()));
  nodes.forEach((n) => {
    if (!depthOf.has(n.id)) depthOf.set(n.id, 1);
  });

  const hasKids = (id: string) => (kids.get(id) || []).length > 0;

  /* ---- state ------------------------------------------------------------ */
  const expanded = new Set<string>();
  const pos = new Map<string, Pos>();
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
    const push = (id: string) => {
      out.push(id);
      if (expanded.has(id)) (kids.get(id) || []).forEach(push);
    };
    roots.forEach(push);
    return out;
  }

  function visibleLinks(vis: Set<string>): Array<[string, string]> {
    const out: Array<[string, string]> = [];
    vis.forEach((id) => {
      const p = parentOf.get(id);
      if (p && vis.has(p)) out.push([p, id]);
    });
    return out;
  }

  function ensurePos(id: string, x: number, y: number): Pos {
    let p = pos.get(id);
    if (!p) {
      p = { x, y, tx: x, ty: y, ox: 0, oy: 0 };
      pos.set(id, p);
    }
    return p;
  }

  /* ---- radial tidy tree ------------------------------------------------- */
  function layout() {
    const cx = W / 2;
    const cy = H / 2;

    /* roots evenly around a ring, each facing outward from centre */
    const ring = Math.min(W, H) * (roots.length > 4 ? 0.3 : 0.24);

    roots.forEach((id, i) => {
      const a = (i / roots.length) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(a) * ring;
      const y = cy + Math.sin(a) * ring;
      const p = ensurePos(id, x, y);
      p.tx = x;
      p.ty = y;
      place(id, a, fanFor(0, 0, 1), 0);
    });

    /* children fan around the direction the branch is already heading */
    function place(id: string, outward: number, parentFan: number, depth: number) {
      if (!expanded.has(id)) return;
      const cs = kids.get(id) || [];
      if (!cs.length) return;

      const parent = pos.get(id)!;
      const fan = fanFor(depth, parentFan, cs.length);
      const base = branchLength(depth, cs.length);
      const stagger = cs.length >= STAGGER_FROM;
      const step = cs.length > 1 ? fan / (cs.length - 1) : 0;
      const start = outward - fan / 2;

      cs.forEach((cid, i) => {
        const a = cs.length > 1 ? start + i * step : outward;
        const len = base + (stagger && i % 2 === 1 ? STAGGER_GAP : 0);
        const x = parent.tx + Math.cos(a) * len;
        const y = parent.ty + Math.sin(a) * len;
        const cp = ensurePos(cid, parent.x, parent.y);
        cp.tx = x;
        cp.ty = y;
        place(cid, a, fan, depth + 1);
      });
    }
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
    glyph.setAttribute('d', hexPath(leaf ? r * 0.85 : r));
    g.appendChild(glyph);

    const hit = document.createElementNS(SVG_NS, 'circle');
    hit.setAttribute('class', 'node__hit');
    hit.setAttribute('r', String(Math.max(r + 12, 20)));
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
    label.setAttribute('dy', String(r + 16));
    label.style.fontSize = d === 0 ? '13px' : d === 1 ? '12px' : '11px';
    label.textContent = n.title;
    g.appendChild(label);

    return g;
  }

  function render() {
    const vis = visibleIds();
    const visSet = new Set(vis);
    const links = visibleLinks(visSet);

    linkEls.forEach((el, key) => {
      const [s, t] = key.split('>');
      if (!visSet.has(s) || !visSet.has(t)) {
        el.remove();
        linkEls.delete(key);
      }
    });
    links.forEach(([s, t]) => {
      const key = `${s}>${t}`;
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

    highlight(selected);
  }

  function paint() {
    nodeEls.forEach((el, id) => {
      const p = pos.get(id);
      if (!p) return;
      el.setAttribute(
        'transform',
        `translate(${(p.x + p.ox).toFixed(1)},${(p.y + p.oy).toFixed(1)})`
      );
    });
    linkEls.forEach((el, key) => {
      const [s, t] = key.split('>');
      const a = pos.get(s);
      const b = pos.get(t);
      if (!a || !b) return;
      el.setAttribute('x1', (a.x + a.ox).toFixed(1));
      el.setAttribute('y1', (a.y + a.oy).toFixed(1));
      el.setAttribute('x2', (b.x + b.ox).toFixed(1));
      el.setAttribute('y2', (b.y + b.oy).toFixed(1));
    });
  }

  /* ---- tween ------------------------------------------------------------
     The animation is a nicety. Correctness never depends on it: refresh()
     paints synchronously, and a safety timer snaps to the final layout if
     requestAnimationFrame is throttled (which browsers do in background or
     non-compositing tabs, where the graph would otherwise sit stacked on
     each parent's spawn point).                                          */
  let raf = 0;
  let safety = 0;

  function snap() {
    pos.forEach((p) => {
      p.x = p.tx;
      p.y = p.ty;
    });
  }

  function stopTween() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    window.clearTimeout(safety);
    safety = 0;
  }

  function tick() {
    let moving = false;
    pos.forEach((p) => {
      const dx = p.tx - p.x;
      const dy = p.ty - p.y;
      if (Math.abs(dx) + Math.abs(dy) > 0.4) {
        p.x += dx * 0.2;
        p.y += dy * 0.2;
        moving = true;
      } else {
        p.x = p.tx;
        p.y = p.ty;
      }
    });
    paint();
    if (moving) {
      raf = requestAnimationFrame(tick);
    } else {
      raf = 0;
      window.clearTimeout(safety);
      safety = 0;
    }
  }

  function settle() {
    if (reduce) {
      snap();
      paint();
      return;
    }
    if (!raf) raf = requestAnimationFrame(tick);
    window.clearTimeout(safety);
    safety = window.setTimeout(() => {
      stopTween();
      snap();
      paint();
    }, 900);
  }

  function refresh() {
    layout();
    render();
    /* paint before animating so a newly expanded branch is never left
       sitting on top of its parent */
    paint();
    settle();
  }

  function applyViewTransform() {
    gRoot.setAttribute(
      'transform',
      `translate(${view.x.toFixed(1)},${view.y.toFixed(1)}) scale(${view.k.toFixed(3)})`
    );
  }

  /* ---- highlight -------------------------------------------------------- */
  function highlight(id: string | null) {
    const kin = new Set<string>();
    if (id) {
      kin.add(id);
      const p = parentOf.get(id);
      if (p) kin.add(p);
      (kids.get(id) || []).forEach((k) => kin.add(k));
    }
    nodeEls.forEach((el, nid) => {
      el.classList.toggle('is-dim', !!id && !kin.has(nid));
      el.classList.toggle('is-lit', !!id && kin.has(nid) && nid !== id);
      el.classList.toggle('is-selected', nid === selected);
    });
    linkEls.forEach((el, key) => {
      const [s, t] = key.split('>');
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
      parts.push(`<p><span class="vstatus vstatus--${n.status}">${label}</span></p>`);
    }

    if (n.summary) parts.push(`<p class="vpanel__summary">${fmt(n.summary)}</p>`);

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
      parts.push(`<section class="vsec"><h3>${escapeHtml(s.heading)}</h3>${paras}</section>`);
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
  }

  /* ---- selection -------------------------------------------------------- */
  function select(id: string, toggle = false) {
    if (hasKids(id)) {
      if (toggle && expanded.has(id) && selected === id) expanded.delete(id);
      else expanded.add(id);
    }
    /* open ancestors so a jump from search or the index is reachable */
    let cur = parentOf.get(id);
    const guard = new Set<string>();
    while (cur && !guard.has(cur)) {
      guard.add(cur);
      expanded.add(cur);
      cur = parentOf.get(cur);
    }
    refresh();
    openPanel(id);
    centerOn(id);
  }

  function centerOn(id: string) {
    const p = pos.get(id);
    if (!p) return;
    const panelW = panel.classList.contains('is-open') && W > 860 ? panel.clientWidth : 0;
    view.x = (W - panelW) / 2 - (p.tx + p.ox) * view.k;
    view.y = H / 2 - (p.ty + p.oy) * view.k;
    applyViewTransform();
  }

  /* ---- pointer: click vs drag vs pan -----------------------------------
     setPointerCapture is applied only once a real drag starts. Capturing on
     every pointerdown retargets the following click to the <svg>, which is
     what made nodes unclickable.                                          */
  let downNode: string | null = null;
  let downX = 0;
  let downY = 0;
  let dragging = false;
  let panning = false;
  let activeId = -1;

  svg.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const g = (e.target as Element).closest('.node') as SVGGElement | null;
    downNode = g ? g.getAttribute('data-id') : null;
    downX = e.clientX;
    downY = e.clientY;
    dragging = false;
    panning = false;
    activeId = e.pointerId;
  });

  svg.addEventListener('pointermove', (e) => {
    if (e.pointerId !== activeId) return;
    const dx = e.clientX - downX;
    const dy = e.clientY - downY;

    if (!dragging && !panning) {
      if (Math.abs(dx) + Math.abs(dy) < DRAG_SLOP) return;
      if (downNode) dragging = true;
      else {
        panning = true;
        svg.classList.add('is-panning');
      }
      try {
        svg.setPointerCapture(e.pointerId);
      } catch {
        /* capture is a nicety, not a requirement */
      }
    }

    if (dragging && downNode) {
      const p = pos.get(downNode);
      if (p) {
        p.ox += (e.clientX - downX) / view.k;
        p.oy += (e.clientY - downY) / view.k;
      }
      paint();
    } else if (panning) {
      view.x += e.clientX - downX;
      view.y += e.clientY - downY;
      applyViewTransform();
    }
    downX = e.clientX;
    downY = e.clientY;
  });

  function endPointer(e: PointerEvent) {
    if (e.pointerId !== activeId) return;
    /* a press that never turned into a drag is a click */
    if (!dragging && !panning && downNode) select(downNode, true);
    if (dragging || panning) {
      try {
        svg.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
    }
    downNode = null;
    dragging = false;
    panning = false;
    activeId = -1;
    svg.classList.remove('is-panning');
  }

  svg.addEventListener('pointerup', endPointer);
  svg.addEventListener('pointercancel', endPointer);

  gNodes.addEventListener('keydown', (e) => {
    const ke = e as KeyboardEvent;
    if (ke.key !== 'Enter' && ke.key !== ' ') return;
    const g = (ke.target as Element).closest('.node') as SVGGElement | null;
    if (!g) return;
    ke.preventDefault();
    select(g.getAttribute('data-id')!, true);
  });

  gNodes.addEventListener('pointerover', (e) => {
    if (selected || dragging || panning) return;
    const g = (e.target as Element).closest('.node') as SVGGElement | null;
    if (g) highlight(g.getAttribute('data-id'));
  });

  gNodes.addEventListener('pointerout', (e) => {
    if (selected || dragging || panning) return;
    if ((e.target as Element).closest('.node')) highlight(null);
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

  svg.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const k2 = Math.max(0.3, Math.min(2.4, view.k * (e.deltaY < 0 ? 1.12 : 0.893)));
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
      refresh();
      highlight(selected);
      return;
    }
    nodes.forEach((n) => {
      if (!matchesFilter(n.id)) return;
      let cur = parentOf.get(n.id);
      const guard = new Set<string>();
      while (cur && !guard.has(cur)) {
        guard.add(cur);
        expanded.add(cur);
        cur = parentOf.get(cur);
      }
    });
    refresh();
    nodeEls.forEach((el, id) => {
      const hit = matchesFilter(id);
      el.classList.toggle('is-dim', !hit);
      el.classList.toggle('is-lit', hit);
    });
    linkEls.forEach((el) => el.classList.add('is-dim'));
  });

  /* ---- views ------------------------------------------------------------ */
  const index = root.querySelector<HTMLElement>('.vindex');
  root.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-view');
      root
        .querySelectorAll('[data-view]')
        .forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      index?.classList.toggle('is-open', mode === 'index');
    });
  });

  index?.addEventListener('click', (e) => {
    const it = (e.target as HTMLElement).closest<HTMLElement>('[data-goto]');
    if (!it) return;
    index.classList.remove('is-open');
    root
      .querySelectorAll('[data-view]')
      .forEach((b) => b.setAttribute('aria-pressed', String(b.getAttribute('data-view') === 'graph')));
    select(it.getAttribute('data-goto')!);
  });

  root.querySelector('[data-reset]')?.addEventListener('click', () => {
    expanded.clear();
    pos.forEach((p) => {
      p.ox = 0;
      p.oy = 0;
    });
    view.x = 0;
    view.y = 0;
    view.k = 1;
    applyViewTransform();
    closePanel();
    if (search) search.value = '';
    filter = '';
    refresh();
  });

  /* ---- resize ----------------------------------------------------------- */
  new ResizeObserver(() => {
    const w = svg.clientWidth;
    const h = svg.clientHeight;
    if (!w || !h || (w === W && h === H)) return;
    W = w;
    H = h;
    refresh();
  }).observe(svg);

  /* ---- boot ------------------------------------------------------------- */
  layout();
  pos.forEach((p) => {
    p.x = p.tx;
    p.y = p.ty;
  });
  render();
  paint();
  applyViewTransform();

  if (hint) {
    const dismiss = () => hint.classList.add('is-gone');
    svg.addEventListener('pointerdown', dismiss, { once: true });
    window.setTimeout(dismiss, 9000);
  }
}
