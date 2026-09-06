---
title: "SLR: Forgeworks"
author: "MikaHa"
authorUrl: "https://www.curseforge.com/members/MikaHa/projects"
tier: "community"
release: "released"
forMod: "solo-leveling-reawakening"
tagline: "Magic beasts start dropping something worth carrying home"
blurb: "Turns kills into materials and materials into gear. Six ranked drop types come off beasts by creature family, and six workstations — four of them wired into a shared mana grid — cut, forge and assemble those drops into crystal alloy weapons and armour that pass vanilla from D-rank up."
curseforge: "https://www.curseforge.com/minecraft/mc-mods/slr-forgeworks"
loaders: ["NeoForge"]
mcVersions: ["1.21.1"]
alsoNeeds:
  - "GeckoLib, required"
  - "JEI, optional — a recipe page per station"
  - "JER, optional — which beasts drop what, at which rank, at what odds"
caveat: "Needs SLR 1.3.1+. The author is explicit that the balance numbers are still test data — see the last section."
detail:
  - heading: "Six materials, ranked like whatever dropped them"
    body: "Wolves give hide and fangs, skeletons bone, golems gem shards, demons horn, and carapace comes off the rest.\n\nA drop carries the [[ranks|rank]] of the mob that dropped it, E through S, and the chance halves with every rank you climb. So S-rank material is scarce because the roll is scarce, not because the mob is — hunting up-rank is the only way to get it. All of it is overridable by datapack."
  - heading: "Six stations and a power grid"
    body: "**Mana Pylon** banks the charge out of [[mana-crystals|mana crystals]]. **Forge** melts a crystal and a metal into crystal alloy ingot. **Gem Cutting Station** cuts gem shards into blades. **Mana Anvil** shapes ingots into parts, then assembles parts into finished weapons and armour.\n\nThose four run on mana and share one pool, drawn between the blocks as crystal conduits. A pylon keeps its charge if you break it and put it back. One S-rank crystal is worth thirty-two E-rank ones, so the grid is where rank actually pays.\n\n**Bonecutting Station** and **Leatherworking Station** run off a Processing Knife instead of mana — bone, fang, horn and carapace into parts and plating, hide into armour lining."
  - heading: "The metal climbs with the rank"
    body: "Iron at the low end, gold at **B**, diamond at **A**, netherite at **S** — and what comes out is a veined alloy rather than the metal you put in.\n\nE-rank already beats iron. D matches diamond, C passes netherite, and B upward is past anything vanilla offers. Armour changes colour with both rank and metal, so you can read someone's tier off their chestplate."
  - heading: "What a set costs"
    body: "Boots 4 pieces, helmet 5, leggings 7, chestplate 8 — with hide lining on top of each.\n\nThe Processing Knife is a stick and a crystal. Stencils — sword blades, dagger blades, handles, lining, and one per armour piece — are reusable and never consumed, so the cost is the materials rather than the tooling."
  - heading: "The author says it is not balanced yet"
    body: "Worth reading before you build a server progression around it.\n\nAround fifty item textures are still placeholders with the rank letter printed on them, and every number — drop rates, craft times, mana costs, knife durability — is test data. He points out himself that the crystal alloy route currently costs less than going through material drops, which is backwards and will change. Hunter bows are in the jar but only reachable by command.\n\nBefore 1.0 he wants materials to carry distinct properties, so that a horn and a fang stop being interchangeable."
order: 11
---
