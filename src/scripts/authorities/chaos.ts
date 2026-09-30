/* The Authority of Chaos, as a patch of ground seen from above.

   A straight port of the mod's Pile: sites hold stress up to a capacity, a
   site over it gives way by the fault for its generation, and a neighbour
   that was already full gives way in turn. The rules below are the mod's -
   ROOT swallows and thickens, SHED and an empty recipient list spend the
   stress as harm where it stands (1.5 a unit, over 1.5 + 0.3 a unit blocks),
   a site that has given way is slack and takes nothing more, and there is no
   random number anywhere. The one liberty is the ground: one layer, sloping
   down to the right, so Slump has a downhill to find. */

import { alpha, button, canvas, h, loop, pointer, select } from './dom';

type Fault = 'SLUMP' | 'HEAP' | 'BLOOM' | 'HUNT' | 'RECOIL' | 'SHED' | 'ROOT';

const FAULTS: { id: Fault; label: string; line: string }[] = [
  { id: 'SLUMP', label: 'Slump', line: 'all of it to the lowest neighbour' },
  { id: 'HEAP', label: 'Heap', line: 'to whichever holds most' },
  { id: 'BLOOM', label: 'Bloom', line: 'split evenly' },
  { id: 'HUNT', label: 'Hunt', line: 'only into living things' },
  { id: 'RECOIL', label: 'Recoil', line: 'back the way it came' },
  { id: 'SHED', label: 'Shed', line: 'spent as harm where it stands' },
  { id: 'ROOT', label: 'Root', line: 'swallowed; the site thickens' },
];

const COLS = 11;
const ROWS = 7;
const CELL = 36;
const W = COLS * CELL;
const H = ROWS * CELL;
const SLACK_MS = 30_000;
const CRIT_MS = 10_000;
const STEP_MS = 110;

type Mat = { name: string; cap: number; fill: string };
const STONE: Mat = { name: 'Stone', cap: 4, fill: '#3A4148' };
const DIRT: Mat = { name: 'Dirt', cap: 2, fill: '#4A3A2A' };
const GLASS: Mat = { name: 'Glass', cap: 1, fill: '#2C4A55' };

interface Body {
  id: string;
  name: string;
  x: number;
  y: number;
  cap: number;
  hp: number;
  maxHp: number;
  you: boolean;
}

interface Step {
  site: string;
  gen: number;
  from: string | null;
}

interface Burst {
  x: number;
  y: number;
  r: number;
  t: number;
}

export function mount(el: HTMLElement, color: string): void {
  const mats: Mat[] = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      let m = STONE;
      if (y === 3 && x >= 2 && x <= 8) m = DIRT;
      if ((x === 5 && y === 1) || (x === 9 && y === 5)) m = GLASS;
      mats.push(m);
    }
  }
  /* Downhill to the right, with a shallow valley along the path. */
  const heightOf = (x: number, y: number) => (COLS - x) * 1.0 + Math.abs(y - 3) * 0.35;

  let bodies: Body[] = [];
  const stress = new Map<string, number>();
  const slackUntil = new Map<string, number>();
  const reinforced = new Map<string, number>();
  let queue: Step[] = [];
  const queued = new Set<string>();
  let critUntil = 0;
  let tool: 'burden' | 'grain' = 'burden';
  const fracture: Fault[] = ['SLUMP', 'SLUMP', 'HEAP', 'SHED', 'SHED'];
  let bursts: Burst[] = [];
  let flashes = new Map<string, number>();
  let tally = { gave: 0, shed: 0, harm: 0 };
  let acc = 0;

  const reset = () => {
    bodies = [
      { id: 'e:you', name: 'You', x: 1, y: 3, cap: 3, hp: 20, maxHp: 20, you: true },
      { id: 'e:h1', name: 'Husk', x: 7, y: 2, cap: 2, hp: 20, maxHp: 20, you: false },
      { id: 'e:h2', name: 'Husk', x: 8, y: 4, cap: 2, hp: 20, maxHp: 20, you: false },
      { id: 'e:h3', name: 'Husk', x: 9, y: 3, cap: 2, hp: 20, maxHp: 20, you: false },
    ];
    stress.clear();
    slackUntil.clear();
    reinforced.clear();
    queue = [];
    queued.clear();
    critUntil = 0;
    bursts = [];
    flashes = new Map();
    tally = { gave: 0, shed: 0, harm: 0 };
    say('Click the ground to <b>Burden</b> it. Load a line of stone to 4/4 toward the husks, then switch to <b>The Last Grain</b>.');
  };

  const block = (x: number, y: number) => `b:${x},${y}`;
  const isBlock = (s: string) => s.startsWith('b:');
  const xyOf = (s: string): [number, number] => {
    if (isBlock(s)) {
      const [x, y] = s.slice(2).split(',').map(Number);
      return [x, y];
    }
    const b = bodies.find((q) => q.id === s)!;
    return [b.x, b.y];
  };
  const bodyAt = (x: number, y: number) => bodies.filter((b) => b.x === x && b.y === y);
  const present = (s: string) => isBlock(s) || bodies.some((b) => b.id === s);
  const now = () => performance.now();

  const baseCap = (s: string) => {
    if (isBlock(s)) {
      const [x, y] = xyOf(s);
      return mats[y * COLS + x].cap;
    }
    return bodies.find((b) => b.id === s)?.cap ?? 0;
  };
  const capacity = (s: string) => Math.max(0, baseCap(s) + (reinforced.get(s) ?? 0) - (now() < critUntil ? 1 : 0));
  const held = (s: string) => stress.get(s) ?? 0;
  const slack = (s: string) => now() < (slackUntil.get(s) ?? -Infinity);
  const over = (s: string) => held(s) > capacity(s);
  const height = (s: string) => {
    const [x, y] = xyOf(s);
    return isBlock(s) ? heightOf(x, y) : heightOf(x, y) + 1;
  };

  /* Block: its four sides in a fixed order, then whoever stands on it.
     Body: the ground under it, then bodies beside it. Stable order, as in the
     mod, because a sandpile breaks its ties by neighbour order. */
  const neighbours = (s: string): string[] => {
    const [x, y] = xyOf(s);
    const out: string[] = [];
    if (isBlock(s)) {
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < COLS && ny < ROWS) out.push(block(nx, ny));
      }
      for (const b of bodyAt(x, y)) out.push(b.id);
      return out;
    }
    out.push(block(x, y));
    for (const b of bodies) {
      if (b.id !== s && Math.abs(b.x - x) <= 1 && Math.abs(b.y - y) <= 1) out.push(b.id);
    }
    return out;
  };

  const arm = (s: string, gen: number, from: string | null) => {
    if (slack(s) || !over(s)) return;
    if (!queued.has(s)) {
      queued.add(s);
      queue.push({ site: s, gen, from });
    }
  };

  const add = (s: string): boolean => {
    if (slack(s)) return false;
    stress.set(s, held(s) + 1);
    arm(s, 1, null);
    return true;
  };

  const recipients = (s: string, fault: Fault, from: string | null): string[] => {
    if (fault === 'SHED') return [];
    if (fault === 'RECOIL') return from && present(from) ? [from] : [];
    const n = neighbours(s);
    if (!n.length) return [];
    if (fault === 'SLUMP') {
      let best = n[0];
      for (const q of n) if (height(q) < height(best)) best = q;
      return [best];
    }
    if (fault === 'HEAP') {
      let best = n[0];
      for (const q of n) if (held(q) > held(best)) best = q;
      return [best];
    }
    if (fault === 'HUNT') return n.filter((q) => !isBlock(q));
    return n;
  };

  const shed = (s: string, amount: number) => {
    const [x, y] = xyOf(s);
    const cx = x + 0.5;
    const cy = y + 0.5;
    const r = 1.5 + amount * 0.3;
    const dmg = 1.5 * amount;
    tally.shed++;
    bursts.push({ x: cx, y: cy, r, t: 0 });
    for (const b of [...bodies]) {
      const d = Math.hypot(b.x + 0.5 - cx, b.y + 0.5 - cy);
      if (d <= r) {
        b.hp = Math.max(0, b.hp - dmg);
        tally.harm += dmg;
        flashes.set(b.id, now());
      }
    }
    /* A body that dies is forgotten: its stress leaves the Pile with it. */
    for (const b of bodies.filter((q) => q.hp <= 0)) stress.delete(b.id);
    bodies = bodies.filter((q) => q.hp > 0);
  };

  const giveWay = (step: Step) => {
    const s = step.site;
    const amount = held(s);
    if (amount <= 0) return;
    const fault = fracture[Math.min(step.gen, fracture.length) - 1];
    if (fault === 'ROOT') {
      const extra = amount - capacity(s);
      if (extra > 0) reinforced.set(s, (reinforced.get(s) ?? 0) + extra);
      return;
    }
    stress.delete(s);
    slackUntil.set(s, now() + SLACK_MS);
    flashes.set(s, now());
    tally.gave++;
    const to = recipients(s, fault, step.from);
    if (!to.length) {
      shed(s, amount);
      return;
    }
    const each = Math.floor(amount / to.length);
    const rem = amount % to.length;
    to.forEach((t, i) => {
      const give = each + (i < rem ? 1 : 0);
      if (give <= 0) return;
      stress.set(t, held(t) + give);
      arm(t, step.gen + 1, s);
    });
  };

  const settleOne = () => {
    while (queue.length) {
      const step = queue.shift()!;
      queued.delete(step.site);
      if (!present(step.site)) {
        stress.delete(step.site);
        continue;
      }
      if (slack(step.site) || !over(step.site)) continue;
      giveWay(step);
      return true;
    }
    return false;
  };

  /* ---------------------------------------------------------- the view -- */

  const { el: cv, ctx } = canvas(W, H);
  const read = h('p', { class: 'tread', 'aria-live': 'polite' });
  const say = (html: string) => {
    read.innerHTML = html;
  };

  const toolBurden = button('Burden', () => setTool('burden'));
  const toolGrain = button('The Last Grain', () => setTool('grain'));
  const setTool = (t: 'burden' | 'grain') => {
    tool = t;
    toolBurden.setAttribute('aria-pressed', String(t === 'burden'));
    toolGrain.setAttribute('aria-pressed', String(t === 'grain'));
  };

  const crit = button('Criticality', () => {
    critUntil = now() + CRIT_MS;
    let armed = 0;
    for (const s of [...stress.keys()]) {
      const before = queued.size;
      arm(s, 1, null);
      if (queued.size > before) armed++;
    }
    tally = { gave: 0, shed: 0, harm: 0 };
    say(armed
      ? `Every capacity drops by one for ten seconds. <b>${armed}</b> loaded site${armed === 1 ? '' : 's'} let go at once.`
      : 'Every capacity drops by one - but nothing here was loaded, so it is an expensive shimmer.');
  });

  const gates = h('div', { class: 'chaos-gates' });
  fracture.forEach((f, i) => {
    const s = select(FAULTS.map((q) => ({ value: q.id, label: `${i + 1}. ${q.label}` })), (v) => {
      fracture[i] = v as Fault;
      const q = FAULTS.find((z) => z.id === v)!;
      s.title = q.line;
      say(`Wave ${i + 1}${i === 4 ? ' and deeper' : ''}: <b>${q.label}</b> - ${q.line}.`);
    });
    s.value = f;
    s.title = FAULTS.find((z) => z.id === f)!.line;
    gates.append(s);
  });

  cv.addEventListener('click', (e) => {
    const p = pointer(cv, e as MouseEvent, W, H);
    const x = Math.floor(p.x / CELL);
    const y = Math.floor(p.y / CELL);
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return;
    /* A body standing there is what the crosshair meets first. */
    const inCell = { x: p.x / CELL - x, y: p.y / CELL - y };
    const onBody = bodyAt(x, y).find(() => Math.hypot(inCell.x - 0.5, inCell.y - 0.42) < 0.3);
    const site = onBody ? onBody.id : block(x, y);
    const name = onBody ? onBody.name : mats[y * COLS + x].name;
    if (slack(site)) {
      say(`That ${name.toLowerCase()} has already given way. It is dead ground for another <b>${Math.ceil(((slackUntil.get(site) ?? 0) - now()) / 1000)} s</b>.`);
      return;
    }
    if (tool === 'grain' && held(site) <= 0) {
      say('The Last Grain only lands on a site that already holds stress. <b>Nothing there.</b>');
      return;
    }
    tally = { gave: 0, shed: 0, harm: 0 };
    add(site);
    if (queue.length) {
      say(tool === 'grain'
        ? `The last grain. <b>${name}</b> is over - the avalanche begins.`
        : `<b>${name}</b> is over its capacity and gives way.`);
    } else {
      say(`${tool === 'grain' ? 'A click, and nothing else. ' : ''}<b>${name}</b> ${held(site)}/${capacity(site)}${held(site) === capacity(site) ? ' - full. One more and it goes.' : ''}`);
    }
  });

  const style = h('style', {}, `
    .chaos-gates { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 4px; }
    @media (max-width: 480px) { .chaos-gates { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  `);

  el.append(
    style,
    cv,
    h('div', { class: 'trow' }, toolBurden, toolGrain, crit, button('Reset', reset)),
    h('span', { class: 'tlabel' }, 'Your Fracture - one fault per wave of the cascade'),
    gates,
    read,
  );

  setTool('burden');
  reset();

  /* ---------------------------------------------------------- drawing --- */

  const draw = () => {
    const t = now();
    ctx.clearRect(0, 0, W, H);
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const s = block(x, y);
        const m = mats[y * COLS + x];
        const px = x * CELL;
        const py = y * CELL;
        /* Lower ground is darker, so downhill reads without a legend. */
        const shade = 0.55 + (heightOf(x, y) / (COLS + 1)) * 0.45;
        ctx.globalAlpha = shade;
        ctx.fillStyle = m.fill;
        ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);
        ctx.globalAlpha = 1;

        if (slack(s)) {
          ctx.fillStyle = 'rgba(0,0,0,0.55)';
          ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);
          ctx.save();
          ctx.beginPath();
          ctx.rect(px + 1, py + 1, CELL - 2, CELL - 2);
          ctx.clip();
          ctx.strokeStyle = 'rgba(255,255,255,0.12)';
          ctx.beginPath();
          for (let k = -CELL; k < CELL; k += 6) {
            ctx.moveTo(px + k, py + CELL);
            ctx.lineTo(px + k + CELL, py);
          }
          ctx.stroke();
          ctx.restore();
        }

        const n = held(s);
        const cap = capacity(s);
        if (n > 0) {
          /* One grain per unit, laid in a little grid, the count over it. */
          const full = n >= cap;
          ctx.fillStyle = full ? color : alpha(color, 0.75);
          for (let k = 0; k < n; k++) {
            const gx = px + 8 + (k % 4) * 6;
            const gy = py + CELL - 9 - Math.floor(k / 4) * 6;
            ctx.fillRect(gx, gy, 4, 4);
          }
          ctx.fillStyle = full ? color : '#C9D1D6';
          ctx.font = '10px "IBM Plex Mono", monospace';
          ctx.fillText(`${n}/${cap}`, px + 4, py + 12);
        }

        const f = flashes.get(s);
        if (f && t - f < 500) {
          ctx.strokeStyle = alpha(color, 1 - (t - f) / 500);
          ctx.lineWidth = 2;
          ctx.strokeRect(px + 2, py + 2, CELL - 4, CELL - 4);
          ctx.lineWidth = 1;
        }
      }
    }

    ctx.fillStyle = 'rgba(200,215,225,0.35)';
    ctx.font = '9px "IBM Plex Mono", monospace';
    ctx.fillText('downhill →', W - 62, H - 4);

    for (const b of bodies) {
      const cx = b.x * CELL + CELL / 2;
      const cy = b.y * CELL + CELL * 0.42;
      const hit = flashes.get(b.id);
      ctx.beginPath();
      ctx.arc(cx, cy, 10, 0, Math.PI * 2);
      ctx.fillStyle = hit && t - hit < 300 ? '#FFFFFF' : b.you ? '#1B2630' : '#3B4A2E';
      ctx.fill();
      ctx.strokeStyle = b.you ? color : '#9FB889';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.lineWidth = 1;
      const n = held(b.id);
      ctx.font = '9px "IBM Plex Mono", monospace';
      if (n > 0) {
        ctx.fillStyle = color;
        ctx.fillText(`${n}/${capacity(b.id)}`, cx - 9, cy + 3);
      } else {
        ctx.fillStyle = '#E7F1F5';
        ctx.fillText(b.you ? 'you' : 'husk', cx - (b.you ? 8 : 10), cy + 3);
      }
      ctx.fillStyle = '#0A0F14';
      ctx.fillRect(cx - 12, cy + 13, 24, 3);
      ctx.fillStyle = b.hp > 8 ? '#7FE0A8' : '#FF8A8A';
      ctx.fillRect(cx - 12, cy + 13, 24 * (b.hp / b.maxHp), 3);
    }

    bursts = bursts.filter((b) => b.t < 1);
    for (const b of bursts) {
      ctx.beginPath();
      ctx.arc(b.x * CELL, b.y * CELL, b.r * CELL * (0.4 + 0.6 * b.t), 0, Math.PI * 2);
      ctx.strokeStyle = alpha(color, 1 - b.t);
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.lineWidth = 1;
    }

    if (t < critUntil) {
      ctx.strokeStyle = alpha(color, 0.5 + 0.3 * Math.sin(t / 120));
      ctx.lineWidth = 3;
      ctx.strokeRect(1.5, 1.5, W - 3, H - 3);
      ctx.lineWidth = 1;
      ctx.fillStyle = color;
      ctx.font = '10px "IBM Plex Mono", monospace';
      ctx.fillText(`CRITICALITY ${Math.ceil((critUntil - t) / 1000)}s`, 6, H - 6);
    }
  };

  let wasSettling = false;
  loop(cv, (dt) => {
    for (const b of bursts) b.t += dt * 1.6;
    acc += dt * 1000;
    let moved = false;
    while (acc >= STEP_MS) {
      acc -= STEP_MS;
      if (settleOne()) moved = true;
    }
    if (moved) wasSettling = true;
    if (wasSettling && !queue.length) {
      wasSettling = false;
      const gone = 3 - bodies.filter((b) => !b.you).length;
      const you = bodies.find((b) => b.you);
      say(`The cascade settles: <b>${tally.gave}</b> give-way${tally.gave === 1 ? '' : 's'}, <b>${tally.shed}</b> shed as harm, <b>${tally.harm.toFixed(1)}</b> damage dealt. ${gone ? `<span class="tgood">${gone} husk${gone === 1 ? '' : 's'} gone.</span> ` : ''}${you && you.hp < you.maxHp ? '<span class="tbad">You were caught in it too.</span>' : ''}${!you ? '<span class="tbad">You died in your own avalanche.</span>' : ''}`);
    }
    draw();
  });
  draw();
}
