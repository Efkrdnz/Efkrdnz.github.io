---
title: "SoloCraft: Dungeon Expansion"
author: "saruki"
authorUrl: "https://www.curseforge.com/members/saruki/projects"
tier: "community"
release: "released"
forMod: "solo-leveling-reawakening"
tagline: "Forty-one dungeons, and a campaign you are not meant to finish clean"
blurb: "A content pack the size of a second mod: 41 dungeons across every gate rank, 219 custom creatures, and a 56-step campaign paying out a fixed number of skill points — fewer than it costs to buy everything. Guild standing, Jeju Island and crystal cutting sit on top of SLR's own systems rather than replacing them."
curseforge: "https://www.curseforge.com/minecraft/mc-mods/solocraft-dungeon-expansion"
loaders: ["NeoForge"]
mcVersions: ["1.21.1"]
alsoNeeds:
  - "GeckoLib 4.9.2 or newer, required"
  - "NeoForge 21.1.244 or newer"
caveat: "Built against SLR 1.3.x on the 1.21.1 NeoForge branch. English only so far."
detail:
  - heading: "What forty-one dungeons actually means"
    body: "Six each at E, D, C and B, eight at A and nine at S, spawning through [[gates|SLR's own gate system]] rather than beside it.\n\nOn top of the ranked set sit three one-off places: the Double Dungeon underneath the world, Jeju Island, and guild halls that build themselves. Five are [[red-gates|red gates]], each carrying its own modifier — Blood Moon Forest, The Abyssal Prison, Infernal Warzone, Storm Highway, and the Throne of the Fallen Monarch.\n\nThe bestiary is 219 creatures: **42 bosses**, 17 mini-bosses and 44 elites, with 1,990 animation clips across 492 room structures and 175 sounds, none of them borrowed."
  - heading: "The campaign is finite on purpose"
    body: "56 steps across nine chapters. Each pays System points and exactly one skill point, and only 56 exist in the world — there is no way to grind more.\n\nSixteen of them refuse to be settled by kill count. Clear A-rank gates without summoning a single shadow. Pull six mana crystals out of one dungeon. Survive two minutes on Jeju with the King awake. Enter a gate another guild has already booked. Take a whole dungeon on the army alone."
  - heading: "You will not max the ladder"
    body: "Five skills, five levels each: **Vitality**, **Ferocity**, **Haste**, **Dominion** and **Fortune**.\n\nThe full ladder costs more than the entire campaign pays out, so finishing everything still leaves something unbought. That is the design rather than a shortfall — the build you end on is a choice you were forced to make.\n\nDominion raises the quality of what you [[shadow-extraction|raise]]. Fortune pays out when you cut crystals."
  - heading: "Guilds can stop helping you"
    body: "Five [[guilds]] hold roughly a third of the gates between them, and walking into one they have booked costs you standing with them.\n\nRun it far enough down and their hunters stop assisting you, then turn hostile outright. The Hunters Association posts daily directives that buy the goodwill back. Guild halls staff themselves as you go."
  - heading: "Jeju does not exist until Beru does"
    body: "The island stays closed until a Beru gate ruptures.\n\nIt is a hollow volcano: a vent down from the crater, a spiral ramp, three rings of galleries. It stays open until the place is cleared, and only killing the King stops things coming back."
  - heading: "Crystals, runes and artifacts"
    body: "[[mana-crystals|Mana crystals]] grow into the dungeon walls. Pulling one takes two seconds of holding still, and anything can interrupt it.\n\nSeven runes come off crystals and bosses between them. Four artifact sets work straight out of your bag without ever taking an inventory slot."
  - heading: "Turn any of it off"
    body: "42 game rules live in `config/slrdungeons-common.toml`.\n\nDungeon breaks, guild claims, Jeju, private scenes, the skill ladder, boss endings and mana crystals each switch off on their own, and health, damage, drop rates and the red gate modifiers are numbers you set. Running the dungeons without the campaign is a supported way to play it."
  - heading: "None of it is SLR's code"
    body: "The jar carries zero entries from SLR's namespace — no borrowed code, no borrowed assets. It hooks into gate spawning, levelling, nameplates and the shadow roster from outside rather than editing them.\n\nWhich is also why SLR has to be installed. On its own the pack does nothing."
order: 10
---
