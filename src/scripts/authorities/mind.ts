/* The Authority of Mind, as one imagined wall and three minds looking at it.

   The numbers are the mod's. Belief grows by 0.02 x plausibility x senses x
   (1 - belief) a tick while a viewer sees the lie and falls 0.002 a tick
   while it does not; a touch takes 0.60 off, an arrow through it 0.35,
   watching someone else touch it 0.20, and a viewer below 0.1 has seen
   through it for good. A wall of four blocks weighs 2; it becomes real when
   the convinced minds' belief, weighted by their vote (a mob 1, a player 3),
   reaches its weight, and stays real down to half of it. Insist adds 0.01 a
   tick to every viewer at 0.3 or more and takes 0.01 from the rest. */

import { alpha, button, canvas, h, loop } from './dom';

const RATE = 0.02;
const DECAY = 0.002;
const CONVINCED = 0.5;
const SHATTER = 0.1;
const PATHING = 0.3;
const SURE = 0.8;
const WEIGHT = 4 * 0.5;
const HOLD = 0.5;
const PLAUSIBILITY = 0.72;
const TPS = 20;

interface Viewer {
  name: string;
  vote: number;
  belief: number;
  sees: boolean;
  shattered: boolean;
  x: number;
  y: number;
  color: string;
  bar?: HTMLElement;
  text?: HTMLElement;
  seeBtn?: HTMLButtonElement;
}

const SENSES: [string, string, number][] = [
  ['sound', 'Sound', 1.25],
  ['shadow', 'Shadow', 1.15],
  ['scent', 'Scent', 1.1],
];

export function mount(el: HTMLElement, color: string): void {
  let viewers: Viewer[] = [];
  let real = false;
  let insisting = false;
  let manaSpent = 0;
  let harden = 0;
  const senses = new Set<string>();

  const read = h('p', { class: 'tread', 'aria-live': 'polite' });
  const say = (html: string) => {
    read.innerHTML = html;
  };

  const make = () => {
    viewers = [
      { name: 'Zombie', vote: 1, belief: 0, sees: true, shattered: false, x: 50, y: 170, color: '#6E9A5A' },
      { name: 'Skeleton', vote: 1, belief: 0, sees: true, shattered: false, x: 100, y: 170, color: '#D6D2C4' },
      { name: 'Player', vote: 3, belief: 0, sees: false, shattered: false, x: 360, y: 170, color: '#8FD3EC' },
    ];
    real = false;
    manaSpent = 0;
  };

  const sense = () => [...senses].reduce((m, s) => m * SENSES.find(([k]) => k === s)![2], 1);
  const consensus = () =>
    viewers.filter((v) => !v.shattered && v.belief >= CONVINCED).reduce((sum, v) => sum + v.belief * v.vote, 0);

  const hit = (v: Viewer, amount: number, why: string, touch: boolean) => {
    if (v.shattered) return say(`The ${v.name.toLowerCase()} has already seen through it.`);
    if (real) return say(`The wall is <b>real</b> now. The ${v.name.toLowerCase()} meets stone; there is nothing to see through.`);
    /* First-hand evidence on a mind that holds no belief shatters it outright. */
    const before = v.belief;
    v.belief = Math.max(0, v.belief - amount);
    if (v.belief < SHATTER) {
      v.shattered = true;
      v.belief = 0;
    }
    let extra = '';
    if (touch) {
      for (const o of viewers) {
        if (o === v || o.shattered || !o.sees || o.belief <= 0) continue;
        o.belief = Math.max(0, o.belief - 0.2);
        if (o.belief < SHATTER) {
          o.shattered = true;
          o.belief = 0;
        }
        extra += ` The ${o.name.toLowerCase()} watched it happen (-0.20${o.shattered ? ', and sees through it' : ''}).`;
      }
    }
    say(`The ${v.name.toLowerCase()} ${why} (-${amount.toFixed(2)}): ${before.toFixed(2)} → ${v.belief.toFixed(2)}.${v.shattered ? ' <span class="tbad">Seen through - for good.</span>' : ''}${extra}`);
  };

  /* ------------------------------------------------------------- the UI -- */

  const rows = h('div', { class: 'mind-rows' });
  const buildRows = () => {
    rows.textContent = '';
    for (const v of viewers) {
      v.bar = h('i');
      v.text = h('span', { class: 'mind-b' });
      const see = button('Sees it', () => {
        v.sees = !v.sees;
        see.setAttribute('aria-pressed', String(v.sees));
      });
      see.setAttribute('aria-pressed', String(v.sees));
      v.seeBtn = see;
      rows.append(
        h(
          'div',
          { class: 'mind-row' },
          h('span', { class: 'mind-n', style: `color:${v.color}` }, `${v.name} · vote ${v.vote}`),
          v.text,
          h(
            'div',
            { class: 'tmeter' },
            v.bar,
            h('s', { style: `left:${SHATTER * 100}%` }),
            h('s', { style: `left:${PATHING * 100}%` }),
            h('s', { style: `left:${CONVINCED * 100}%` }),
            h('s', { style: `left:${SURE * 100}%` }),
          ),
          h(
            'div',
            { class: 'mind-acts' },
            see,
            button('Touch it', () => hit(v, 0.6, 'touches the wall', true)),
            button('Arrow through', () => hit(v, 0.35, 'looses an arrow through it', false)),
          ),
        ),
      );
    }
  };

  const insist = button('Hold to Insist', () => {});
  const start = () => {
    insisting = true;
    insist.setAttribute('aria-pressed', 'true');
  };
  const stop = () => {
    insisting = false;
    insist.setAttribute('aria-pressed', 'false');
  };
  insist.addEventListener('pointerdown', start);
  insist.addEventListener('pointerup', stop);
  insist.addEventListener('pointerleave', stop);
  insist.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') start();
  });
  insist.addEventListener('keyup', stop);

  const senseBtns = SENSES.map(([k, label, m]) => {
    const b = button(`${label} x${m}`, () => {
      if (senses.has(k)) senses.delete(k);
      else senses.add(k);
      b.setAttribute('aria-pressed', String(senses.has(k)));
    });
    b.setAttribute('aria-pressed', 'false');
    return b;
  });

  const agreeBar = h('i');
  const agreeText = h('span');

  const { el: cv, ctx } = canvas(420, 190);

  el.append(
    h('style', {}, `
      .mind-rows { display: grid; gap: 8px; margin-top: var(--s3); }
      .mind-row { display: grid; grid-template-columns: 1fr auto; gap: 3px 8px; align-items: center; }
      .mind-row .tmeter { grid-column: 1 / -1; }
      .mind-acts { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 4px; }
      .mind-acts .tbtn { padding: 4px 8px; font-size: 10.5px; }
      .mind-n, .mind-b { font-family: var(--mono); font-size: 11px; }
      .mind-b { color: var(--ash); text-align: right; }
      .mind-agree { display: grid; gap: 4px; margin-top: var(--s3); font-family: var(--mono); font-size: 11px; color: var(--ash); }
    `),
    cv,
    h(
      'div',
      { class: 'trow' },
      insist,
      ...senseBtns,
      button('Reset', () => {
        make();
        buildRows();
        say('Three fresh minds. The zombie and the skeleton are watching; the player has not looked yet.');
      }),
    ),
    h(
      'div',
      { class: 'mind-agree' },
      agreeText,
      h('div', { class: 'tmeter' }, agreeBar, h('s', { style: `left:${((WEIGHT * HOLD) / 4) * 100}%` }), h('s', { style: `left:${(WEIGHT / 4) * 100}%` })),
    ),
    rows,
    read,
  );

  make();
  buildRows();
  say('The zombie and the skeleton are watching the wall. Two mobs can never make it real on their own - let the <b>player</b> see it too.');

  /* ------------------------------------------------------------ the loop -- */

  let acc = 0;
  loop(cv, (dt) => {
    acc += dt * TPS;
    while (acc >= 1) {
      acc -= 1;
      for (const v of viewers) {
        if (v.shattered) continue;
        if (v.sees) v.belief += RATE * PLAUSIBILITY * sense() * (1 - v.belief);
        else v.belief = Math.max(0, v.belief - DECAY);
        if (insisting && v.sees && v.belief > 0) v.belief += v.belief >= PATHING ? 0.01 : -0.01;
        v.belief = Math.min(1, Math.max(0, v.belief));
      }
      if (insisting) manaSpent += 3;
      const c = consensus();
      if (!real && c >= WEIGHT) {
        real = true;
        harden = 1;
        say(`<span class="tgood">The wall is real.</span> Agreement ${c.toFixed(2)} reached its weight of ${WEIGHT}. It is stone now, for everyone - and it stays until agreement falls under ${(WEIGHT * HOLD).toFixed(1)}.`);
      } else if (real && c < WEIGHT * HOLD) {
        real = false;
        say(`Agreement fell to ${c.toFixed(2)}, under half the weight. <b>The wall goes back to being a lie.</b>`);
      }
    }
    harden = Math.max(0, harden - dt);

    const c = consensus();
    agreeBar.style.width = `${Math.min(100, (c / 4) * 100)}%`;
    agreeText.textContent = `Agreement ${c.toFixed(2)} · real at ${WEIGHT.toFixed(1)}, holds to ${(WEIGHT * HOLD).toFixed(1)}${insisting ? ` · insisting, ${manaSpent} mana` : ''}`;
    for (const v of viewers) {
      v.bar!.style.width = `${v.belief * 100}%`;
      v.bar!.style.background = v.shattered ? '#555' : v.belief >= CONVINCED ? '#E8C36A' : '';
      v.text!.textContent = v.shattered
        ? 'seen through'
        : `${v.belief.toFixed(2)}${v.belief >= SURE ? ' sure' : v.belief >= CONVINCED ? ' convinced' : v.belief >= PATHING ? ' paths around it' : ''}`;
    }

    /* The owner's view: the lie at 45% with lilac edges, solid once real. */
    ctx.clearRect(0, 0, 420, 190);
    ctx.strokeStyle = '#2B3D4B';
    ctx.beginPath();
    ctx.moveTo(0, 170.5);
    ctx.lineTo(420, 170.5);
    ctx.stroke();
    for (let i = 0; i < 4; i++) {
      const x = 150 + i * 30;
      const y = 110;
      ctx.fillStyle = real ? '#7A7F86' : alpha('#7A7F86', 0.45);
      ctx.fillRect(x, y, 30, 30);
      ctx.fillStyle = real ? '#6A6F76' : alpha('#6A6F76', 0.45);
      ctx.fillRect(x, y + 30, 30, 30);
      ctx.strokeStyle = real ? (harden > 0 ? alpha(color, harden) : '#555A60') : alpha(color, 0.9);
      ctx.lineWidth = real && harden <= 0 ? 1 : 1.5;
      ctx.strokeRect(x + 0.5, y + 0.5, 29, 29);
      ctx.strokeRect(x + 0.5, y + 30.5, 29, 29);
    }
    ctx.lineWidth = 1;
    ctx.font = '9px "IBM Plex Mono", monospace';
    ctx.fillStyle = real ? '#E7F1F5' : alpha(color, 0.9);
    ctx.fillText(real ? 'real stone' : 'imagined stone', 172, 102);

    for (const v of viewers) {
      if (v.sees && !v.shattered) {
        ctx.strokeStyle = alpha(v.color, 0.18);
        ctx.beginPath();
        ctx.moveTo(v.x, v.y - 18);
        ctx.lineTo(210, 140);
        ctx.stroke();
      }
      ctx.fillStyle = v.color;
      ctx.fillRect(v.x - 6, v.y - 24, 12, 24);
      if (!v.shattered && v.belief > 0.02) {
        ctx.strokeStyle = v.belief >= CONVINCED ? '#E8C36A' : alpha(color, 0.35 + 0.6 * v.belief);
        ctx.setLineDash(v.belief >= CONVINCED ? [] : [3, 3]);
        ctx.beginPath();
        ctx.ellipse(v.x, v.y - 34, 10, 4, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.fillStyle = '#9AB0BC';
      ctx.fillText(v.name.toLowerCase(), v.x - 16, v.y + 13);
    }
  });
}
