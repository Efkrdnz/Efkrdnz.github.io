/* The Authorities guide for Magical: every word and number here is read off
   the mod's own source (AuthorityContent, MagicContent, the lang file and each
   Authority's pure core), not paraphrased from memory, so what the page says
   is what the game does. When a number changes in the mod, change it here. */

export interface Skill {
  name: string;
  /** How it is used: a press, a hold, a toggle. */
  input: string;
  /** Mana, cooldown or other price, as a short line. Omitted when there is none worth naming. */
  cost?: string;
  text: string;
}

export interface Step {
  title: string;
  body: string;
}

export interface Fact {
  k: string;
  v: string;
}

export interface Authority {
  id: string;
  name: string;
  color: string;
  /** Its shape in a word or two: the structure the power is built on. */
  shape: string;
  shapeLine: string;
  /** The Authority's own description, from the lang file. */
  right: string;
  pitch: string;
  steps: Step[];
  skills: Skill[];
  facts: Fact[];
  /** What the toy lets you do, and one line on how. */
  tryTitle: string;
  tryHint: string;
}

export interface Layer {
  id: string;
  depth: string;
  name: string;
  line: string;
  body: string;
  count?: string;
  /** Above the waterline or below it. */
  surface: boolean;
}

export const LAYERS: Layer[] = [
  {
    id: 'arcane',
    depth: 'Tier 1',
    name: 'Arcane',
    line: 'Spells you compose yourself.',
    body:
      "Runes, shapes and modifiers put together into a spell of your own. It has its own data, its own screen and its own casting, apart from every school below it - the one part of the mod where the spell is yours before it is anybody else's.",
    surface: true,
  },
  {
    id: 'elemental',
    depth: 'Tiers 0-4',
    name: 'Elemental',
    line: 'Fire, water, light, space, void and arcane.',
    body:
      'The skills anyone can find: five tiers across six schools, four keys to cast them from. Every skill takes a budget of points you divide between damage, speed, size, duration and efficiency - and damage points above zero compound, so a spell you specialise hits like a weapon. The Spell Creator fuses two you own into a third.',
    count: '80+ skills',
    surface: true,
  },
  {
    id: 'classes',
    depth: 'Classes',
    name: 'Classes',
    line: 'Sixteen, in a tree.',
    body:
      'Blacksmith to Divinesmith, Warrior to Berserker and Warden, Mystic, Spell Creator to Magic Originator. Class XP buys the next rung. A few chains are in no menu at all - the Sword Summoner is found by offering four swords under a night sky.',
    count: '16 classes',
    surface: true,
  },
  {
    id: 'blood',
    depth: 'Layer -1',
    name: 'Blood',
    line: 'Paid for in hearts.',
    body:
      'Seven actives billed to a Vessel first and to your own health after it - as true damage, which no armour or barrier takes anything off. Kills and bites spill pools you can pull back into the Vessel, or leave on the ground to spend.',
    count: '7 skills',
    surface: false,
  },
  {
    id: 'dark',
    depth: 'Layer -2',
    name: 'Dark',
    line: 'Shadow and corruption.',
    body: 'The second layer down: shadow, the void and corruption that builds the more the school is used.',
    count: '10 skills',
    surface: false,
  },
  {
    id: 'sword',
    depth: 'Layer -3',
    name: 'Sword',
    line: 'Steel you can see orbiting your head.',
    body:
      'Four rungs, found by a rite, not a menu. The whole kit counts in swords - four, seven, ten, twelve - racked from real weapons, standing in one of six stances, each hitting for the weapon it is.',
    count: '6 skills',
    surface: false,
  },
  {
    id: 'primordial',
    depth: 'Layer -4',
    name: 'Primordial',
    line: 'Catastrophes that read the land.',
    body:
      'Cyclone, Fault Line, Skyfall, Caldera, Tsunami, Upheaval. Each measures the ground where it breaks - open sky, stone, heat, water, mass - and is stronger or weaker for it. Where you stand is the build. The ground it borrows comes back.',
    count: '6 skills',
    surface: false,
  },
  {
    id: 'eldritch',
    depth: 'Layer -5',
    name: 'Eldritch',
    line: 'Paid for in being noticed.',
    body:
      'Six calls to things in the deep, paid in mana and in Notice. At 50 Notice nearby hostiles turn on you; at 100 something grasps at you every ten seconds. The more you are noticed, the stronger each call.',
    count: '6 skills',
    surface: false,
  },
  {
    id: 'authorities',
    depth: 'Layer -6',
    name: 'Authorities',
    line: 'Rules, not spells.',
    body:
      "The bottom of the iceberg. An Authority does not cast something into the world; it owns one of the world's rules. One holder a world each, and each works by a different shape - which is why every one of them has its own chapter below, and its own thing to try.",
    count: '7 powers',
    surface: false,
  },
];

export const AUTHORITIES: Authority[] = [
  {
    id: 'space',
    name: 'Space',
    color: '#88DFFF',
    shape: 'A domain',
    shapeLine: 'A sphere with laws written into it.',
    right: 'The right to define a local space and rewrite the rules within it.',
    pitch:
      'You raise a sphere around yourself and write physics into it. Inside, gravity is what you say it is, and so are motion, time, friction and what the walls do.',
    steps: [
      {
        title: 'Raise a subspace',
        body:
          'Hold Create Subspace to grow its radius and release to set it down. Sneak as you release and it follows you instead of staying put. Cast it again to dismiss it.',
      },
      {
        title: 'Write a law',
        body:
          'Stand inside and hold Manipulate Space. Three lists appear: a category, what happens to it, and who it happens to. The three chosen rows read as one sentence, and releasing the key writes it.',
      },
      {
        title: 'One law per category',
        body:
          'There are twelve categories - gravity, velocity, acceleration, air, pressure, mass, time, a vector field, entropy, friction, the boundary and collision - and each holds one law at a time. Twelve laws can be in force at once.',
      },
      {
        title: 'Aim it',
        body:
          'Every law has a target: everything except you, everything, living things, projectiles, or players. Reverse gravity for everything except you, and you are the only thing in your dome still standing on the floor.',
      },
      {
        title: 'Read the wall',
        body:
          'The dome is a vault of twelve ribs, one per category. A law makes its rib heavier and hangs a sign on it, and the more laws are in force the tighter the ribs wind - you can read how much law is written from the silhouette alone.',
      },
      {
        title: 'Leave and it ends',
        body: 'A subspace belongs to its caster. Step out of it and it is gone, laws and all.',
      },
    ],
    skills: [
      { name: 'Create Subspace', input: 'Hold, release', text: 'Define a transparent sphere. Hold to grow it, sneak on release to wear it, cast again to dismiss it.' },
      { name: 'Manipulate Space', input: 'Hold inside', text: 'Three lists - category, operation, target. Scroll turns a list, the mouse walks between them, 1-9 keep presets, release writes the law.' },
      { name: 'Pocket Dimension', input: 'Press', text: 'Fold into a private chamber. Sneak-use leaves a portal so others can follow; the door inside returns you to where you cast it.' },
      { name: 'Spatial Arsenal', input: 'Hold', text: 'A wheel of direct spatial attacks that need no subspace at all.' },
    ],
    facts: [
      { k: 'Categories', v: '12' },
      { k: 'Operations', v: '57' },
      { k: 'Targets', v: '5' },
      { k: 'Laws at once', v: '12' },
    ],
    tryTitle: 'Write a law',
    tryHint: 'Pick a category, an operation and a target. The dots are everything inside the dome; the ring in the middle is you.',
  },
  {
    id: 'soul',
    name: 'Soul',
    color: '#D8F0FF',
    shape: 'A bond',
    shapeLine: 'Two souls tied together, one at each end.',
    right: 'The right to bind, preserve, fracture, and restore the essence of living beings.',
    pitch:
      'You tie your soul to one other living thing. Death at either end brings that soul back beside the other - and the bond is also a road you can travel along.',
    steps: [
      {
        title: 'Bind a soul',
        body:
          'Open the Soul Vow wheel and choose Soul Valley while looking at something living that is not hostile to you - a wolf, a villager, a friend. It reaches 18 blocks, further with points in size.',
      },
      {
        title: 'Death brings it back',
        body: 'When either soul dies, it is resurrected beside the other, and a collapse window opens: seventy seconds.',
      },
      {
        title: 'The window is the danger',
        body:
          'The same side can die again and again and keep coming back. The vow only collapses if the other soul dies while the window is open - or if either side breaks the bond.',
      },
      {
        title: 'Travel the bond',
        body:
          'While bound, the wheel moves you along it: Swap trades places with your bound soul, Call brings it to you, Step takes you to it. Sever ends the bond, and so does sneaking as you choose an action.',
      },
    ],
    skills: [
      { name: 'Soul Vow', input: 'Hold', text: 'The wheel of binding laws. Everything the Authority does is chosen from it.' },
      { name: 'Soul Valley', input: 'From the wheel', text: 'Bind your soul to a non-hostile living being. Death on one side resurrects that soul near the other and opens a collapse window.' },
      { name: 'Swap', input: 'From the wheel', cost: '18 mana', text: 'Trade places with your bound soul.' },
      { name: 'Call', input: 'From the wheel', cost: '12 mana', text: 'Bring your bound soul to you.' },
      { name: 'Step', input: 'From the wheel', cost: '10 mana', text: 'Go to your bound soul.' },
      { name: 'Sever', input: 'From the wheel', cost: 'Free', text: 'Break the bond.' },
    ],
    facts: [
      { k: 'Bind reach', v: '18+ blocks' },
      { k: 'Collapse window', v: '70 s' },
      { k: 'Swap / Call / Step', v: '18 / 12 / 10 mana' },
      { k: 'Souls per vow', v: '2' },
    ],
    tryTitle: 'Keep two souls alive',
    tryHint: 'Kill either side and watch it come back. Kill the other one inside the window and the vow collapses.',
  },
  {
    id: 'mana',
    name: 'Mana',
    color: '#C9D3FF',
    shape: 'A deck',
    shapeLine: 'Verses written in an order and read a breath at a time.',
    right:
      'The right to compose magic from nothing. Not to cast a spell someone else finished, but to write one, verse by verse, and have the world read it back.',
    pitch:
      'You do not learn spells. You learn verses - a needle, an orb, a trident, a fuse - write them into incantations, and the game reads back exactly what you wrote.',
    steps: [
      {
        title: 'Learn verses',
        body:
          'There are 115 of them in eight kinds: projectiles, statics that stand where they land, modifiers, multicasts, materials that change the ground, controls, utilities and passives.',
      },
      {
        title: 'Write an incantation',
        body:
          'Open the Grimoire. Each of your four incantations is a row of up to twenty verses in an order, with a breath from 1 to 8 - how many verses one press reads.',
      },
      {
        title: 'Press to recite',
        body:
          'Incantation I to IV each recite one row. A press reads the next verses and fires them as one shot; the next press carries on where that one stopped, and a finished row starts over.',
      },
      {
        title: 'Verses change each other',
        body:
          'A multicast gathers the verses after it into one volley - a Trident is three at once, in a fan. A modifier is stamped onto the bodies after it in the same shot, and reads another verse so it never costs a breath.',
      },
      {
        title: 'Every body ends one way',
        body:
          'A body that hits something releases its Latch; one on a timer, its Fuse; one that simply runs out, its Epitaph. Each can carry more verses inside it, released when it ends.',
      },
      {
        title: 'The price is what you read',
        body:
          'Mana is the sum of the verses a press read, and the beat before the next press is theirs too. A cheap row fires fast; a heavy one hits hard and slowly.',
      },
    ],
    skills: [
      { name: 'Incantation I-IV', input: 'Press', text: 'Recite one incantation of your Grimoire: read the next verses, bill the mana they name, fire them as one shot.' },
      { name: 'Grimoire', input: 'Press', text: 'Write the four incantations by drag and drop, with a reading of what a press would cast before you save it.' },
    ],
    facts: [
      { k: 'Verses', v: '115' },
      { k: 'Incantations', v: '4' },
      { k: 'Row', v: '20 verses' },
      { k: 'Breath', v: '1-8' },
    ],
    tryTitle: 'Write an incantation',
    tryHint: 'Click a verse to write it into the row and a written one to strike it. Set the breath, then press Recite and see what each press reads.',
  },
  {
    id: 'chaos',
    name: 'Chaos',
    color: '#FF4FD8',
    shape: 'A sandpile',
    shapeLine: 'Stress loaded into the world until it gives way.',
    right:
      'The right to decide which way a thing gives. Not to break it - to author the shape of its collapse, and then to load the ground until it arrives on its own.',
    pitch:
      'Think of a sandpile you add one grain to at a time. Nothing happens, and nothing happens, and then one grain too many starts an avalanche. Chaos is that, played with the ground under your enemies - and you decide how the avalanche behaves.',
    steps: [
      {
        title: 'Everything holds some stress',
        body:
          "Every block and every living body carries stress up to a capacity: stone 4; dirt, sand and wood 2; glass and leaves 1; a mob 2 plus its armour; a player 3; another Authority's construct only 1.",
      },
      {
        title: 'Load it with Burden',
        body:
          'Burden puts one unit of stress on whatever your crosshair is on, for 2 mana, and it is meant to be pressed dozens of times. Stress shows as purple motes everybody can see, and the action bar reads 3/4 for the spot you aim at.',
      },
      {
        title: 'Over capacity, it gives way',
        body:
          'A site holding more than its capacity breaks and pushes everything it held into its neighbours. A neighbour that was already full breaks in turn. That is the cascade, and it rolls out over a second or two.',
      },
      {
        title: 'The Fracture decides how',
        body:
          'Five faults in a row: the first wave of breaking follows fault one, the second wave fault two, and so on. Slump rolls downhill, Heap gathers into the fullest spot, Bloom spreads evenly, Hunt goes only into living things, Recoil throws it back, Shed detonates where it stands and Root swallows it.',
      },
      {
        title: 'Pull the trigger',
        body:
          'The Last Grain adds one unit from nowhere - a click on ground below capacity, the avalanche on ground at it. Criticality lowers every capacity by one for ten seconds, so everything you loaded goes at once.',
      },
      {
        title: 'The ground remembers',
        body:
          'A spot that has given way is dead for thirty seconds and takes no more stress, so the same ground cannot be used twice. You are a site too, and nothing is saved: stress is forgotten when you log out or change dimension.',
      },
    ],
    skills: [
      { name: 'Burden', input: 'Press, often', cost: '2 mana', text: 'One unit of stress on what you look at. Sneak to burden yourself.' },
      { name: 'The Fracture', input: 'Hold', cost: '5 s cooldown', text: 'Author your five faults. Scroll turns a gate, the mouse walks between them, release commits the row.' },
      { name: 'The Last Grain', input: 'Press', cost: '4 mana', text: 'One more unit, from nowhere. On ground at capacity it is the avalanche.' },
      { name: 'Criticality', input: 'Press', cost: '72 mana, 60 s', text: 'Every capacity in your Pile drops by one for ten seconds, and everything standing lets go.' },
    ],
    facts: [
      { k: 'Faults', v: '7' },
      { k: 'Fracture', v: '5 positions' },
      { k: 'Dead ground', v: '30 s' },
      { k: 'Random numbers', v: 'None' },
    ],
    tryTitle: 'Load the ground, then drop the last grain',
    tryHint: 'Click cells to Burden them. Set the five faults, then click The Last Grain and a full cell - or press Criticality - and watch it go.',
  },
  {
    id: 'causality',
    name: 'Causality',
    color: '#E8A33D',
    shape: 'A graph',
    shapeLine: 'Causes, questions and consequences, joined with string.',
    right: 'Cause and effect answer to you. Nothing here is a spell: you write rules on a board and the world keeps them.',
    pitch:
      'The one nobody presses. You pin rules on a board before the fight - when I am hit, bank it; when the bank reaches 20, spend it on the nearest thing - and in the fight the world keeps them for you.',
    steps: [
      {
        title: 'Pin a cause',
        body:
          'A cause is something that happens: you are hurt, you strike, you slay, you are mended, a block breaks, the ledger brims, you speak a Decree. Thirteen of them.',
      },
      {
        title: 'Ask a question',
        body:
          'Conditions filter it: only melee, only fire, only while crouched, only when the ledger is over some amount, only once in a while. Fifteen, and optional.',
      },
      {
        title: 'Run string to a consequence',
        body:
          'Store banks a hit in the ledger, Spend pays it back out as damage, Mend heals, Ward shields, Return sends the hit back to its source, Echo repeats it, Erase unmakes it. String only runs forward - cause, then question, then consequence - and never in a loop.',
      },
      {
        title: 'The ledger is how a board talks to itself',
        body:
          'Store and Spend only move a number between the world and your ledger. That is conservation, and conservation is free.',
      },
      {
        title: 'Paradox is the price',
        body:
          'You pay only for breaking conservation: Return 0.08 a point, Echo 0.5, Sever 0.6, Erase 0.9, charged on the amount after Greater or Lesser. At 40 every action costs double mana; at 70 any chain longer than three pins is cut and the rest is halved; at 100 the board shuts for twenty seconds and the ledger is paid out of your own hide.',
      },
      {
        title: 'Reach outside yourself',
        body:
          'Causal Anchor Marks one body for 45 seconds. The marked causes and conditions weigh three times as much and do nothing without one.',
      },
    ],
    skills: [
      { name: 'Causal Board', input: 'Press', cost: 'Free', text: 'Open the board: pin causes and consequences and run string between them.' },
      { name: 'Causal Anchor', input: 'Hold, release', text: 'Every body in reach gets a ring; walk the focus and release to Mark one. 28 blocks.' },
      { name: 'Decree', input: 'Press', text: 'The one cause you fire by hand, so a board can have a trigger of its own.' },
      { name: 'Recompense', input: 'Press', text: 'Spend the whole ledger at once on what you look at. It costs no paradox at all.' },
      { name: 'Suspend', input: 'Press', text: 'Every rule off, or every rule on again. Paradox cools three times as fast while the board is quiet.' },
    ],
    facts: [
      { k: 'Pins', v: '24' },
      { k: 'Strings', v: '32' },
      { k: 'Paradox rungs', v: '40 / 70 / 100' },
      { k: 'Mark', v: '45 s, 28 blocks' },
    ],
    tryTitle: 'Wire one rule and take a hit',
    tryHint: 'Choose the cause, the question and the consequence. Then take hits and watch the ledger and the paradox gauge.',
  },
  {
    id: 'mind',
    name: 'Mind',
    color: '#BDA4FF',
    shape: 'A belief matrix',
    shapeLine: 'Every viewer believes every lie by its own amount.',
    right: 'Reality is what enough minds agree on. Study the world, write a scene, and let everyone who sees it decide whether it is there.',
    pitch:
      'You build lies out of what you have studied and set them down in the world. Each mind that sees one decides for itself how real it is - and when enough of them agree, it stops being a lie.',
    steps: [
      {
        title: 'Study',
        body:
          'Hold still and look at a block for two seconds or a creature for three, and you learn it. Look again and again and you learn it better: fidelity rises at 1, 5 and 20 looks. You can only lie in what you have seen.',
      },
      {
        title: 'Daydream a scene',
        body:
          'Daydream turns your hotbar into a belt of the lies you know. Draw a wall, a pit, a cat - blocks and figments - and it is kept as a reverie.',
      },
      {
        title: 'Unveil it',
        body:
          'Set the reverie down where you look. Nothing is placed: every mind that sees it starts to believe it, faster the more plausible it is - stone on stone in a quarry, not a diamond wall in a desert.',
      },
      {
        title: 'Belief rises and breaks',
        body:
          'Seen, belief climbs; unseen, it slowly fades. Contradiction is the fast way down: touching it costs 0.60, a projectile through it 0.35, watching somebody else touch it 0.20. Below 0.1 it shatters for that mind for good. Mobs path around a wall they believe at 0.3.',
      },
      {
        title: 'Enough agreement makes it real',
        body:
          'A mind at 0.5 or more is convinced and votes its belief: a mob counts once, a player three times, a boss five. A wall weighs half a point a block. When the votes reach its weight the wall is there - real stone - and it stays real until they fall below half of it.',
      },
      {
        title: 'Put the sure to sleep',
        body:
          'Lull a mind that is sure, at 0.8: a creature sleeps where it stands; a player falls into your Dreamscape and wakes only by finding its Flaw.',
      },
    ],
    skills: [
      { name: 'Daydream', input: 'Toggle', text: 'Draw a reverie into the air out of what you have studied. The inventory key opens the Lexicon.' },
      { name: 'Unveil', input: 'Press', text: 'Set your reverie down where you look. It is exactly as real as the minds around it believe.' },
      { name: 'Insist', input: 'Hold', cost: '3 mana a tick', text: 'Everyone who half-believes a piece of your scene believes it more; everyone who doubts it doubts harder.' },
      { name: 'Lull', input: 'Press', cost: '60 mana, 60 s', text: 'A sure creature sleeps; a sure player falls into your Dreamscape. Sneak to dream yourself.' },
    ],
    facts: [
      { k: 'Convinced at', v: '0.5' },
      { k: 'Shatters below', v: '0.1' },
      { k: 'Votes', v: 'mob 1, player 3, boss 5' },
      { k: 'A block weighs', v: '0.5' },
    ],
    tryTitle: 'Make a wall real',
    tryHint: 'A four-block wall stands in front of three minds. Let them watch it, touch it, or Insist - and see whether their votes make it real.',
  },
  {
    id: 'sound',
    name: 'Sound',
    color: '#6FE0C0',
    shape: 'A beat',
    shapeLine: 'Everything happens on the note.',
    right:
      'The right to be heard. Write a Song and play it where you stand - crouch or swing on its notes and everything in earshot answers - or hold a Riff and let the notes fly.',
    pitch:
      'Every other Authority acts on a place, a body or a rule. This one acts on time: you write music, play it, and hit on the beat.',
    steps: [
      {
        title: 'Write a Song',
        body:
          'Open the Score: four bars of sixteenth notes across a three-row kit, five rows of bass and five of melody, at one of three tempos and four scales. Three presets ship, and songs share as plain JSON you can paste.',
      },
      {
        title: 'Play it',
        body: 'Song loops it where you stand - 12 mana to start, 4 a bar to keep going. Everybody in earshot hears it.',
      },
      {
        title: 'Crouch or swing on the notes',
        body:
          'Land a crouch or a swing within two ticks of a note and it counts. Each track sounding on that step gives its effect: a crouch keeps it (kit Bulwark, bass Rooted, melody Mend) and a swing throws it at every hostile in earshot (Stagger, Weight, Dissonance).',
      },
      {
        title: 'Keep the streak',
        body: 'Four in a row and every effect steps up. Eight in a row and everything hostile in earshot dances. A miss breaks it.',
      },
      {
        title: 'Hold a Riff',
        body:
          'Up to eight notes, each one of sixteen instruments at a pitch, all at one amplitude. Drums blast a cone, low notes roll through walls and slow, keys pierce two bodies, bells ring straight through armour, strings seek. Loud is dear: a note costs 0.4 times the amplitude squared.',
      },
    ],
    skills: [
      { name: 'The Score', input: 'Press', text: 'The sequencer: write the Song on four bars of kit, bass and melody, and the Riff note by note.' },
      { name: 'Song', input: 'Toggle', cost: '12 mana, 4 a bar', text: 'Plays your Song where you stand. Crouch or swing on its notes; eight in a row and everything dances.' },
      { name: 'Riff', input: 'Hold', cost: '0.4 × amplitude² a note', text: 'Plays your Riff round and round, a note every four ticks, each doing what its instrument does.' },
    ],
    facts: [
      { k: 'Loop', v: '4 bars, 64 steps' },
      { k: 'Hit window', v: '2 ticks' },
      { k: 'Streak', v: '4 strong, 8 dance' },
      { k: 'Instruments', v: '16' },
    ],
    tryTitle: 'Play on the beat',
    tryHint: 'Write a bar, press Play, and hit Space (or Swing) on the notes. Hold a streak of eight.',
  },
];
