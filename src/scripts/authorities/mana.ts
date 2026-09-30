/* The Authority of Mana, as one incantation and a golem to read it at.

   A small reciter in the mod's shape: a press reads `breath` verses off the
   row from where the last press stopped; a multicast and a modifier each
   draw more verses without spending breath; a modifier is stamped onto the
   bodies drawn after it in the same shot; a verse you cannot afford is
   skipped; a press that reaches the end of the row rests, and the next one
   starts over. The costs and damage are the mod's own numbers for these
   twenty verses. */

import { alpha, button, canvas, h, loop, select } from './dom';

type Type = 'projectile' | 'static' | 'multicast' | 'modifier';

interface Verse {
  id: string;
  name: string;
  type: Type;
  mana: number;
  damage?: number;
  speed?: number;
  draws?: number;
  fan?: number;
  mod?: Partial<Stamp>;
  radius?: number;
}

interface Stamp {
  damage: number;
  speed: number;
  noSpread: boolean;
  crit: number;
  bounces: number;
  seeker: boolean;
  blast: number;
}

const VERSES: Verse[] = [
  { id: 'needle', name: 'Needle', type: 'projectile', mana: 4, damage: 3, speed: 1.6 },
  { id: 'orb', name: 'Orb', type: 'projectile', mana: 7, damage: 5, speed: 1.0 },
  { id: 'shard', name: 'Shard', type: 'projectile', mana: 12, damage: 9, speed: 0.7 },
  { id: 'ember', name: 'Ember', type: 'projectile', mana: 14, damage: 6, speed: 0.9 },
  { id: 'arc_bolt', name: 'Arc Bolt', type: 'projectile', mana: 16, damage: 7, speed: 2.0 },
  { id: 'whisper', name: 'Whisper', type: 'projectile', mana: 1, damage: 2.5, speed: 0.6 },
  { id: 'detonation', name: 'Detonation', type: 'static', mana: 20, damage: 8, radius: 3 },
  { id: 'rime_ring', name: 'Rime Ring', type: 'static', mana: 14, damage: 5, radius: 3 },
  { id: 'couplet', name: 'Couplet', type: 'multicast', mana: 0, draws: 2 },
  { id: 'tercet', name: 'Tercet', type: 'multicast', mana: 2, draws: 3 },
  { id: 'quatrain', name: 'Quatrain', type: 'multicast', mana: 4, draws: 4 },
  { id: 'trident', name: 'Trident', type: 'multicast', mana: 3, draws: 3, fan: 20 },
  { id: 'octave', name: 'Octave', type: 'multicast', mana: 12, draws: 8 },
  { id: 'haste', name: 'Haste', type: 'modifier', mana: 2, mod: { speed: 2.5 } },
  { id: 'keen_edge', name: 'Keen Edge', type: 'modifier', mana: 3, mod: { crit: 15 } },
  { id: 'ricochet', name: 'Ricochet', type: 'modifier', mana: 2, mod: { bounces: 10 } },
  { id: 'weight', name: 'Weight', type: 'modifier', mana: 3, mod: { damage: 2.5 } },
  { id: 'true_aim', name: 'True Aim', type: 'modifier', mana: 1, mod: { noSpread: true } },
  { id: 'seeker', name: 'Seeker', type: 'modifier', mana: 12, mod: { seeker: true } },
  { id: 'volatile', name: 'Volatile', type: 'modifier', mana: 8, mod: { blast: 1.5, speed: 0.75 } },
];

const BY_ID = new Map(VERSES.map((v) => [v.id, v]));
const TYPE_COLOR: Record<Type, string> = {
  projectile: '#8FD3EC',
  static: '#E8A33D',
  multicast: '#BDA4FF',
  modifier: '#7FE0A8',
};
const TYPE_WORD: Record<Type, string> = {
  projectile: 'Projectiles',
  static: 'Statics',
  multicast: 'Multicasts',
  modifier: 'Modifiers',
};

const ROW = 20;
const POOL = 100;
const REGEN = 12;
const W = 420;
const H = 170;
const HAND = { x: 30, y: 95 };
const GOLEM = { x: 380, y: 95, r: 16 };

interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  s: Stamp;
  dmg: number;
  life: number;
  color: string;
  fixed: boolean;
  radius: number;
  bounces: number;
  done: boolean;
}

const PRESETS: [string, string[], number][] = [
  ['Trident of needles', ['trident', 'needle', 'needle', 'needle'], 1],
  ['Hasted seeker shard', ['haste', 'seeker', 'shard'], 1],
  ['Volatile orbs', ['couplet', 'volatile', 'orb', 'orb'], 1],
  ['A cheap stream', ['needle', 'needle', 'whisper', 'needle'], 2],
];

export function mount(el: HTMLElement, color: string): void {
  let row: string[] = [];
  let breath = 1;
  let cursor = 0;
  let mana = POOL;
  let lastRead = new Set<number>();
  let bodies: Body[] = [];
  let landed = 0;
  let golemFlash = 0;

  const read = h('p', { class: 'tread', 'aria-live': 'polite' });
  const say = (html: string) => {
    read.innerHTML = html;
  };

  /* ------------------------------------------------------------ recite -- */

  const recite = () => {
    if (!row.length) return say('The row is empty. Click verses in the palette to write them.');
    const start = cursor;
    const inHand = new Set<number>();
    const bills: string[] = [];
    const skipped: string[] = [];
    const planned: { v: Verse; s: Stamp; fan: number }[] = [];
    let spent = 0;
    let rests = false;
    const stamp: Stamp = { damage: 0, speed: 1, noSpread: false, crit: 0, bounces: 0, seeker: false, blast: 0 };
    let fan = 0;

    /* Top-level draws stop at the end of the row; nested draws wrap to its
       start, never taking a verse this press already holds. */
    const next = (nested: boolean): number | null => {
      while (cursor < row.length && inHand.has(cursor)) cursor++;
      if (cursor < row.length) return cursor++;
      if (!nested) return null;
      const free = row.findIndex((_, i) => !inHand.has(i));
      if (free < 0) return null;
      cursor = free + 1;
      return free;
    };

    const draw = (n: number, nested: boolean) => {
      let k = 0;
      while (k < n) {
        const i = next(nested);
        if (i === null) {
          rests = true;
          return;
        }
        inHand.add(i);
        const v = BY_ID.get(row[i])!;
        if (spent + v.mana > mana) {
          skipped.push(v.name);
          continue;
        }
        k++;
        spent += v.mana;
        bills.push(`${v.name} ${v.mana}`);
        if (v.type === 'multicast') {
          if (v.fan) fan = v.fan;
          draw(v.draws!, true);
        } else if (v.type === 'modifier') {
          const m = v.mod!;
          if (m.damage) stamp.damage += m.damage;
          if (m.speed) stamp.speed *= m.speed;
          if (m.noSpread) stamp.noSpread = true;
          if (m.crit) stamp.crit += m.crit;
          if (m.bounces) stamp.bounces += m.bounces;
          if (m.seeker) stamp.seeker = true;
          if (m.blast) stamp.blast += m.blast;
          draw(1, true);
        } else {
          planned.push({ v, s: { ...stamp }, fan });
        }
      }
    };

    draw(breath, false);
    if (cursor >= row.length) rests = true;
    mana -= spent;
    lastRead = inHand;

    /* Fire: a fan when a Trident asked for one, else a small spread. */
    const flying = planned.filter((p) => p.v.type === 'projectile');
    flying.forEach((p, n) => {
      const spread = p.s.noSpread ? 0 : 4;
      const offset = p.fan ? (n - (flying.length - 1) / 2) * p.fan : Math.sin(n * 2.4 + start) * spread;
      const a = (offset * Math.PI) / 180;
      const sp = 140 * p.v.speed! * p.s.speed;
      bodies.push({
        x: HAND.x,
        y: HAND.y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        s: p.s,
        dmg: p.v.damage! + p.s.damage,
        life: 3.2,
        color: TYPE_COLOR.projectile,
        fixed: false,
        radius: 0,
        bounces: p.s.bounces,
        done: false,
      });
    });
    planned
      .filter((p) => p.v.type === 'static')
      .forEach((p, n) => {
        bodies.push({
          x: HAND.x + 34 + n * 6,
          y: HAND.y + 20,
          vx: 0,
          vy: 0,
          s: p.s,
          dmg: p.v.damage!,
          life: p.v.id === 'rime_ring' ? 1.6 : 0.5,
          color: TYPE_COLOR.static,
          fixed: true,
          radius: p.v.radius! * 12,
          bounces: 0,
          done: false,
        });
      });

    const names = [...inHand].sort((a, b) => a - b).map((i) => BY_ID.get(row[i])!.name);
    const standing = planned.length - flying.length;
    say(
      `Read <b>${names.join(', ') || 'nothing'}</b> - ${flying.length} bod${flying.length === 1 ? 'y' : 'ies'} in flight${standing ? `, ${standing} standing a step ahead of you` : ''}. ` +
        `<b>${spent} mana</b>${bills.length ? ` (${bills.join(' + ')})` : ''}.` +
        (skipped.length ? ` <span class="tbad">Skipped for mana: ${skipped.join(', ')}.</span>` : '') +
        (rests ? ' The row is finished; the next press starts over.' : ` The next press starts at slot ${cursor + 1}.`),
    );
    if (rests) cursor = 0;
    landed = 0;
    renderRow();
  };

  /* ------------------------------------------------------------- the UI -- */

  const rowEl = h('div', { class: 'mana-row', role: 'list' });
  const renderRow = () => {
    rowEl.textContent = '';
    for (let i = 0; i < ROW; i++) {
      const id = row[i];
      const v = id ? BY_ID.get(id)! : null;
      rowEl.append(
        h(
          'button',
          {
            type: 'button',
            class: 'mana-slot',
            role: 'listitem',
            title: v ? `${v.name} - ${v.mana} mana. Click to strike it.` : 'Empty',
            'data-read': lastRead.has(i) ? 'true' : undefined,
            'data-cursor': i === cursor && row.length ? 'true' : undefined,
            style: v ? `--t:${TYPE_COLOR[v.type]}` : undefined,
            onclick: () => {
              if (!v) return;
              row.splice(i, 1);
              cursor = 0;
              lastRead = new Set();
              renderRow();
            },
          },
          v ? v.name : '',
        ),
      );
    }
  };

  const palette = h('div', { class: 'mana-palette' });
  (['projectile', 'static', 'multicast', 'modifier'] as Type[]).forEach((t) => {
    const group = h('div', { class: 'mana-group' }, h('span', { class: 'mana-gl', style: `color:${TYPE_COLOR[t]}` }, TYPE_WORD[t]));
    for (const v of VERSES.filter((q) => q.type === t)) {
      group.append(
        h(
          'button',
          {
            type: 'button',
            class: 'mana-chip',
            style: `--t:${TYPE_COLOR[t]}`,
            title: `${v.name}: ${v.mana} mana`,
            onclick: () => {
              if (row.length >= ROW) return say('A row holds twenty verses.');
              row.push(v.id);
              cursor = 0;
              lastRead = new Set();
              renderRow();
            },
          },
          `${v.name} `,
          h('small', {}, String(v.mana)),
        ),
      );
    }
    palette.append(group);
  });

  const breathSel = select(
    Array.from({ length: 8 }, (_, i) => ({ value: String(i + 1), label: `Breath ${i + 1}` })),
    (b) => {
      breath = Number(b);
      cursor = 0;
      lastRead = new Set();
      renderRow();
    },
  );

  const presetSel = select(
    [{ value: '', label: 'Load a worked row...' }, ...PRESETS.map(([n], i) => ({ value: String(i), label: n }))],
    (v) => {
      if (!v) return;
      const [, verses, b] = PRESETS[Number(v)];
      row = [...verses];
      breath = b;
      breathSel.value = String(b);
      cursor = 0;
      lastRead = new Set();
      renderRow();
      presetSel.value = '';
      say('Loaded. Press <b>Recite</b>.');
    },
  );

  const { el: cv, ctx } = canvas(W, H);

  el.append(
    h('style', {}, `
      .mana-row { display: grid; grid-template-columns: repeat(10, minmax(0, 1fr)); gap: 3px; margin-top: var(--s3); }
      .mana-slot { min-height: 30px; padding: 2px; font-family: var(--mono); font-size: 9px; line-height: 1.15; color: var(--bone);
        background: #0E171F; border: 1px solid var(--edge-dim); border-bottom: 2px solid var(--t, var(--edge-dim)); border-radius: 2px; cursor: pointer; overflow: hidden; }
      .mana-slot[data-read='true'] { background: color-mix(in srgb, var(--t) 22%, #0E171F); border-color: var(--t); }
      .mana-slot[data-cursor='true'] { box-shadow: inset 0 2px 0 var(--c); }
      .mana-palette { display: grid; gap: 6px; margin-top: 6px; }
      .mana-group { display: flex; flex-wrap: wrap; gap: 3px; align-items: center; }
      .mana-gl { font-family: var(--mono); font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; width: 100%; }
      .mana-chip { padding: 3px 6px; font-family: var(--mono); font-size: 10.5px; color: var(--bone); background: var(--panel);
        border: 1px solid color-mix(in srgb, var(--t) 45%, var(--edge)); border-radius: 2px; cursor: pointer; }
      .mana-chip:hover { border-color: var(--t); }
      .mana-chip small { color: var(--ash-dim); }
    `),
    cv,
    h(
      'div',
      { class: 'trow' },
      button('Recite', recite, 'tbtn tbtn--go'),
      breathSel,
      presetSel,
      button('Clear row', () => {
        row = [];
        cursor = 0;
        lastRead = new Set();
        renderRow();
      }),
    ),
    rowEl,
    h('span', { class: 'tlabel' }, 'Verses · click to write'),
    palette,
    read,
  );

  row = [...PRESETS[0][1]];
  renderRow();
  say('A Trident of three needles is written. Press <b>Recite</b>: one breath reads the Trident, and the Trident reads three needles for free.');

  /* ------------------------------------------------------------ drawing -- */

  loop(cv, (dt) => {
    mana = Math.min(POOL, mana + REGEN * dt);
    golemFlash = Math.max(0, golemFlash - dt * 4);

    for (const b of bodies) {
      b.life -= dt;
      if (b.done) continue;
      if (b.fixed) {
        const d = Math.hypot(GOLEM.x - b.x, GOLEM.y - b.y);
        if (d < b.radius + GOLEM.r) {
          landed += b.dmg * dt * 2;
          golemFlash = 1;
        }
        if (b.life <= 0) b.done = true;
        continue;
      }
      if (b.s.seeker) {
        const want = Math.atan2(GOLEM.y - b.y, GOLEM.x - b.x);
        const sp = Math.hypot(b.vx, b.vy);
        const cur = Math.atan2(b.vy, b.vx);
        const turned = cur + Math.max(-3 * dt, Math.min(3 * dt, want - cur));
        b.vx = Math.cos(turned) * sp;
        b.vy = Math.sin(turned) * sp;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if ((b.y < 8 || b.y > H - 8) && b.bounces > 0) {
        b.vy = -b.vy;
        b.bounces--;
      }
      if (Math.hypot(GOLEM.x - b.x, GOLEM.y - b.y) < GOLEM.r + 3) {
        landed += b.dmg + b.s.blast;
        golemFlash = 1;
        b.done = true;
        b.life = 0;
        if (b.s.blast) b.radius = b.s.blast * 12;
      }
      if (b.life <= 0 || b.x > W + 20 || b.y < -20 || b.y > H + 20) b.done = true;
    }
    bodies = bodies.filter((b) => !b.done || b.life > -0.3);

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(HAND.x - 12, HAND.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = golemFlash > 0 ? '#FFFFFF' : '#8C8A7E';
    ctx.fillRect(GOLEM.x - 12, GOLEM.y - 22, 24, 44);
    ctx.fillStyle = '#9AB0BC';
    ctx.font = '9px "IBM Plex Mono", monospace';
    ctx.fillText('golem', GOLEM.x - 14, GOLEM.y + 34);
    ctx.fillText(`landed ${landed.toFixed(1)}`, GOLEM.x - 44, GOLEM.y - 30);

    for (const b of bodies) {
      if (b.fixed) {
        const k = Math.max(0, b.life);
        ctx.strokeStyle = alpha(b.color, Math.min(1, k * 2));
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius * (1 - k * 0.2), 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 1;
        continue;
      }
      if (b.done) {
        if (b.radius) {
          ctx.strokeStyle = alpha('#E8A33D', Math.max(0, b.life + 0.3) * 3);
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
          ctx.stroke();
        }
        continue;
      }
      const a = Math.atan2(b.vy, b.vx);
      ctx.strokeStyle = b.s.seeker ? '#7FE0A8' : b.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(b.x - Math.cos(a) * 9, b.y - Math.sin(a) * 9);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.lineWidth = 1;
      if (b.s.crit) {
        ctx.fillStyle = '#FF8A8A';
        ctx.fillRect(b.x - 1, b.y - 1, 2, 2);
      }
    }

    ctx.fillStyle = '#0E171F';
    ctx.fillRect(10, H - 14, 100, 5);
    ctx.fillStyle = '#6FA8FF';
    ctx.fillRect(10, H - 14, mana, 5);
    ctx.fillStyle = '#9AB0BC';
    ctx.fillText(`mana ${Math.floor(mana)}/${POOL}`, 10, H - 20);
  });
}
