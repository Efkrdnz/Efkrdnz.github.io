/* The Authority of Causality, as a board of two rules and a fight to test it.

   The prices are the mod's: Store, Spend and Mend only move a number between
   the world and the ledger and cost no paradox; Return 0.08 a point, Echo
   0.5, Erase 0.9, charged on the amount after Greater (x1.5, +0.15) or
   Lesser (x0.6), and never on less than 8 points. Paradox strains at 40
   (every action costs double mana), frays at 70 (everything halved), and at
   100 collapses: the board shuts, drops back to 50, and the ledger is paid
   out of your own hide. A Brim fires one tick after the Store that fed it,
   exactly as the mod defers it. The only liberty is time: paradox cools a
   point a second once nothing has fired for a moment. */

import { alpha, button, canvas, h, loop, select } from './dom';

type Cause = 'hurt' | 'strike' | 'brim' | 'decree';
type Cond = 'none' | 'melee' | 'projectile' | 'fire' | 'crouched' | 'ledger';
type Effect = 'store' | 'spend' | 'mend' | 'return' | 'echo' | 'erase';
type Mod = 'none' | 'greater' | 'lesser' | 'twice';

const CAUSES: [Cause, string, string][] = [
  ['hurt', 'Hurt', 'When you are hurt'],
  ['strike', 'Strike', 'When you strike something'],
  ['brim', 'Brim (ledger reaches 20)', 'When the ledger reaches 20'],
  ['decree', 'Decree', 'When you speak a Decree'],
];
const CONDS: [Cond, string, string][] = [
  ['none', 'Always', ''],
  ['melee', 'Is melee', 'if it was melee'],
  ['projectile', 'Is projectile', 'if it was a projectile'],
  ['fire', 'Is fire', 'if it was fire'],
  ['crouched', 'While crouched', 'while you are crouched'],
  ['ledger', 'Ledger over 20', 'while the ledger holds over 20'],
];
const EFFECTS: [Effect, string, string, number][] = [
  ['store', 'Store', 'bank it in the ledger', 0],
  ['spend', 'Spend', 'pay the ledger out into the nearest body', 0],
  ['mend', 'Mend', 'pay the ledger out as healing', 0],
  ['return', 'Return', 'send it back to its source', 0.08],
  ['echo', 'Echo', 'make it happen again to the other side', 0.5],
  ['erase', 'Erase', 'unmake it', 0.9],
];
const MODS: [Mod, string, number, number][] = [
  ['none', 'Plain', 1, 0],
  ['greater', 'Greater (x1.5)', 1.5, 0.15],
  ['lesser', 'Lesser (x0.6)', 0.6, 0],
  ['twice', 'Twice', 1, 0.25],
];

const BRIM_AT = 20;
const SPEND_BRIM = 25;
const FLOOR = 8;
const MANA_PER_ACTION = 2;
const COLLAPSE_S = 20;

interface Rule {
  cause: Cause;
  cond: Cond;
  effect: Effect;
  mod: Mod;
}

interface Event {
  cause: Cause;
  amount: number;
  kind?: 'melee' | 'projectile' | 'fire';
}

interface Float {
  x: number;
  y: number;
  text: string;
  color: string;
  t: number;
}

export function mount(el: HTMLElement, color: string): void {
  const rules: Rule[] = [
    { cause: 'hurt', cond: 'none', effect: 'store', mod: 'none' },
    { cause: 'brim', cond: 'none', effect: 'spend', mod: 'none' },
  ];
  let ledger = 0;
  let paradox = 0;
  let calm = 0;
  let hp = 20;
  let foe = 60;
  let crouched = false;
  let shutFor = 0;
  let manaSpent = 0;
  let floats: Float[] = [];

  const read = h('p', { class: 'tread', 'aria-live': 'polite' });
  const say = (html: string) => {
    read.innerHTML = html;
  };

  const rung = () => (paradox >= 70 ? 'fraying' : paradox >= 40 ? 'strained' : 'settled');
  const float = (who: 'you' | 'foe', text: string, c: string) =>
    floats.push({ x: who === 'you' ? 90 : 330, y: 50, text, color: c, t: 0 });

  const passes = (r: Rule, e: Event) => {
    switch (r.cond) {
      case 'none':
        return true;
      case 'melee':
      case 'projectile':
      case 'fire':
        return e.kind === r.cond;
      case 'crouched':
        return crouched;
      case 'ledger':
        return ledger > BRIM_AT;
    }
  };

  const fire = (e: Event): string[] => {
    const lines: string[] = [];
    if (shutFor > 0) {
      if (e.cause === 'hurt') {
        hp -= e.amount;
        float('you', `-${e.amount}`, '#FF8A8A');
      }
      return [`The board is shut for ${shutFor.toFixed(0)} s more. Nothing answers.`];
    }
    let taken = e.cause === 'hurt' ? e.amount : 0;
    const before = ledger;
    rules.forEach((r, i) => {
      if (r.cause !== e.cause || !passes(r, e)) return;
      const [, , scale, modRate] = MODS.find(([m]) => m === r.mod)!;
      const [, name, , rate] = EFFECTS.find(([x]) => x === r.effect)!;
      const times = r.mod === 'twice' ? 2 : 1;
      const fray = rung() === 'fraying' ? 0.5 : 1;
      for (let n = 0; n < times; n++) {
        const base = e.cause === 'brim' && r.effect === 'spend' ? SPEND_BRIM : e.amount;
        const s = base * scale * fray;
        let moved = s;
        switch (r.effect) {
          case 'store':
            ledger += s;
            if (taken) taken = Math.max(0, taken - s);
            float('you', `+${s.toFixed(1)} ledger`, color);
            break;
          case 'spend':
            moved = Math.min(ledger, s);
            ledger -= moved;
            foe -= moved;
            float('foe', `-${moved.toFixed(1)}`, color);
            break;
          case 'mend':
            moved = Math.min(ledger, s);
            ledger -= moved;
            hp = Math.min(20, hp + moved);
            float('you', `+${moved.toFixed(1)} hp`, '#7FE0A8');
            break;
          case 'return':
            if (taken) taken = Math.max(0, taken - s);
            foe -= s;
            float('foe', `-${s.toFixed(1)}`, color);
            break;
          case 'echo':
            foe -= s;
            float('foe', `-${s.toFixed(1)} echo`, color);
            break;
          case 'erase':
            if (taken) taken = Math.max(0, taken - s);
            float('you', 'erased', '#E7F1F5');
            break;
        }
        const bill = rate + modRate > 0 ? (rate + modRate) * Math.max(moved, FLOOR) : 0;
        paradox += bill;
        const mana = MANA_PER_ACTION * (rung() === 'settled' ? 1 : 2);
        manaSpent += mana;
        lines.push(
          `Rule ${i + 1}: <b>${name}</b> ${moved.toFixed(1)}${bill ? ` - <span class="tbad">+${bill.toFixed(1)} paradox</span>` : ' - no paradox'}, ${mana} mana.`,
        );
      }
      calm = 0;
    });
    if (taken > 0) {
      hp -= taken;
      float('you', `-${taken.toFixed(1)}`, '#FF8A8A');
    }
    if (paradox >= 100) {
      const due = ledger;
      hp -= due;
      ledger = 0;
      paradox = 50;
      shutFor = COLLAPSE_S;
      lines.push(`<span class="tbad">Collapse.</span> The board shuts for 20 s and the ledger comes due: ${due.toFixed(1)} out of your own hide.`);
    }
    /* A Brim is fired one tick behind the Store that fed it. */
    if (before < BRIM_AT && ledger >= BRIM_AT && e.cause !== 'brim') {
      window.setTimeout(() => {
        const more = fire({ cause: 'brim', amount: BRIM_AT });
        if (more.length) say(`${read.innerHTML}<br>The ledger brims: ${more.join(' ')}`);
        renderMeters();
      }, 50);
    }
    return lines;
  };

  const happen = (e: Event, what: string) => {
    if (hp <= 0) return say('You are down. Press <b>Reset</b>.');
    const lines = fire(e);
    foe = Math.max(0, foe);
    say(`${what}. ${lines.length ? lines.join(' ') : 'No rule answered it.'}${hp <= 0 ? ' <span class="tbad">You fall.</span>' : ''}${foe <= 0 ? ' <span class="tgood">The husk falls.</span>' : ''}`);
    renderMeters();
  };

  /* ---------------------------------------------------------- the board -- */

  const board = h('div', { class: 'caus-board' });
  const sentence = (r: Rule) => {
    const c = CAUSES.find(([x]) => x === r.cause)![2];
    const q = CONDS.find(([x]) => x === r.cond)![2];
    const [, , what] = EFFECTS.find(([x]) => x === r.effect)!;
    const m = r.mod === 'none' ? '' : ` (${MODS.find(([x]) => x === r.mod)![1]})`;
    return `${c}${q ? `, ${q}` : ''} → ${what}${m}.`;
  };
  const renderBoard = () => {
    board.textContent = '';
    rules.forEach((r, i) => {
      const line = h('p', { class: 'caus-sent' }, sentence(r));
      const pick = <T extends string>(opts: [T, string, ...unknown[]][], value: T, set: (v: T) => void) => {
        const s = select(opts.map(([v, l]) => ({ value: v, label: l })), (v) => {
          set(v as T);
          line.textContent = sentence(r);
        });
        s.value = value;
        return s;
      };
      board.append(
        h(
          'div',
          { class: 'caus-rule' },
          h('span', { class: 'tlabel' }, `Rule ${i + 1}: cause · question · consequence · tool`),
          h(
            'div',
            { class: 'caus-grid' },
            pick(CAUSES, r.cause, (v) => (r.cause = v)),
            pick(CONDS, r.cond, (v) => (r.cond = v)),
            pick(EFFECTS, r.effect, (v) => (r.effect = v)),
            pick(MODS, r.mod, (v) => (r.mod = v)),
          ),
          line,
        ),
      );
    });
  };

  /* --------------------------------------------------------- the gauges -- */

  const ledgerBar = h('i');
  const paradoxBar = h('i');
  const ledgerText = h('span');
  const paradoxText = h('span');
  const crouchBtn = button('Crouch', () => {
    crouched = !crouched;
    crouchBtn.setAttribute('aria-pressed', String(crouched));
  });
  crouchBtn.setAttribute('aria-pressed', 'false');

  const renderMeters = () => {
    ledgerBar.style.width = `${Math.min(100, (ledger / 50) * 100)}%`;
    paradoxBar.style.width = `${Math.min(100, paradox)}%`;
    paradoxBar.style.background = paradox >= 70 ? '#FF8A8A' : paradox >= 40 ? '#FFC36A' : '';
    ledgerText.textContent = `Ledger ${ledger.toFixed(1)}  (Brim at ${BRIM_AT})`;
    paradoxText.textContent = `Paradox ${paradox.toFixed(1)} - ${shutFor > 0 ? `collapsed, ${shutFor.toFixed(0)} s` : rung()} · mana spent ${manaSpent}`;
  };

  const meter = (bar: HTMLElement, marks: number[], max: number) =>
    h('div', { class: 'tmeter' }, bar, ...marks.map((m) => h('s', { style: `left:${(m / max) * 100}%` })));

  const { el: cv, ctx } = canvas(420, 100);

  el.append(
    h('style', {}, `
      .caus-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 4px; }
      @media (max-width: 480px) { .caus-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
      .caus-sent { margin: 5px 0 0; font-family: var(--mono); font-size: 11.5px; color: var(--c); }
      .caus-m { display: grid; gap: 4px; margin-top: var(--s3); font-family: var(--mono); font-size: 11px; color: var(--ash); }
    `),
    board,
    h(
      'div',
      { class: 'trow' },
      button('Load: the counter', () => {
        rules[0] = { cause: 'hurt', cond: 'none', effect: 'store', mod: 'none' };
        rules[1] = { cause: 'brim', cond: 'none', effect: 'spend', mod: 'none' };
        renderBoard();
        say('The worked board: bank every hit, and when the ledger reaches 20 spend 25 of it into the nearest body.');
      }),
      button('Load: thorns', () => {
        rules[0] = { cause: 'hurt', cond: 'melee', effect: 'return', mod: 'none' };
        rules[1] = { cause: 'strike', cond: 'none', effect: 'echo', mod: 'lesser' };
        renderBoard();
        say('Thorns: a melee hit goes back where it came from, and every strike echoes at 60%. Watch the paradox.');
      }),
    ),
    cv,
    h(
      'div',
      { class: 'trow' },
      button('Take a sword hit · 6', () => happen({ cause: 'hurt', amount: 6, kind: 'melee' }, 'A husk hits you for 6')),
      button('Take an arrow · 5', () => happen({ cause: 'hurt', amount: 5, kind: 'projectile' }, 'An arrow hits you for 5')),
      button('Take fire · 4', () => happen({ cause: 'hurt', amount: 4, kind: 'fire' }, 'Fire burns you for 4')),
    ),
    h(
      'div',
      { class: 'trow' },
      button('Strike · 4', () => {
        foe -= 4;
        float('foe', '-4', '#E7F1F5');
        happen({ cause: 'strike', amount: 4 }, 'You strike the husk for 4');
      }),
      button('Decree · 10', () => happen({ cause: 'decree', amount: 10 }, 'You speak a Decree')),
      crouchBtn,
      button('Reset', () => {
        ledger = 0;
        paradox = 0;
        hp = 20;
        foe = 60;
        shutFor = 0;
        manaSpent = 0;
        floats = [];
        renderMeters();
        say('Fresh. Take a hit.');
      }),
    ),
    h('div', { class: 'caus-m' }, ledgerText, meter(ledgerBar, [BRIM_AT], 50), paradoxText, meter(paradoxBar, [40, 70], 100)),
    read,
  );

  renderBoard();
  renderMeters();
  say('The counter is loaded. Take a few hits and watch the ledger reach 20.');

  loop(cv, (dt) => {
    calm += dt;
    if (shutFor > 0) shutFor = Math.max(0, shutFor - dt);
    if (calm > 1.5 && paradox > 0) paradox = Math.max(0, paradox - dt);
    renderMeters();
    floats = floats.filter((f) => (f.t += dt) < 1.4);

    ctx.clearRect(0, 0, 420, 100);
    const body = (x: number, label: string, v: number, max: number, c: string) => {
      ctx.fillStyle = c;
      ctx.fillRect(x - 8, 40, 16, 34);
      ctx.fillStyle = '#0A0F14';
      ctx.fillRect(x - 20, 82, 40, 4);
      ctx.fillStyle = v / max > 0.4 ? '#7FE0A8' : '#FF8A8A';
      ctx.fillRect(x - 20, 82, 40 * Math.max(0, v / max), 4);
      ctx.fillStyle = '#9AB0BC';
      ctx.font = '9px "IBM Plex Mono", monospace';
      ctx.fillText(`${label} ${Math.max(0, v).toFixed(1)}`, x - 22, 97);
    };
    body(90, 'you', hp, 20, crouched ? alpha(color, 0.6) : color);
    body(330, 'husk', foe, 60, '#6E7F5A');
    if (shutFor > 0) {
      ctx.fillStyle = '#FF8A8A';
      ctx.font = '10px "IBM Plex Mono", monospace';
      ctx.fillText('BOARD SHUT', 170, 20);
    }
    ctx.font = '10px "IBM Plex Mono", monospace';
    for (const f of floats) {
      ctx.fillStyle = alpha(f.color, 1 - f.t / 1.4);
      ctx.fillText(f.text, f.x - 20, f.y - f.t * 30);
    }
  });
}
