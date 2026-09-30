/* The Authority of Soul, as two souls on a strip of ground.

   The rules are the mod's: a soul that dies while bound comes back beside the
   other at 35% health and opens a collapse window; the same side may die
   again inside it and simply come back again, but if the *other* side dies
   while it is open the vow collapses and that death is real. Striking your
   own bound soul breaks the vow. The toy runs five times faster than the
   game, so the 70-second window lasts 14 real ones. */

import { alpha, button, canvas, h, loop, pointer } from './dom';

const W = 420;
const H = 170;
const GROUND = 130;
const BLOCKS = 40;
const PX = W / BLOCKS;
const REACH = 18;
const WINDOW = 70;
const SPEED = 5;
const MANA_MAX = 100;
const REGEN = 1.2;
const COSTS = { swap: 18, call: 12, step: 10 };

interface Soul {
  name: string;
  x: number;
  tx: number;
  hp: number;
  dead: boolean;
  flash: number;
}

export function mount(el: HTMLElement, color: string): void {
  let you: Soul;
  let wolf: Soul;
  let bound = false;
  let windowLeft = 0;
  let windowOwner: 'you' | 'wolf' | null = null;
  let mana = MANA_MAX;
  let wander = 0;
  let thread = 0;

  const read = h('p', { class: 'tread', 'aria-live': 'polite' });
  const say = (html: string) => {
    read.innerHTML = html;
  };

  const reset = () => {
    you = { name: 'You', x: 8, tx: 8, hp: 20, dead: false, flash: 0 };
    wolf = { name: 'The wolf', x: 22, tx: 22, hp: 20, dead: false, flash: 0 };
    bound = false;
    windowLeft = 0;
    windowOwner = null;
    mana = MANA_MAX;
    say('Click the ground to walk. Stand within 18 blocks of the wolf and choose <b>Soul Valley</b> to bind it.');
    sync();
  };

  const dist = () => Math.abs(you.x - wolf.x);

  const bind = () => {
    if (bound) return say('You are already bound. One vow, two souls.');
    if (you.dead || wolf.dead) return say('A dead soul cannot be bound. Reset to start over.');
    if (dist() > REACH) return say(`The wolf is <b>${dist().toFixed(0)} blocks</b> away. Soul Valley reaches ${REACH}. Walk closer.`);
    bound = true;
    thread = 1;
    say('<b>Bound.</b> Now kill either side.');
    sync();
  };

  const kill = (who: 'you' | 'wolf') => {
    const dying = who === 'you' ? you : wolf;
    const other = who === 'you' ? wolf : you;
    if (dying.dead) return;
    if (!bound) {
      dying.dead = true;
      dying.hp = 0;
      say(`${dying.name} ${who === 'you' ? 'die' : 'dies'}. Nothing was bound, so nothing comes back.`);
      return sync();
    }
    if (windowLeft > 0 && windowOwner && windowOwner !== who) {
      dying.dead = true;
      dying.hp = 0;
      bound = false;
      windowLeft = 0;
      windowOwner = null;
      say(`<span class="tbad">The vow collapses.</span> ${dying.name} died while the other side's window was still open, and that death is real.`);
      return sync();
    }
    /* Resurrected beside the other soul at 35% health; the window opens (or is
       topped up, if this same side died inside its own window). */
    dying.x = other.x + (who === 'you' ? -1.2 : 1.2);
    dying.tx = dying.x;
    dying.hp = 7;
    dying.flash = 1;
    windowOwner = who;
    windowLeft = WINDOW;
    say(`${dying.name} ${who === 'you' ? 'die' : 'dies'} - and ${who === 'you' ? 'come' : 'comes'} back beside ${other === you ? 'you' : 'the wolf'} at 35% health. <b>Collapse window: 70 s.</b> Kill the same side again and it just comes back; kill <b>the other</b> now and the vow is gone.`);
    sync();
  };

  const spend = (cost: number, what: string) => {
    if (!bound) {
      say(`${what} needs a bond. Bind a soul first.`);
      return false;
    }
    if (mana < cost) {
      say(`${what} costs <b>${cost} mana</b>; you have ${Math.floor(mana)}.`);
      return false;
    }
    mana -= cost;
    return true;
  };

  const swap = () => {
    if (!spend(COSTS.swap, 'Swap')) return;
    const a = you.x;
    you.x = you.tx = wolf.x;
    wolf.x = wolf.tx = a;
    thread = 1;
    say(`<b>Swap</b> (18 mana): you trade places along the bond.`);
    sync();
  };
  const call = () => {
    if (!spend(COSTS.call, 'Call')) return;
    wolf.x = wolf.tx = you.x + 1.2;
    thread = 1;
    say(`<b>Call</b> (12 mana): the wolf is brought to you.`);
    sync();
  };
  const step = () => {
    if (!spend(COSTS.step, 'Step')) return;
    you.x = you.tx = wolf.x - 1.2;
    thread = 1;
    say(`<b>Step</b> (10 mana): you go to the wolf.`);
    sync();
  };
  const sever = () => {
    if (!bound) return say('There is no bond to sever.');
    bound = false;
    windowLeft = 0;
    windowOwner = null;
    say('<b>Sever</b> (free): the bond is broken. Deaths are ordinary again.');
    sync();
  };
  const strike = () => {
    if (wolf.dead) return;
    wolf.hp = Math.max(1, wolf.hp - 4);
    wolf.flash = 1;
    if (bound) {
      bound = false;
      windowLeft = 0;
      windowOwner = null;
      say('<span class="tbad">You struck your own bound soul.</span> The vow breaks the moment you do.');
    } else {
      say('You strike the wolf. It has no quarrel with you, but there is no bond to break.');
    }
    sync();
  };

  const bBind = button('Soul Valley', bind, 'tbtn tbtn--go');
  const bSwap = button('Swap · 18', swap);
  const bCall = button('Call · 12', call);
  const bStep = button('Step · 10', step);
  const bSever = button('Sever', sever);
  const sync = () => {
    bBind.disabled = bound;
    for (const b of [bSwap, bCall, bStep, bSever]) b.disabled = !bound;
  };

  const { el: cv, ctx } = canvas(W, H);
  cv.addEventListener('click', (e) => {
    if (you.dead) return;
    const p = pointer(cv, e as MouseEvent, W, H);
    you.tx = Math.max(1, Math.min(BLOCKS - 1, p.x / PX));
  });

  el.append(
    cv,
    h('div', { class: 'trow' }, bBind, bSwap, bCall, bStep, bSever),
    h(
      'div',
      { class: 'trow' },
      button('Kill you', () => kill('you')),
      button('Kill the wolf', () => kill('wolf')),
      button('Strike the wolf', strike),
      button('Reset', reset),
    ),
    read,
  );

  reset();

  const figure = (s: Soul, isYou: boolean) => {
    const x = s.x * PX;
    const c = isYou ? color : '#C8B89A';
    ctx.globalAlpha = s.dead ? 0.3 : 1;
    ctx.fillStyle = s.flash > 0 ? '#FFFFFF' : c;
    if (isYou) {
      ctx.fillRect(x - 4, GROUND - 26, 8, 14);
      ctx.beginPath();
      ctx.arc(x, GROUND - 31, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(x - 4, GROUND - 12, 3, 12);
      ctx.fillRect(x + 1, GROUND - 12, 3, 12);
    } else {
      ctx.fillRect(x - 9, GROUND - 12, 18, 7);
      ctx.fillRect(x + 7, GROUND - 16, 6, 6);
      ctx.fillRect(x - 8, GROUND - 5, 3, 5);
      ctx.fillRect(x + 5, GROUND - 5, 3, 5);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#0A0F14';
    ctx.fillRect(x - 12, GROUND + 8, 24, 3);
    ctx.fillStyle = s.hp > 8 ? '#7FE0A8' : '#FF8A8A';
    ctx.fillRect(x - 12, GROUND + 8, 24 * (s.hp / 20), 3);
    ctx.font = '9px "IBM Plex Mono", monospace';
    ctx.fillStyle = s.dead ? '#FF8A8A' : '#9AB0BC';
    const label = s.dead ? 'dead' : isYou ? 'you' : 'wolf';
    ctx.fillText(label, x - label.length * 2.7, GROUND + 22);
  };

  const draw = (t: number) => {
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = '#2B3D4B';
    ctx.beginPath();
    ctx.moveTo(0, GROUND + 0.5);
    ctx.lineTo(W, GROUND + 0.5);
    ctx.stroke();

    /* The reach of Soul Valley, while unbound. */
    if (!bound && !you.dead) {
      ctx.fillStyle = alpha(color, 0.06);
      ctx.fillRect((you.x - REACH) * PX, GROUND - 50, REACH * 2 * PX, 50);
      ctx.fillStyle = alpha(color, 0.5);
      ctx.font = '9px "IBM Plex Mono", monospace';
      ctx.fillText('reach 18', Math.max(4, (you.x - REACH) * PX + 4), GROUND - 40);
    }

    /* The bond: a thread between the two chests, brighter just after use. */
    if (bound) {
      const x1 = you.x * PX;
      const x2 = wolf.x * PX;
      const y = GROUND - 20;
      const sag = 10 + Math.sin(t * 2) * 2;
      ctx.strokeStyle = alpha(color, 0.45 + thread * 0.5);
      ctx.lineWidth = 1.5 + thread * 2;
      ctx.beginPath();
      ctx.moveTo(x1, y);
      ctx.quadraticCurveTo((x1 + x2) / 2, y - sag - 16, x2, y + 6);
      ctx.stroke();
      ctx.lineWidth = 1;
    }

    figure(wolf, false);
    figure(you, true);

    /* The collapse window, as a draining bar with its owner named. */
    ctx.font = '10px "IBM Plex Mono", monospace';
    if (windowLeft > 0) {
      ctx.fillStyle = '#0E171F';
      ctx.fillRect(10, 12, W - 20, 6);
      ctx.fillStyle = '#FF8A8A';
      ctx.fillRect(10, 12, (W - 20) * (windowLeft / WINDOW), 6);
      ctx.fillStyle = '#FFB3B3';
      ctx.fillText(`collapse window ${windowLeft.toFixed(0)}s - opened by ${windowOwner === 'you' ? 'your' : "the wolf's"} death`, 10, 32);
    } else {
      ctx.fillStyle = bound ? color : '#8199A6';
      ctx.fillText(bound ? 'bound - no window open' : 'unbound', 10, 20);
    }

    ctx.fillStyle = '#0E171F';
    ctx.fillRect(W - 110, H - 16, 100, 5);
    ctx.fillStyle = '#6FA8FF';
    ctx.fillRect(W - 110, H - 16, mana, 5);
    ctx.fillStyle = '#9AB0BC';
    ctx.fillText(`mana ${Math.floor(mana)}`, W - 110, H - 22);
  };

  let t = 0;
  loop(cv, (dt) => {
    t += dt;
    const gdt = dt * SPEED;
    mana = Math.min(MANA_MAX, mana + REGEN * gdt);
    if (windowLeft > 0) {
      windowLeft = Math.max(0, windowLeft - gdt);
      if (windowLeft === 0) {
        windowOwner = null;
        if (bound) say('The window closes. The vow holds - either side may die once more and come back.');
      }
    }
    thread = Math.max(0, thread - dt * 1.5);
    for (const s of [you, wolf]) {
      s.flash = Math.max(0, s.flash - dt * 3);
      if (!s.dead) {
        s.hp = Math.min(20, s.hp + 0.1 * gdt);
        const d = s.tx - s.x;
        s.x += Math.sign(d) * Math.min(Math.abs(d), 8 * dt);
      }
    }
    wander -= dt;
    if (wander <= 0 && !wolf.dead) {
      wander = 2 + ((t * 7919) % 3);
      wolf.tx = Math.max(2, Math.min(BLOCKS - 2, wolf.x + (((t * 104729) % 1) - 0.5) * 8));
    }
    draw(t);
  });
  draw(0);
}
