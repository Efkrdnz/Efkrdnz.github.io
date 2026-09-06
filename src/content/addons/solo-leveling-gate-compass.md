---
title: "Solo Leveling: Gate Compass"
author: "GoldMaster_CZ"
authorUrl: "https://www.curseforge.com/members/GoldMaster_CZ/projects"
tier: "community"
release: "released"
forMod: "solo-leveling-reawakening"
tagline: "Stop sweeping the horizon for a gate you already found"
blurb: "A compass band on the HUD that marks every gate it knows about by its true bearing and rank, with the distance in blocks once you turn to face one. It keeps tracking gates after they fall outside render distance, so going back to one stops being a search."
curseforge: "https://www.curseforge.com/minecraft/mc-mods/solo-leveling-gate-compass"
loaders: ["NeoForge"]
mcVersions: ["1.21.1"]
alsoNeeds:
  - "NeoForge 21.1+ and Java 21"
caveat: "Needs SLR 1.3.1. First release — a Secretary NPC, a Gate Tracker item and an Immersive Mode are listed as planned, not shipped."
detail:
  - heading: "What sits on the HUD"
    body: "A compass band carrying the eight headings — N, NE, E, SE, S, SW, W, NW — that turns with you the way a vanilla compass does.\n\nEvery [[gates|gate]] it knows about gets a marker at the gate's real bearing, showing its [[gate-ranks|rank]]: E, D, C, B, A, S, or Red. Turn to face one and its current distance in blocks appears underneath the marker. Several show at once, each in its own direction."
  - heading: "It remembers gates you can no longer see"
    body: "Gates are picked up both from the world itself and from SLR's own announcements, and they stay tracked once they drop outside render distance.\n\nThat is the part that changes how you play. A gate you spotted and walked away from is still a marker on the band an hour later, instead of a rough memory of which direction you came from — which matters most for the ranks you are not yet strong enough to enter."
  - heading: "Press I to lay it out"
    body: "Settings open in-game on **I**: size, width, vertical position, horizontal position, opacity, how much of the arc stays visible, and whether it shows at all.\n\nChanges apply the moment you make them, so you can fit it around whatever else is already on your screen without leaving the world."
  - heading: "It leaves SLR alone"
    body: "The mod draws a HUD element and stops there. None of SLR's existing menus are replaced or modified, so it stacks with anything else competing for screen space."
order: 12
---
