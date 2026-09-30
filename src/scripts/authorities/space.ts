/* The Authority of Space, as a dome seen side-on.

   Everything inside is a dot with a velocity, and every law you write is
   applied to the dots its target names - one law per category, twelve at
   most, exactly the mod's grammar of category, operation and target. The
   physics is a toy, not the mod's: the point is to feel that a law is a
   sentence about who it touches. */

import { alpha, button, canvas, h, loop, pointer, select, setOptions } from './dom';

type Kind = 'you' | 'player' | 'mob' | 'arrow' | 'item';
type Target = 'everything_except_user' | 'everything' | 'living_entities' | 'projectiles' | 'players';

const CATEGORIES: [string, string][] = [
  ['gravity', 'Gravity'],
  ['velocity', 'Velocity'],
  ['acceleration', 'Acceleration'],
  ['air', 'Air Resistance'],
  ['pressure', 'Pressure'],
  ['mass', 'Mass'],
  ['time', 'Time Flow'],
  ['vector', 'Vector Field'],
  ['entropy', 'Entropy'],
  ['friction', 'Friction'],
  ['boundary', 'Boundary'],
  ['collision', 'Collision'],
];

/* The operations, by category, with the mod's own short names and a line on
   what the toy does with each. Clear takes a law off. */
const OPS: Record<string, [string, string, string][]> = {
  gravity: [
    ['remove', 'Remove', 'nothing falls'],
    ['decrease', 'Decrease', 'things drift down like feathers'],
    ['increase', 'Increase', 'things slam into the floor'],
    ['reverse', 'Reverse', 'things fall up'],
    ['control', 'Control', 'down is wherever your pointer is'],
  ],
  velocity: [
    ['uniform', 'Uniform', 'whatever moves keeps moving, unchanged'],
    ['stop', 'Stop', 'nothing moves at all'],
  ],
  acceleration: [
    ['accelerate', 'Accelerate', 'every motion feeds itself'],
    ['decelerate', 'Decelerate', 'every motion bleeds away'],
    ['remove', 'Remove', 'no force changes anything - pure inertia'],
    ['reverse', 'Reverse', 'every push pulls'],
  ],
  air: [
    ['vacuum', 'Vacuum', 'no drag at all'],
    ['thin', 'Thin Air', 'a little less drag'],
    ['dense', 'Dense Air', 'like wading through water'],
    ['lock', 'Drag Lock', 'the air is nearly solid'],
  ],
  pressure: [
    ['crush', 'Crush', 'pressed hard into the floor'],
    ['expand', 'Expand', 'pushed out toward the wall'],
    ['implode', 'Implode', 'sucked into the middle'],
    ['burst', 'Burst', 'thrown outward in pulses'],
  ],
  mass: [
    ['lighten', 'Lighten', 'everything weighs less than half'],
    ['weigh', 'Weigh Down', 'everything weighs double'],
    ['anchor', 'Anchor', 'nothing can be moved sideways'],
    ['normalize', 'Normalize', 'every weight made the same'],
  ],
  time: [
    ['hasten', 'Hasten', 'time runs twice as fast'],
    ['slow', 'Slow', 'time crawls'],
    ['stasis', 'Stasis', 'time stops'],
    ['normalize', 'Normalize', 'time runs as it should'],
  ],
  vector: [
    ['north', 'North', 'a steady wind to the left'],
    ['south', 'South', 'a steady wind to the right'],
    ['orbit', 'Orbit', 'everything circles the middle'],
    ['converge', 'Converge', 'everything drawn to one point'],
  ],
  entropy: [
    ['stabilize', 'Stabilize', 'everything settles and goes still'],
    ['destabilize', 'Destabilize', 'everything jitters'],
    ['chaos', 'Chaos', 'everything is flung at random'],
  ],
  friction: [
    ['slippery', 'Slippery', 'the floor is ice'],
    ['sticky', 'Sticky', 'whatever lands stays where it lands'],
    ['normalize', 'Normalize', 'ordinary footing'],
  ],
  boundary: [
    ['seal', 'Seal', 'the wall holds everything in'],
    ['repel', 'Repel', 'the wall throws things back'],
    ['attract', 'Attract to Boundary', 'the wall pulls things onto it'],
    ['wrap', 'Wrap', 'leave one side, come in the other'],
  ],
  collision: [
    ['disable', 'Disable', 'things fall through the floor'],
    ['intensify', 'Intensify', 'every impact bounces harder'],
    ['selective', 'Selective', 'projectiles pass through, bodies do not'],
    ['ricochet', 'Ricochet', 'nothing loses speed when it hits'],
  ],
};

const TARGETS: [Target, string, string][] = [
  ['everything_except_user', 'Everything except you', 'everything except you'],
  ['everything', 'Everything', 'everything, you included'],
  ['living_entities', 'Living things', 'every living thing'],
  ['projectiles', 'Projectiles', 'every projectile'],
  ['players', 'Players', 'every player'],
];

const hits = (t: Target, k: Kind): boolean => {
  switch (t) {
    case 'everything':
      return true;
    case 'everything_except_user':
      return k !== 'you';
    case 'living_entities':
      return k === 'you' || k === 'player' || k === 'mob';
    case 'projectiles':
      return k === 'arrow';
    case 'players':
      return k === 'you' || k === 'player';
  }
};

const W = 420;
const H = 270;
const FLOOR = 250;
const CX = W / 2;
const R = 196;
const MID_Y = FLOOR - R * 0.45;
const G = 420;

interface Dot {
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  age: number;
  stuck: number;
  ang: number;
  trail: [number, number][];
}

export function mount(el: HTMLElement, color: string): void {
  const laws = new Map<string, { op: string; target: Target }>();
  let dots: Dot[] = [];
  let arrowClock = 0;
  let burstClock = 0;
  let aim: { x: number; y: number } | null = null;

  const dot = (kind: Kind, x: number, y: number, vx = 0, vy = 0): Dot => ({
    kind,
    x,
    y,
    vx,
    vy,
    r: kind === 'you' ? 8 : kind === 'player' ? 7 : kind === 'mob' ? 6 : kind === 'item' ? 4 : 3,
    age: 0,
    stuck: 0,
    ang: 0,
    trail: [],
  });

  const populate = () => {
    dots = [
      dot('you', CX, FLOOR - 8),
      dot('player', CX + 70, FLOOR - 7),
      dot('mob', CX - 120, FLOOR - 6, 30),
      dot('mob', CX - 60, FLOOR - 6, -25),
      dot('mob', CX + 30, FLOOR - 6, 20),
      dot('mob', CX + 120, FLOOR - 6, -30),
      dot('mob', CX - 20, FLOOR - 60, 0),
      dot('item', CX - 90, FLOOR - 4),
      dot('item', CX + 100, FLOOR - 4),
      dot('item', CX + 150, FLOOR - 40),
    ];
  };

  const lawFor = (cat: string, k: Kind): string | null => {
    const l = laws.get(cat);
    return l && hits(l.target, k) ? l.op : null;
  };

  const step = (d: Dot, dt: number) => {
    const time = lawFor('time', d.kind);
    const tf = time === 'hasten' ? 2 : time === 'slow' ? 0.3 : time === 'stasis' ? 0 : 1;
    if (tf === 0) return;
    const s = dt * tf;
    d.age += s;
    if (d.stuck > 0) {
      d.stuck += s;
      return;
    }

    const vel = lawFor('velocity', d.kind);
    if (vel === 'stop') {
      d.vx = 0;
      d.vy = 0;
      return;
    }

    let ax = 0;
    let ay = 0;
    const grav = lawFor('gravity', d.kind);
    const mass = lawFor('mass', d.kind);
    let gf = grav === 'remove' ? 0 : grav === 'decrease' ? 0.3 : grav === 'increase' ? 2.6 : grav === 'reverse' ? -1 : 1;
    if (mass === 'lighten') gf *= 0.45;
    if (mass === 'weigh') gf *= 2;
    if (grav === 'control') {
      const tx = aim ? aim.x : CX;
      const ty = aim ? aim.y : MID_Y;
      const dx = tx - d.x;
      const dy = ty - d.y;
      const n = Math.hypot(dx, dy) || 1;
      ax += (dx / n) * G;
      ay += (dy / n) * G;
    } else {
      ay += G * gf;
    }

    const pressure = lawFor('pressure', d.kind);
    const fromMidX = d.x - CX;
    const fromMidY = d.y - MID_Y;
    const midDist = Math.hypot(fromMidX, fromMidY) || 1;
    if (pressure === 'crush') ay += 900;
    if (pressure === 'expand') {
      ax += (fromMidX / midDist) * 500;
      ay += (fromMidY / midDist) * 500;
    }
    if (pressure === 'implode') {
      ax -= (fromMidX / midDist) * 900;
      ay -= (fromMidY / midDist) * 900;
    }

    const vector = lawFor('vector', d.kind);
    if (vector === 'north') ax -= 360;
    if (vector === 'south') ax += 360;
    if (vector === 'orbit') {
      ax += (-fromMidY / midDist) * 520 - (fromMidX / midDist) * 160;
      ay += (fromMidX / midDist) * 520 - (fromMidY / midDist) * 160;
    }
    if (vector === 'converge') {
      ax -= (fromMidX / midDist) * 480;
      ay -= (fromMidY / midDist) * 480;
    }

    const bound = lawFor('boundary', d.kind);
    const fromCx = d.x - CX;
    const fromCy = d.y - FLOOR;
    const wallDist = Math.hypot(fromCx, fromCy) || 1;
    if (bound === 'attract') {
      ax += (fromCx / wallDist) * 700;
      ay += (fromCy / wallDist) * 700;
    }

    const entropy = lawFor('entropy', d.kind);
    if (entropy === 'destabilize') {
      ax += (Math.random() - 0.5) * 1400;
      ay += (Math.random() - 0.5) * 1400;
    }
    if (entropy === 'chaos' && Math.random() < s * 3) {
      d.vx += (Math.random() - 0.5) * 700;
      d.vy += (Math.random() - 0.5) * 700;
    }

    const acc = lawFor('acceleration', d.kind);
    if (acc === 'reverse') {
      ax = -ax;
      ay = -ay;
    }
    if (acc === 'remove' || vel === 'uniform') {
      ax = 0;
      ay = 0;
    }
    if (mass === 'anchor') ax = 0;

    d.vx += ax * s;
    d.vy += ay * s;
    if (acc === 'accelerate') {
      d.vx *= 1 + 1.4 * s;
      d.vy *= 1 + 1.4 * s;
    }
    if (acc === 'decelerate') {
      d.vx *= Math.exp(-3 * s);
      d.vy *= Math.exp(-3 * s);
    }
    if (entropy === 'stabilize') {
      d.vx *= Math.exp(-4 * s);
      d.vy *= Math.exp(-4 * s);
    }

    const air = lawFor('air', d.kind);
    const drag = air === 'vacuum' ? 0 : air === 'thin' ? 0.15 : air === 'dense' ? 3 : air === 'lock' ? 14 : 0.5;
    if (vel !== 'uniform') {
      d.vx *= Math.exp(-drag * s);
      d.vy *= Math.exp(-drag * s);
    }
    if (mass === 'anchor') d.vx = 0;

    /* Speed is capped so an accelerating law cannot run off to infinity. */
    const sp = Math.hypot(d.vx, d.vy);
    if (sp > 900) {
      d.vx *= 900 / sp;
      d.vy *= 900 / sp;
    }

    d.x += d.vx * s;
    d.y += d.vy * s;

    /* The floor. */
    const coll = lawFor('collision', d.kind);
    const through = coll === 'disable' || (coll === 'selective' && d.kind === 'arrow');
    if (d.y > FLOOR - d.r) {
      if (through) {
        if (d.y > H + 10) {
          d.y = FLOOR - R + 20;
          d.x = CX + (d.x - CX) * 0.2;
        }
      } else if (d.kind === 'arrow' && !coll) {
        d.y = FLOOR - d.r;
        d.stuck = 0.0001;
        d.vx = 0;
        d.vy = 0;
      } else {
        d.y = FLOOR - d.r;
        const e = coll === 'ricochet' ? 1 : coll === 'intensify' ? 1.25 : 0.25;
        d.vy = d.vy > 0 ? -d.vy * e : d.vy;
        if (coll === 'intensify' && Math.abs(d.vy) < 120) d.vy = -160;
        const fr = lawFor('friction', d.kind);
        if (fr === 'sticky') {
          d.vx = 0;
          d.vy = 0;
        } else if (fr !== 'slippery') {
          d.vx *= Math.exp(-7 * s);
        }
      }
    }

    /* The wall. */
    const fx = d.x - CX;
    const fy = d.y - FLOOR;
    const dist = Math.hypot(fx, fy);
    if (dist > R - d.r && d.y < FLOOR + 1) {
      const nx = fx / dist;
      const ny = fy / dist;
      if (bound === 'wrap') {
        d.x = CX - fx * 0.94;
        d.y = FLOOR + fy * 0.94;
        if (d.y > FLOOR - d.r) d.y = FLOOR - d.r - 1;
      } else {
        d.x = CX + nx * (R - d.r);
        d.y = FLOOR + ny * (R - d.r);
        const vn = d.vx * nx + d.vy * ny;
        if (vn > 0) {
          const e = bound === 'repel' ? 1.6 : bound === 'attract' ? 0 : coll === 'ricochet' ? 1 : 0.5;
          d.vx -= (1 + e) * vn * nx;
          d.vy -= (1 + e) * vn * ny;
          if (bound === 'repel') {
            d.vx -= nx * 120;
            d.vy -= ny * 120;
          }
        }
        if (d.kind === 'arrow' && !bound && !coll) {
          d.stuck = 0.0001;
          d.vx = 0;
          d.vy = 0;
        }
      }
    }
  };

  const burst = () => {
    for (const d of dots) {
      if (lawFor('pressure', d.kind) !== 'burst') continue;
      if (lawFor('time', d.kind) === 'stasis') continue;
      const dx = d.x - CX;
      const dy = d.y - MID_Y;
      const n = Math.hypot(dx, dy) || 1;
      d.vx += (dx / n) * 420;
      d.vy += (dy / n) * 420;
      d.stuck = 0;
    }
  };

  /* ---------------------------------------------------------- controls -- */

  const cat = select(CATEGORIES.map(([v, l]) => ({ value: v, label: l })), () => refreshOps());
  const op = select([], () => {});
  const target = select(TARGETS.map(([v, l]) => ({ value: v, label: l })), () => {});
  const refreshOps = () => {
    setOptions(op, [
      ...OPS[cat.value].map(([v, l]) => ({ value: v, label: l })),
      { value: 'clear', label: 'Clear' },
    ]);
  };
  refreshOps();

  const read = h('p', { class: 'tread', 'aria-live': 'polite' });
  const written = h('div', { class: 'space-laws' });

  const catLabel = (c: string) => CATEGORIES.find(([v]) => v === c)![1];
  const opOf = (c: string, o: string) => OPS[c].find(([v]) => v === o)!;
  const targetWords = (t: Target) => TARGETS.find(([v]) => v === t)![2];

  const say = (html: string) => {
    read.innerHTML = `${html}<br><span style="color:var(--ash-dim)">${laws.size} of 12 laws in force.</span>`;
  };

  const renderLaws = () => {
    written.textContent = '';
    for (const [c] of CATEGORIES) {
      const l = laws.get(c);
      if (!l) continue;
      written.append(
        h(
          'button',
          {
            type: 'button',
            class: 'tbtn space-law',
            title: 'Clear this law',
            onclick: () => {
              laws.delete(c);
              renderLaws();
              say(`<b>${catLabel(c)}</b> is back to normal.`);
            },
          },
          `${catLabel(c)}: ${opOf(c, l.op)[1]} → ${TARGETS.find(([v]) => v === l.target)![1]} ×`,
        ),
      );
    }
  };

  const write = () => {
    const c = cat.value;
    if (op.value === 'clear') {
      laws.delete(c);
      renderLaws();
      say(`<b>${catLabel(c)}</b> cleared.`);
      return;
    }
    const t = target.value as Target;
    laws.set(c, { op: op.value, target: t });
    for (const d of dots) d.stuck = 0;
    renderLaws();
    const [, label, note] = opOf(c, op.value);
    say(`<b>${catLabel(c)}: ${label}</b> for ${targetWords(t)} - ${note}.`);
  };

  const { el: cv, ctx } = canvas(W, H);
  cv.addEventListener('pointermove', (e) => {
    aim = pointer(cv, e as MouseEvent, W, H);
  });
  cv.addEventListener('pointerleave', () => {
    aim = null;
  });

  el.append(
    h('style', {}, `
      .space-laws { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
      .space-law { font-size: 10.5px; padding: 4px 7px; }
    `),
    cv,
    h('span', { class: 'tlabel' }, 'Category · operation · target'),
    h('div', { class: 'tgrid-3' }, cat, op, target),
    h(
      'div',
      { class: 'trow' },
      button('Write the law', write, 'tbtn tbtn--go'),
      button('Clear all', () => {
        laws.clear();
        renderLaws();
        say('Every law taken off. The dome is ordinary space again.');
      }),
      button('Reset the dome', () => {
        populate();
        say('Everything put back where it started.');
      }),
    ),
    written,
    read,
  );

  target.value = 'everything_except_user';
  populate();
  say('Nothing written yet. Try <b>Gravity: Reverse</b> for everything except you.');

  /* ---------------------------------------------------------- drawing --- */

  const COLORS: Record<Kind, string> = {
    you: color,
    player: '#E7F1F5',
    mob: '#9FB889',
    arrow: '#E8C36A',
    item: '#C9A36A',
  };

  const draw = () => {
    ctx.clearRect(0, 0, W, H);

    /* The pane, a notch per category (lit while its law is in force), the floor. */
    ctx.beginPath();
    ctx.arc(CX, FLOOR, R, Math.PI, 0);
    ctx.closePath();
    ctx.fillStyle = alpha(color, 0.04);
    ctx.fill();
    ctx.strokeStyle = alpha(color, laws.get('boundary') ? 0.8 : 0.4);
    ctx.lineWidth = laws.get('boundary') ? 2 : 1;
    ctx.beginPath();
    ctx.arc(CX, FLOOR, R, Math.PI, 0);
    ctx.stroke();
    ctx.lineWidth = 1;

    CATEGORIES.forEach(([c], i) => {
      const a = Math.PI + ((i + 0.5) / CATEGORIES.length) * Math.PI;
      const lit = laws.has(c);
      const len = lit ? 14 : 7;
      ctx.strokeStyle = lit ? color : alpha(color, 0.25);
      ctx.lineWidth = lit ? 3 : 1.5;
      ctx.beginPath();
      ctx.moveTo(CX + Math.cos(a) * R, FLOOR + Math.sin(a) * R);
      ctx.lineTo(CX + Math.cos(a) * (R - len), FLOOR + Math.sin(a) * (R - len));
      ctx.stroke();
    });
    ctx.lineWidth = 1;

    ctx.strokeStyle = '#2B3D4B';
    ctx.beginPath();
    ctx.moveTo(CX - R, FLOOR + 0.5);
    ctx.lineTo(CX + R, FLOOR + 0.5);
    ctx.stroke();

    if (laws.get('gravity')?.op === 'control' && aim) {
      ctx.strokeStyle = alpha(color, 0.5);
      ctx.beginPath();
      ctx.arc(aim.x, aim.y, 6, 0, Math.PI * 2);
      ctx.stroke();
    }

    for (const d of dots) {
      const frozen = lawFor('time', d.kind) === 'stasis';
      if (d.trail.length > 1) {
        ctx.strokeStyle = alpha(COLORS[d.kind], 0.25);
        ctx.beginPath();
        d.trail.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
      }
      ctx.fillStyle = COLORS[d.kind];
      ctx.strokeStyle = COLORS[d.kind];
      if (d.kind === 'arrow') {
        if (Math.hypot(d.vx, d.vy) > 1) d.ang = Math.atan2(d.vy, d.vx);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(d.x - Math.cos(d.ang) * 8, d.y - Math.sin(d.ang) * 8);
        ctx.lineTo(d.x + Math.cos(d.ang) * 4, d.y + Math.sin(d.ang) * 4);
        ctx.stroke();
        ctx.lineWidth = 1;
      } else if (d.kind === 'item') {
        ctx.fillRect(d.x - d.r, d.y - d.r, d.r * 2, d.r * 2);
      } else if (d.kind === 'you') {
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 1;
      } else {
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
      }
      if (frozen) {
        ctx.strokeStyle = alpha('#BDE7F6', 0.7);
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r + 3, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    ctx.font = '9px "IBM Plex Mono", monospace';
    const legend: [Kind, string][] = [['you', 'you'], ['player', 'player'], ['mob', 'mob'], ['arrow', 'arrow'], ['item', 'item']];
    legend.forEach(([k, l], i) => {
      ctx.fillStyle = COLORS[k];
      ctx.fillText(l, 6 + i * 48, 12);
    });
  };

  loop(cv, (dt) => {
    arrowClock += dt;
    burstClock += dt;
    if (arrowClock > 1.3) {
      arrowClock = 0;
      const fromLeft = Math.random() < 0.5;
      dots.push(dot('arrow', fromLeft ? CX - R + 24 : CX + R - 24, FLOOR - 40, fromLeft ? 250 : -250, -230));
    }
    if (burstClock > 1.6) {
      burstClock = 0;
      burst();
    }
    const sub = 3;
    for (let i = 0; i < sub; i++) for (const d of dots) step(d, dt / sub);
    for (const d of dots) {
      if (d.stuck === 0 && Math.hypot(d.vx, d.vy) > 20) {
        d.trail.push([d.x, d.y]);
        if (d.trail.length > 10) d.trail.shift();
      } else if (d.trail.length) {
        d.trail.shift();
      }
    }
    dots = dots.filter((d) => !(d.kind === 'arrow' && (d.stuck > 1.5 || d.age > 9)));
    draw();
  });
  draw();
}
