/*
 * Build the Minefinity Gauntlet codex database from the mod's own source.
 *
 * The 150 stone abilities are not retyped here. `StoneAbilityCatalog.java` is
 * the mod's canonical, self-validating catalog — stable (stoneId, powerId)
 * pairs, names, descriptions, control contracts — so it is parsed directly.
 * That way the wiki cannot drift from the game: rerun this after a catalog
 * change and the site picks it up.
 *
 * Everything the Java file does not carry — stone lore, what each stone is
 * for, how abilities group by role, the series framing — lives in this file
 * as authored content, keyed by the same stable IDs.
 *
 * Usage: node scripts/build-codex.cjs ["E:/minecraft mods"] [--dry]
 */
const fs = require('fs');
const path = require('path');

const MODS_DIR = process.argv[2] && !process.argv[2].startsWith('--')
  ? process.argv[2]
  : 'E:/minecraft mods';
const DRY = process.argv.includes('--dry');

const CATALOG = path.join(
  MODS_DIR,
  'Minefinity Gauntlet/src/main/java/net/efkrdnz/minefinitygauntlet/ability/StoneAbilityCatalog.java'
);
const OUT = path.join(__dirname, '..', 'src', 'data', 'codex', 'minefinity-gauntlet.json');
/* The series is not the Gauntlet's data — the home page needs it too, so it
   gets its own file rather than being read out of one module's codex. */
const OUT_SERIES = path.join(__dirname, '..', 'src', 'data', 'series', 'minefinity.json');

/* ── the mod's own palette ────────────────────────────────────────────────
   Lifted from client/gui/shader/StoneTheme.java so the site's gems are the
   colours players see in the selector, not an approximation. */
const THEME = {
  space: ['#4CCBFF', '#315CFF'],
  power: ['#E455FF', '#7B2CFF'],
  reality: ['#FF4A55', '#9C1437'],
  time: ['#4DFF91', '#159A6C'],
  soul: ['#FFAD42', '#E54F17'],
  mind: ['#FFE95B', '#FF9D18'],
  infinity: ['#C9B3FF', '#8C62FF'],
};

/* Lore lines are the mod's own item tooltips (lang/en_us.json). */
const STONES = [
  {
    key: 'space',
    id: 0,
    name: 'Space Stone',
    lore: 'Distance is only a suggestion.',
    domain: 'Travel, portals, logistics, gravity',
    summary:
      'The stone that refuses to let a map matter. It starts with a 50-block Warp and a stored anchor, and ends holding eight dimension-aware waypoints, a private nine-stack cache, a corral that folds space around your animals, and a gravity field you can switch off.',
    reads:
      'Space is the quality-of-life stone. Most of its expanded catalog is logistics rather than combat — moving items, moving allies, moving one block of a build exactly one block sideways.',
    signature: ['warp', 'singularity', 'waypoint_atlas'],
    legacy: 8,
  },
  {
    key: 'power',
    id: 1,
    name: 'Power Stone',
    lore: "Creation's raw force, barely contained.",
    domain: 'Kinetic force, demolition, mining, machinery',
    summary:
      'Force with somewhere to go. The original four are a punch, a launch, a charged lance and World Sunder; the expansion turns that same energy on ore veins, stubborn blocks, redstone pulses, nearby machines and your own tools.',
    reads:
      'The only stone where the destructive and the useful are the same gesture at different scales — a Vein Burst and a World Sunder are the same idea, metered differently.',
    signature: ['power_beam', 'world_sunder', 'titan_strength'],
    legacy: 4,
  },
  {
    key: 'reality',
    id: 2,
    name: 'Reality Stone',
    lore: 'Rewrites matter, form, and probability.',
    domain: 'Block editing, terrain, illusion, phase, scale',
    summary:
      'The largest catalog in the gauntlet, and the one that behaves least like a weapon. Reality is a builder: palettes, block states, clone stamps, terrain sculpting, scaffolding that fades, an undo. Then it turns and offers a pocket dimension, phasing, intangible matter, and erasure.',
    reads:
      'Thirty abilities, and roughly two thirds of them are construction tools. The three Pocket abilities are deliberately one set — Banish, Entry and Collapse only read correctly together.',
    signature: ['existence_erasure', 'reality_phase', 'size_shift'],
    legacy: 4,
  },
  {
    key: 'time',
    id: 3,
    name: 'Time Stone',
    lore: 'Commands moments, motion, and consequence.',
    domain: 'Slowing, stopping, rewinding, tick control',
    summary:
      'The smallest catalog and the sharpest. Slow and Stop are the famous pair; the rest is tick control with a builder\'s bent — crop pulses, machine pause, copper aging, block rollback, and a construction snapshot the Infinity stone later builds from.',
    reads:
      'Time is the stone that talks to other stones. Its Construction Snapshot is what Builder\'s Snap consumes, and Timeline Erasure is the green counterpart to Reality\'s red one.',
    signature: ['time_stop', 'timeline_erasure', 'construction_snapshot'],
    legacy: 2,
  },
  {
    key: 'soul',
    id: 4,
    name: 'Soul Stone',
    lore: 'Binds life, death, memory, and spirit.',
    domain: 'Capture, storage, healing, death insurance',
    summary:
      'Capture something and it lives in your storage until you let it out. Around that sit the safety nets: a soulbound slot, a protected grave, a bank for experience, a fatal hit you get to survive once, and a resurrection token you have to pay for in advance.',
    reads:
      'The stone you notice most when you die. Half of Soul is insurance, and it is the only stone whose expansion is mostly about what happens after a mistake.',
    signature: ['soul_capture', 'last_stand', 'creative_flight'],
    legacy: 5,
  },
  {
    key: 'mind',
    id: 5,
    name: 'Mind Stone',
    lore: 'Sees thought and imposes absolute will.',
    domain: 'Sensing overlays, information, command',
    summary:
      'Know All was the only Mind ability for a long time. Now it opens onto a full sensing suite — threat radar, ore sense, spawn-safety overlay, redstone inspector, farming overlay — plus orders you can give mobs and a scan that reads any target down to its effects.',
    reads:
      'Mind reads the world rather than changing it. Its overlays are private: the server sends them only to you, so nobody else sees your outlines.',
    signature: ['know_all', 'threat_radar', 'mind_annihilation'],
    legacy: 1,
  },
  {
    key: 'infinity',
    id: 6,
    name: 'All Six',
    lore: 'Only with every stone installed.',
    domain: 'The Snap, erasure, the Universal Law forge',
    summary:
      'Not a stone you find — a state the gauntlet enters once all six gems are seated. It holds the Snap, a 224-block beam, Convergence, five bounded "snap" utilities that build, harvest, clear and repair, and the Universal Law forge.',
    reads:
      'The Infinity row does not appear in the R screen until all six bits are installed, and every Infinity ability re-checks that on the server before it fires.',
    signature: ['snap', 'infinity_beam', 'universal_law'],
    legacy: 0,
  },
];

/* ── control contracts ──────────────────────────────────────────────────── */
const CONTROLS = {
  TAP_USE: { label: 'Tap Use', note: 'One press of the use key.' },
  HOLD_USE: { label: 'Hold Use', note: 'Held to charge, channel or sustain.' },
  SNEAK_USE: { label: 'Sneak + Use', note: 'Crouch modifier changes the action.' },
  USE_ON_BLOCK: { label: 'Use on Block', note: 'Needs a block face as its target.' },
  USE_ON_ENTITY: { label: 'Use on Entity', note: 'Needs a living target under the crosshair.' },
  ATTACK: { label: 'Attack', note: 'Bound to the attack key rather than use.' },
  TOGGLE: { label: 'Toggle', note: 'Stays on until switched off. Persists.' },
  OPEN_SCREEN: { label: 'Open Interface', note: 'Opens a dedicated screen.' },
  CONFIGURE: { label: 'Configure, then Use', note: 'Set it up first, then fire it.' },
  PASSIVE: { label: 'Passive', note: 'Runs on its own while the stone is installed.' },
  CONFIRM: { label: 'Requires Confirmation', note: 'Second press within five seconds, or it does not happen.' },
  CONTEXTUAL: { label: 'Contextual', note: 'Does different things depending on what you are aiming at.' },
};

/* ── roles ──────────────────────────────────────────────────────────────────
   The catalog has no role field, so this is the one genuinely authored axis:
   what an ability is FOR, keyed by its stable catalog key. Kept as a flat map
   so an unclassified addition fails loudly at build time rather than silently
   landing in a bucket it does not belong in. */
const ROLES = {
  combat: 'Combat',
  movement: 'Movement',
  building: 'Building',
  sensing: 'Sensing',
  support: 'Support',
  utility: 'Utility',
};

const ROLE_OF = {
  'space.warp': 'movement', 'space.anchor_set': 'movement', 'space.teleport': 'movement',
  'space.detailed_teleport': 'movement', 'space.block_telekinesis': 'combat',
  'space.vacuum_portal': 'combat', 'space.singularity': 'combat',
  'space.normalize_space_time': 'utility', 'space.waypoint_atlas': 'movement',
  'space.blink_chain': 'movement', 'space.mass_recall': 'support',
  'space.rescue_beacon': 'support', 'space.spatial_cache': 'utility',
  'space.item_vacuum': 'utility', 'space.cargo_portal': 'utility',
  'space.remote_hand': 'utility', 'space.structure_shift': 'building',
  'space.fall_gate': 'support', 'space.spatial_anchor': 'support',
  'space.boundary_ward': 'sensing', 'space.mob_corral': 'utility',
  'space.coordinate_probe': 'sensing', 'space.void_disposal': 'utility',
  'space.anti_gravity': 'movement',

  'power.power_punch': 'combat', 'power.power_launch': 'movement',
  'power.power_beam': 'combat', 'power.world_sunder': 'combat',
  'power.vein_burst': 'utility', 'power.quarry_palm': 'building',
  'power.siege_drill': 'utility', 'power.power_forge': 'support',
  'power.tool_overcharge': 'support', 'power.kinetic_battery': 'combat',
  'power.impact_guard': 'support', 'power.redstone_injector': 'utility',
  'power.machine_surge': 'utility', 'power.power_beacon': 'support',
  'power.demolition_pattern': 'building', 'power.shockwave': 'combat',
  'power.momentum_strike': 'combat', 'power.charge_transfer': 'utility',
  'power.emergency_discharge': 'combat', 'power.titan_strength': 'combat',

  'reality.projectile_negation': 'support', 'reality.atmosphere_shift': 'utility',
  'reality.heal': 'support', 'reality.block_shift': 'building',
  'reality.palette_shift': 'building', 'reality.state_tuner': 'building',
  'reality.builders_wand': 'building', 'reality.clone_stamp': 'building',
  'reality.material_exchange': 'building', 'reality.terrain_sculpt': 'building',
  'reality.reality_undo': 'building', 'reality.temporary_scaffolding': 'building',
  'reality.growth_rewrite': 'utility', 'reality.weather_rewrite': 'utility',
  'reality.matter_repair': 'support', 'reality.mob_polymorph': 'utility',
  'reality.camouflage': 'utility', 'reality.illusion_projector': 'building',
  'reality.fluid_sculptor': 'building', 'reality.environmental_adaptation': 'support',
  'reality.pocket_banish': 'combat', 'reality.pocket_entry': 'movement',
  'reality.pocket_collapse': 'combat', 'reality.existence_erasure': 'combat',
  'reality.reality_phase': 'movement', 'reality.intangible_matter': 'movement',
  'reality.illusion_blocks': 'building', 'reality.reversed_illusion_blocks': 'building',
  'reality.illusion_purge': 'building', 'reality.size_shift': 'utility',

  'time.time_slow': 'combat', 'time.time_stop': 'combat',
  'time.personal_rewind': 'support', 'time.temporal_anchor': 'support',
  'time.projectile_rack': 'combat', 'time.growth_pulse': 'utility',
  'time.machine_accelerator': 'utility', 'time.machine_pause': 'utility',
  'time.day_dial': 'utility', 'time.block_rollback': 'building',
  /* key is cooldown_borrow; the ability was renamed to Temporal Overclock
     without reassigning its stable key, which is the intended behaviour. */
  'time.entity_rewind': 'utility', 'time.cooldown_borrow': 'support',
  'time.delayed_trigger': 'utility', 'time.copper_aging': 'building',
  'time.temporal_trail': 'sensing', 'time.construction_snapshot': 'building',
  'time.timeline_erasure': 'combat',

  'soul.soul_barrier': 'support', 'soul.vampiric_beam': 'combat',
  'soul.soul_swap': 'movement', 'soul.soul_capture': 'combat',
  'soul.soul_storage': 'utility', 'soul.soul_bank': 'utility',
  'soul.soulbound_slot': 'support', 'soul.death_recall': 'sensing',
  'soul.gravekeeper': 'support', 'soul.spirit_lantern': 'sensing',
  'soul.spectral_scout': 'sensing', 'soul.pacify': 'support',
  'soul.companion_bind': 'utility', 'soul.sanctuary': 'support',
  'soul.life_transfer': 'support', 'soul.cleanse': 'support',
  'soul.curse_vessel': 'utility', 'soul.soul_mend': 'support',
  'soul.spirit_beacon': 'sensing', 'soul.last_stand': 'support',
  'soul.possession': 'combat', 'soul.resurrection_token': 'support',
  'soul.soul_census': 'sensing', 'soul.creative_flight': 'movement',

  'mind.know_all': 'sensing', 'mind.mind_annihilation': 'combat',
  'mind.tactical_scan': 'sensing', 'mind.threat_radar': 'sensing',
  'mind.ore_sense': 'sensing', 'mind.spawn_safety_overlay': 'sensing',
  'mind.redstone_inspector': 'sensing', 'mind.recipe_consultant': 'utility',
  'mind.structure_locator': 'sensing', 'mind.route_planner': 'utility',
  'mind.mob_command': 'utility', 'mind.aggro_redirect': 'combat',
  'mind.team_link': 'support', 'mind.blueprint_analyzer': 'building',
  'mind.container_auditor': 'utility', 'mind.villager_advisor': 'utility',
  'mind.farming_overlay': 'sensing', 'mind.enchantment_planner': 'utility',
  'mind.memory_journal': 'utility', 'mind.remote_view': 'sensing',
  'mind.mind_ward': 'support', 'mind.confusion_pulse': 'combat',

  'infinity.snap': 'combat', 'infinity.absolute_erasure': 'combat',
  'infinity.infinity_beam': 'combat', 'infinity.universal_law': 'utility',
  'infinity.convergence': 'combat', 'infinity.builders_snap': 'building',
  'infinity.harvest_snap': 'utility', 'infinity.sanctuary_snap': 'support',
  'infinity.cleanup_snap': 'utility', 'infinity.undo_snap': 'building',
  'infinity.emergency_recall': 'support', 'infinity.law_console': 'utility',
  'infinity.world_repair': 'building',
};

/* ── systems: what the abilities sit inside ─────────────────────────────── */
const SYSTEMS = [
  {
    id: 'installing',
    title: 'Installing the stones',
    lede: 'A gauntlet is empty until you put gems in it.',
    body:
      'Stones are installed into one specific Infinity Gauntlet through the **R** screen, and the result is stored on that item stack as a six-bit mask. In survival the loose stone is consumed; in creative you only need to be carrying it. Shift-click removes a stone, hands it back, clears its quick-slot assignments and selects whatever is still installed. The six gem cuboids on the model are tinted by stable stone ID, so a half-built gauntlet visibly has holes in it, and the full-gauntlet glint only appears once all six are seated.',
  },
  {
    id: 'selecting',
    title: 'Picking a power',
    lede: 'Two keys, then the mouse does the rest.',
    body:
      '**R** opens the stone selector, **V** opens the ability list for whichever stone is active — both are Minefinity Core bindings, rebindable under `Minefinity Universe`, and the Gauntlet registers no duplicates. Stone tabs are filtered to what you have actually installed, and V refuses to open a missing stone\'s list. Right-clicking a power in any V list stars it without selecting it; starred powers collect into one cross-stone favourites view. Hotbar keys **1–6** double as quick slots while a gauntlet is held, and no extra Controls entries are added for them.',
  },
  {
    id: 'law',
    title: 'The Universal Law forge',
    lede: 'WHEN trigger → SELECT targets → IF conditions → DO stone actions.',
    body:
      'The Infinity catalog\'s largest feature is a visual rule builder with five saved slots. Laws are assembled from a server-approved palette — no Java, no commands, no arbitrary NBT — then validated, dry-run, compiled and executed by the server; the client is only an editor. Conditions have real `Then`, `Else If` and `Else` bodies, target sets compose through Add / Except / Filter, and a law-wide shield can exempt named players or anyone carrying a full gauntlet. Limits are 128 nodes, 64 actions, 12 nesting levels, 16 Else-If arms. You can edit on the in-game canvas or in a packaged browser studio the client hosts on loopback with a one-time token.',
  },
  {
    id: 'erasure',
    title: 'Erasure has a colour',
    lede: 'Three stones can delete something. You can tell which one did.',
    body:
      'When a target is erased, the server sends its exact final state to the client a moment before discarding it, and the client dissolves that captured model rather than playing a death animation. Snap and Absolute Erasure use brown dust, Time\'s Timeline Erasure uses green chronal energy, Reality\'s Existence Erasure uses red. Wide models dissolve sideways, tall ones from the top down. Nothing drops and nothing gets experience — but the kill is still credited to whoever caused it.',
  },
  {
    id: 'overlays',
    title: 'Private sensing',
    lede: 'Your outlines are yours.',
    body:
      'Mind\'s Threat Radar picks at most 128 loaded hostiles in a true 32-block radius and sends entity IDs and colours only to the one player who owns it. Minefinity Core turns those into a namespaced client layer routed through Minecraft\'s own silhouette pass — without setting the `Glowing` flag or touching scoreboard teams — so other players see nothing. Colour is priority, not decoration: purple for boss or elite, red for anything targeting you, orange for engaged, yellow for idle danger.',
  },
];

/* ── the series ─────────────────────────────────────────────────────────── */
const SERIES = {
  name: 'Minefinity Series',
  tagline: 'One library, one control scheme, one creative tab.',
  blurb:
    'Every Minefinity mod is a module. Minefinity Core holds the parts they all need — the shared keybinds, the Superpowers creative tab, the private client outlines, the third-person animation runtime — and each hero or artifact plugs into it. Core never depends on a module, so installing one does not drag the rest in.',
  core: {
    key: 'core',
    name: 'Minefinity Core',
    role: 'Library',
    tagline: 'The shared runtime every module consumes.',
    blurb:
      'Owns the five rebindable controls under `Minefinity Universe`, the one Superpowers creative tab with its alignment and collection filters, the client glow registry for private colored outlines, and the animation data model, sampler, live library and server-authoritative playback used for third-person clips.',
    provides: [
      'Shared controls: R, V, Z, X, C',
      'One Superpowers creative tab',
      'Private colored client outlines',
      'Third-person animation runtime',
      'Server-side semantic input routing',
    ],
    status: 'library',
  },
  modules: [
    {
      key: 'gauntlet',
      name: 'Minefinity Gauntlet',
      role: 'Artifact',
      tagline: 'Six stones. No restrictions.',
      blurb:
        'The Infinity Gauntlet as a 150-ability catalog: install gems into one stack, pick a stone with R, pick a power with V, and program persistent world rules in the Universal Law forge.',
      status: 'published',
      slug: 'minefinity-gauntlet',
      stat: '150 abilities',
    },
    {
      key: 'ironman',
      name: 'Minefinity Ironman',
      role: 'Hero',
      tagline: 'A suit, and a voice that answers it.',
      blurb:
        'A controllable four-piece suit with server-authoritative flight and weapons, dual-arm loadouts on left and right click, and a private voice-driven JARVIS. Speech is transcribed on the server; explicit suit orders go through a deterministic allow-list, and generated text never executes anything.',
      status: 'dev',
      stat: 'In development',
    },
    {
      key: 'spiderman',
      name: 'Minefinity Spiderman',
      role: 'Hero',
      tagline: 'Three suits, and the city to swing through.',
      blurb:
        'Web slinging, wall movement and wrist-mounted shooters. Suits are registered data rather than hardcoded checks — a suit owns its four pieces, the skin it paints on the wearer, and the abilities it grants, so adding one is a registration instead of another branch through every power.',
      status: 'dev',
      /* Unreleased, but it has a page and a manual, so it links. */
      slug: 'minefinity-spiderman',
      stat: 'Manual online',
    },
    {
      key: 'thor',
      name: 'Minefinity Thor',
      role: 'Hero',
      tagline: 'The weapon is the power.',
      blurb:
        'Mjolnir and Stormbreaker, and the storm they command. The other modules ask which suit is worn; this one asks which weapon is held. Mjolnir judges its wielder and Stormbreaker does not — a weapon that refuses you says so rather than leaving the keys silently dead.',
      status: 'dev',
      stat: 'In development',
    },
  ],
};

/* ── parse ──────────────────────────────────────────────────────────────── */

/* Matches one a(...) factory call. Java string literals may contain escaped
   quotes, so the literal pattern has to allow \" rather than stopping at the
   first ". Kept to the seven-argument shape the record actually declares — a
   change to StoneAbility's arity should break this loudly, not silently skip
   rows and ship a short catalog. */
const STR = '"((?:[^"\\\\]|\\\\.)*)"';
const CALL = new RegExp(
  `a\\(StoneType\\.([A-Z]+)\\s*,\\s*(\\d+)\\s*,\\s*${STR}\\s*,\\s*${STR}` +
    `\\s*,\\s*${STR}\\s*,\\s*([A-Z_]+)\\s*,\\s*${STR}\\s*\\)`,
  'g'
);

function unescapeJava(s) {
  return s.replace(/\\(.)/g, (_m, c) =>
    c === 'n' ? '\n' : c === 't' ? '\t' : c
  );
}

function fail(msg) {
  console.error(`build-codex: ${msg}`);
  process.exit(1);
}

if (!fs.existsSync(CATALOG)) fail(`catalog not found at ${CATALOG}`);
const src = fs.readFileSync(CATALOG, 'utf8');

const abilities = [];
let m;
while ((m = CALL.exec(src)) !== null) {
  const stone = m[1].toLowerCase();
  const key = m[3];
  const catalogKey = `${stone}.${key}`;
  const role = ROLE_OF[catalogKey];
  if (!role) fail(`no role assigned for ${catalogKey} — add it to ROLE_OF`);
  if (!CONTROLS[m[6]]) fail(`unknown control ${m[6]} on ${catalogKey}`);

  const stoneMeta = STONES.find((s) => s.key === stone);
  if (!stoneMeta) fail(`unknown stone ${stone}`);

  abilities.push({
    stone,
    power: Number(m[2]),
    key,
    ref: catalogKey,
    name: unescapeJava(m[4]),
    desc: unescapeJava(m[5]),
    control: m[6],
    hint: unescapeJava(m[7]),
    role,
    /* Which abilities shipped before the catalog expansion. Useful as a
       filter: "what did this mod look like a version ago". */
    origin: Number(m[2]) <= stoneMeta.legacy ? 'original' : 'expanded',
  });
}

if (abilities.length < 100) fail(`only parsed ${abilities.length} abilities — the catalog shape probably changed`);

const seen = new Set();
for (const a of abilities) {
  if (seen.has(a.ref)) fail(`duplicate catalog key ${a.ref}`);
  seen.add(a.ref);
}

/* Warn on roles that no longer match anything, so the map does not rot. */
for (const ref of Object.keys(ROLE_OF)) {
  if (!seen.has(ref)) console.warn(`build-codex: ROLE_OF has stale key ${ref}`);
}

/* ── assemble ───────────────────────────────────────────────────────────── */

const stones = STONES.map((s) => {
  const mine = abilities.filter((a) => a.stone === s.key);
  const roles = {};
  for (const a of mine) roles[a.role] = (roles[a.role] ?? 0) + 1;
  const gaps = [];
  for (let i = 1; i <= Math.max(...mine.map((a) => a.power)); i++) {
    if (!mine.some((a) => a.power === i)) gaps.push(i);
  }
  return {
    key: s.key,
    id: s.id,
    name: s.name,
    lore: s.lore,
    domain: s.domain,
    summary: s.summary,
    reads: s.reads,
    color: THEME[s.key][0],
    color2: THEME[s.key][1],
    count: mine.length,
    original: mine.filter((a) => a.origin === 'original').length,
    roles,
    /* Retired IDs are never reassigned, so a hole in the sequence is real
       information about the mod's history rather than a parse error. */
    retired: gaps,
    signature: s.signature,
  };
});

const out = {
  generated: 'scripts/build-codex.cjs',
  source: 'Minefinity Gauntlet — StoneAbilityCatalog.java',
  mod: {
    id: 'minefinity_gauntlet',
    mc: '1.21.1',
    loader: 'NeoForge 21.1.65+',
    java: '21',
    requires: ['Minefinity Core', 'GeckoLib 4.9.2'],
  },
  controls: CONTROLS,
  roles: ROLES,
  stones,
  systems: SYSTEMS,
  abilities,
};

console.log(`build-codex: ${abilities.length} abilities across ${stones.length} stones`);
for (const s of stones) {
  console.log(
    `  ${s.key.padEnd(9)} ${String(s.count).padStart(3)}  ` +
      `${s.original} original  ${s.retired.length ? `retired ${s.retired.join(',')}` : ''}`
  );
}

if (DRY) {
  console.log('build-codex: --dry, nothing written');
} else {
  for (const [file, body] of [[OUT, out], [OUT_SERIES, SERIES]]) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(body, null, 1) + '\n', 'utf8');
    console.log(`build-codex: wrote ${path.relative(path.join(__dirname, '..'), file)}`);
  }
}
