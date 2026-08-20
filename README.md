# efkrdnzz — mod portfolio

Static site for the Minecraft mods of efkrdnzz. Astro + MDX, built to deploy to
GitHub Pages with no server, no database, and no build-time secrets.

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # -> dist/
npm run preview  # serve the built output
```

## How it is put together

One neutral shell, re-skinned per mod. `src/styles/global.css` holds the
skeleton — spacing scale, type scale, component geometry — and never changes.
`src/styles/themes.css` redefines only surface tokens behind a
`[data-mod="<key>"]` attribute that each mod page stamps onto `<html>`.

That means a mod page can look completely different without any new components,
and adding a mod later touches two files.

### Adding a mod

1. Drop a markdown file in `src/content/mods/`. The filename becomes the URL:
   `efks-triple-jump.md` → `/mods/efks-triple-jump`.
2. Fill the frontmatter. The schema in `src/content.config.ts` is enforced at
   build time, so a typo fails the build rather than shipping a broken page.

```yaml
---
title: "Efk's Triple Jump"
short: "Triple Jump"          # used in nav and buttons
tagline: "Two more than you had."   # the tooltip lore line
blurb: "A second and third jump mid-air."
theme: "efk"                  # a key from themes.css
rarity: "rare"                # common | uncommon | rare | epic | legendary
kind: "mod"                   # mod | modpack
downloads: 3700
categories: ["Miscellaneous", "Utility & QoL"]
curseforge: "https://www.curseforge.com/minecraft/mc-mods/..."
order: 5                      # sort position, lowest first
---
```

Optional: `modrinth`, `author` + `role: contributor` for collaborations,
`features` (a list of `k` / `t` / `d`) to render the systems grid,
`loaders` and `mcVersions` once that data is confirmed, `series` to place the
mod in a family on the home page, and `hasGuide` / `hasCodex` to open its wiki.

### Guides and codices

A mod's wiki takes one of two shapes, and a mod has one or the other:

- **A guide** (`hasGuide: true`, at `/mods/<slug>/guide`) is a route *through* a
  mod — do this, then this. Solo Leveling: Reawakening has one.
- **A codex** (`hasCodex: true`, at `/mods/<slug>/codex`) is a database *of* a
  mod — every entry, filterable, with no path through it. Minefinity Gauntlet
  has one, because 150 stone abilities are a table, not a journey.

The mod hub advertises whichever exists and falls back to a `SOON` label.

#### The Minefinity codex

`src/data/codex/minefinity-gauntlet.json` is generated, not hand-written:

```bash
node scripts/build-codex.cjs "E:/minecraft mods"
```

The script parses `StoneAbilityCatalog.java` out of the mod source, so names,
descriptions, control contracts and the stable `(stoneId, powerId)` pairs come
from the thing the server actually validates against. Stone lore, the role each
ability plays, and the series copy live in the script as authored content keyed
by the same IDs; an ability with no role assigned fails the build rather than
landing in a default bucket. It also writes `src/data/series/minefinity.json`,
which the home page reads for the series section.

Re-run it after any catalog change. The mod path defaults to
`E:/minecraft mods`; pass `--dry` to see the counts without writing.

### Adding a theme

Add one block to `src/styles/themes.css`:

```css
[data-mod='yourkey'] {
  --page-bg: #0E1113;
  --panel: #161A1D;
  --edge: #2B3337;
  --edge-dim: #1F262A;
  --panel-edge: #232A2E;
  --accent: #8FB8A8;
  --accent-hi: #ACD0C1;
  --bone: #E5E8E6;
  --ash: #929C9D;
  --ash-dim: #7C8586;
  --glow: rgba(143, 184, 168, 0.1);
}
```

Every existing theme clears WCAG AA (4.5:1) on small text. If you change
`--ash-dim` or `--ash`, re-check contrast against both `--page-bg` and
`--panel` — `--panel` is usually the harder of the two.

## Design rules worth keeping

- **Rarity is data, not decoration.** The colour on a mod card comes from its
  download tier. Do not assign it by taste.
- **Copper is the only decorative accent** in the shell. Everything else earns
  its colour semantically.
- **No dead links.** Sections that do not exist yet render as `SOON` labels,
  not links to 404s.

## Deploying

`.github/workflows/deploy.yml` builds on every push to `main` and publishes via
`actions/deploy-pages`. In the repo, set **Settings → Pages → Source** to
**GitHub Actions** once.

The deploy target lives in two constants at the top of `astro.config.mjs`:

```js
const SITE = 'https://<username>.github.io';
const BASE = '/';        // '/reponame' for a project repo
```

Root user site (repo named `<username>.github.io`) needs no base path. A project
repo needs `BASE` set to `/reponame`, and every internal link already routes
through `url()` in `src/lib/util.ts`, so that one constant covers the whole site.

`public/.nojekyll` must stay — without it GitHub strips the `_astro/` folder and
the site loads unstyled.

## Not built yet

- **Wikis for the rest of the shelf.** Solo Leveling: Reawakening has a guide
  and Minefinity Gauntlet has a codex; every other mod hub still links to
  `/mods/<slug>/guide` as `SOON`.
- **Changelogs** at `/mods/<slug>/changelog`.
- **Loader and MC version data.** Left empty on purpose rather than guessed —
  fill `loaders` and `mcVersions` in frontmatter and the download line picks
  them up automatically.
- **Screenshots.** No mod art is committed yet.
- **Live download counts.** Currently static numbers in frontmatter. The plan is
  a scheduled Action that writes `public/data/stats.json`.
