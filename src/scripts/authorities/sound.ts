/* The Authority of Sound, as one bar of the Score and a crowd to play to.

   A bar is sixteen sixteenths; the kit rows hold at most 8 notes a bar and
   the melody rows 6, as the mod caps them. Play loops it through WebAudio at
   the mod's tempos (2, 3 or 4 ticks a step). Crouch or swing on a note: the
   nearest *sounding* step within two ticks is the one judged, never a rest
   beside it, and each step can be hit once per action. A streak of 4 steps
   the effect up; a streak of 8 makes every husk in earshot dance and starts
   the count again. A miss breaks it. */

import { alpha, button, canvas, h, loop, select } from './dom';

const STEPS = 16;
const TICK = 0.05;
const WINDOW_TICKS = 2;
const STRONG = 4;
const DANCE = 8;

interface Row {
  id: string;
  name: string;
  kit: boolean;
  cap: number;
  semis?: number;
  color: string;
}

/* Minor pentatonic over A: the melody reads top down, high to low. */
const ROWS: Row[] = [
  { id: 'm5', name: 'E5', kit: false, cap: 6, semis: 19, color: '#6FE0C0' },
  { id: 'm4', name: 'D5', kit: false, cap: 6, semis: 17, color: '#6FE0C0' },
  { id: 'm3', name: 'C5', kit: false, cap: 6, semis: 15, color: '#6FE0C0' },
  { id: 'm2', name: 'A4', kit: false, cap: 6, semis: 12, color: '#6FE0C0' },
  { id: 'm1', name: 'G4', kit: false, cap: 6, semis: 10, color: '#6FE0C0' },
  { id: 'hat', name: 'Hat', kit: true, cap: 8, color: '#E8C36A' },
  { id: 'snare', name: 'Snare', kit: true, cap: 8, color: '#E8C36A' },
  { id: 'kick', name: 'Kick', kit: true, cap: 8, color: '#E8C36A' },
];

const TEMPOS: [string, number][] = [
  ['Brisk · 2 ticks a step', 2],
  ['Steady · 3 ticks a step', 3],
  ['Slow · 4 ticks a step', 4],
];

const PULSE: Record<string, string> = {
  m5: '..........x.....',
  m4: '......x.........',
  m3: '....x.......x...',
  m2: 'x.........x...x.',
  m1: '..x.............',
  hat: 'x.x.x.x.x.x.x.x.',
  snare: '....x.......x...',
  kick: 'x.......x.x.....',
};

const EFFECTS = {
  crouch: { kit: 'Bulwark', melody: 'Mend' },
  swing: { kit: 'Stagger', melody: 'Dissonance' },
};

export function mount(el: HTMLElement, color: string): void {
  const grid: boolean[][] = ROWS.map((r) => [...(PULSE[r.id] ?? '')].map((c) => c === 'x'));
  let ticksPerStep = 3;
  let audio: AudioContext | null = null;
  let playing = false;
  let startAt = 0;
  let nextStep = 0;
  let nextTime = 0;
  let streak = 0;
  let best = 0;
  let dance = 0;
  const hitSteps = { crouch: new Map<number, number>(), swing: new Map<number, number>() };
  let lastLoop = -1;

  const read = h('p', { class: 'tread', 'aria-live': 'polite' });
  const say = (html: string) => {
    read.innerHTML = html;
  };

  const stepDur = () => ticksPerStep * TICK;
  const sounding = (s: number) => grid.some((row) => row[s]);

  /* ------------------------------------------------------------- audio --- */

  let noise: AudioBuffer | null = null;
  const noiseBuffer = (ac: AudioContext) => {
    if (noise) return noise;
    noise = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.3), ac.sampleRate);
    const d = noise.getChannelData(0);
    let seed = 1;
    for (let i = 0; i < d.length; i++) {
      seed = (seed * 16807) % 2147483647;
      d[i] = (seed / 2147483647) * 2 - 1;
    }
    return noise;
  };

  const voice = (row: Row, t: number) => {
    const ac = audio!;
    const out = ac.createGain();
    out.connect(ac.destination);
    if (row.id === 'kick') {
      const o = ac.createOscillator();
      o.frequency.setValueAtTime(140, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
      out.gain.setValueAtTime(0.9, t);
      out.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      o.connect(out);
      o.start(t);
      o.stop(t + 0.25);
      return;
    }
    if (row.kit) {
      const src = ac.createBufferSource();
      src.buffer = noiseBuffer(ac);
      const f = ac.createBiquadFilter();
      f.type = row.id === 'hat' ? 'highpass' : 'bandpass';
      f.frequency.value = row.id === 'hat' ? 7000 : 1800;
      const len = row.id === 'hat' ? 0.05 : 0.14;
      out.gain.setValueAtTime(row.id === 'hat' ? 0.25 : 0.5, t);
      out.gain.exponentialRampToValueAtTime(0.001, t + len);
      src.connect(f);
      f.connect(out);
      src.start(t);
      src.stop(t + len + 0.02);
      return;
    }
    const o = ac.createOscillator();
    o.type = 'triangle';
    o.frequency.value = 220 * Math.pow(2, row.semis! / 12);
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.28, t + 0.01);
    out.gain.exponentialRampToValueAtTime(0.001, t + stepDur() * 1.8);
    o.connect(out);
    o.start(t);
    o.stop(t + stepDur() * 2);
  };

  const schedule = () => {
    if (!audio || !playing) return;
    while (nextTime < audio.currentTime + 0.12) {
      const s = nextStep % STEPS;
      ROWS.forEach((r, i) => {
        if (grid[i][s]) voice(r, nextTime);
      });
      nextStep++;
      nextTime += stepDur();
    }
  };

  const play = () => {
    if (!audio) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audio = new Ctx();
    }
    void audio.resume();
    playing = !playing;
    playBtn.textContent = playing ? 'Stop' : 'Play';
    if (playing) {
      startAt = audio.currentTime + 0.08;
      nextStep = 0;
      nextTime = startAt;
      streak = 0;
      hitSteps.crouch.clear();
      hitSteps.swing.clear();
      say('Playing. Press <b>Space</b> to crouch or <b>J</b> to swing - on the notes.');
    }
  };

  /* ------------------------------------------------------------- judging -- */

  const judge = (action: 'crouch' | 'swing') => {
    if (!playing || !audio) return say('Press <b>Play</b> first.');
    const pos = (audio.currentTime - startAt) / stepDur();
    const win = (WINDOW_TICKS * TICK) / stepDur();
    let found = -1;
    let bestD = Infinity;
    for (let k = Math.floor(pos - win) - 1; k <= Math.ceil(pos + win) + 1; k++) {
      if (k < 0) continue;
      const d = Math.abs(k - pos);
      if (d <= win && sounding(k % STEPS) && d < bestD) {
        bestD = d;
        found = k;
      }
    }
    if (found < 0 || hitSteps[action].get(found % STEPS) === Math.floor(found / STEPS)) {
      say(streak ? `<span class="tbad">Missed.</span> The streak of ${streak} breaks.` : '<span class="tbad">Missed</span> - no note sounding within two ticks.');
      streak = 0;
      return;
    }
    hitSteps[action].set(found % STEPS, Math.floor(found / STEPS));
    streak++;
    best = Math.max(best, streak);
    const s = found % STEPS;
    const kit = ROWS.some((r, i) => r.kit && grid[i][s]);
    const mel = ROWS.some((r, i) => !r.kit && grid[i][s]);
    const gifts = [kit ? EFFECTS[action].kit : '', mel ? EFFECTS[action].melody : ''].filter(Boolean).join(' + ');
    if (streak >= DANCE) {
      dance = 2.5;
      streak = 0;
      say('<span class="tgood">Eight in a row.</span> Every husk in earshot dances. The count starts again.');
      return;
    }
    const strong = streak >= STRONG ? ' <b>(stronger)</b>' : '';
    say(`${action === 'crouch' ? 'Crouch' : 'Swing'} on step ${s + 1}: <b>${gifts}</b>${action === 'crouch' ? ' for you' : ' at every hostile in earshot'}${strong}. Streak <b>${streak}</b>.`);
  };

  const onKey = (e: KeyboardEvent) => {
    if (!playing || e.repeat) return;
    const t = e.target as HTMLElement | null;
    if (t && /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) return;
    if (e.code === 'Space') {
      e.preventDefault();
      judge('crouch');
    } else if (e.code === 'KeyJ') {
      e.preventDefault();
      judge('swing');
    }
  };
  document.addEventListener('keydown', onKey);

  /* --------------------------------------------------------------- grid --- */

  const cells: HTMLButtonElement[][] = [];
  const gridEl = h('div', { class: 'snd-grid' });
  const paint = () => {
    ROWS.forEach((_, i) => cells[i].forEach((c, s) => c.setAttribute('aria-pressed', String(grid[i][s]))));
  };
  ROWS.forEach((r, i) => {
    gridEl.append(h('span', { class: 'snd-name', style: `color:${r.color}` }, r.name));
    cells[i] = [];
    for (let s = 0; s < STEPS; s++) {
      const c = h('button', {
        type: 'button',
        class: 'snd-cell',
        'aria-label': `${r.name}, step ${s + 1}`,
        style: `--k:${r.color}`,
        'data-beat': s % 4 === 0 ? 'true' : undefined,
        onclick: () => {
          if (!grid[i][s] && grid[i].filter(Boolean).length >= r.cap) {
            say(`The bar is full: a ${r.kit ? 'kit' : 'melody'} row holds at most <b>${r.cap}</b> notes.`);
            return;
          }
          grid[i][s] = !grid[i][s];
          paint();
        },
      });
      cells[i].push(c);
      gridEl.append(c);
    }
  });

  const playBtn = button('Play', play, 'tbtn tbtn--go');
  const tempo = select(TEMPOS.map(([l, t]) => ({ value: String(t), label: l })), (v) => {
    const pos = playing && audio ? (audio.currentTime - startAt) / stepDur() : 0;
    ticksPerStep = Number(v);
    if (playing && audio) {
      startAt = audio.currentTime - pos * stepDur();
      nextTime = startAt + nextStep * stepDur();
    }
  });
  tempo.value = '3';

  const { el: cv, ctx } = canvas(420, 90);

  el.append(
    h('style', {}, `
      .snd-grid { display: grid; grid-template-columns: 40px repeat(16, minmax(0, 1fr)); gap: 2px; margin-top: var(--s3); align-items: center; }
      .snd-name { font-family: var(--mono); font-size: 10px; }
      .snd-cell { aspect-ratio: 1; min-width: 0; padding: 0; background: #0E171F; border: 1px solid var(--edge-dim); border-radius: 2px; cursor: pointer; }
      .snd-cell[data-beat='true'] { background: #13202A; }
      .snd-cell[aria-pressed='true'] { background: var(--k); border-color: var(--k); }
      .snd-cell[data-now='true'] { outline: 1px solid var(--bone); outline-offset: -1px; }
      .snd-cell[data-now='true'][aria-pressed='true'] { filter: brightness(1.35); }
    `),
    cv,
    h(
      'div',
      { class: 'trow' },
      playBtn,
      tempo,
      button('Crouch · Space', () => judge('crouch')),
      button('Swing · J', () => judge('swing')),
      button('Clear', () => {
        grid.forEach((row) => row.fill(false));
        paint();
      }),
    ),
    gridEl,
    read,
  );

  paint();
  say('Pulse is written - the preset a wielder starts with. Press <b>Play</b>, then crouch or swing on the notes.');

  /* --------------------------------------------------------------- loop --- */

  const husks = [
    { x: 250, a: 0 },
    { x: 310, a: 1 },
    { x: 370, a: 2 },
  ];
  loop(cv, (dt) => {
    schedule();
    const now = playing && audio ? Math.floor((audio.currentTime - startAt) / stepDur()) : -1;
    const s = now >= 0 ? now % STEPS : -1;
    if (s !== lastLoop) {
      if (lastLoop >= 0) ROWS.forEach((_, i) => cells[i][lastLoop].removeAttribute('data-now'));
      if (s >= 0) ROWS.forEach((_, i) => cells[i][s].setAttribute('data-now', 'true'));
      lastLoop = s;
    }
    dance = Math.max(0, dance - dt);

    ctx.clearRect(0, 0, 420, 90);
    ctx.strokeStyle = '#2B3D4B';
    ctx.beginPath();
    ctx.moveTo(0, 80.5);
    ctx.lineTo(420, 80.5);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.fillRect(56, 50, 12, 30);
    ctx.font = '9px "IBM Plex Mono", monospace';
    ctx.fillStyle = '#9AB0BC';
    ctx.fillText('you', 52, 90);
    for (const hk of husks) {
      if (dance > 0) hk.a += dt * 14;
      const hop = dance > 0 ? Math.abs(Math.sin(hk.a)) * 12 : 0;
      const w = dance > 0 ? Math.abs(Math.cos(hk.a)) * 12 + 2 : 12;
      ctx.fillStyle = '#6E7F5A';
      ctx.fillRect(hk.x - w / 2, 50 - hop, w, 30);
    }
    ctx.fillStyle = color;
    ctx.font = '11px "IBM Plex Mono", monospace';
    ctx.fillText(`streak ${streak}/${DANCE}  best ${best}`, 110, 22);
    for (let i = 0; i < DANCE; i++) {
      ctx.fillStyle = i < streak ? (i >= STRONG - 1 ? color : alpha(color, 0.6)) : '#1C2A35';
      ctx.fillRect(110 + i * 14, 30, 10, 6);
    }
    if (dance > 0) {
      ctx.fillStyle = '#7FE0A8';
      ctx.fillText('DANCE', 280, 22);
    }
  });
}
