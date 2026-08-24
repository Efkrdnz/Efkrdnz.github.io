import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const mods = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/mods' }),
  schema: z.object({
    title: z.string(),
    short: z.string(),
    tagline: z.string(),
    blurb: z.string(),
    theme: z.string().default('default'),
    rarity: z.enum(['common', 'uncommon', 'rare', 'epic', 'legendary']),
    kind: z.enum(['mod', 'modpack']),
    /* Absent until a mod ships. A project in development has no download
       count and no store page, and inventing either would be a lie the whole
       shelf is sorted by. Enforced below: released implies both. */
    status: z.enum(['released', 'dev']).default('released'),
    downloads: z.number().optional(),
    categories: z.array(z.string()),
    curseforge: z.string().url().optional(),
    modrinth: z.string().url().optional(),
    modrinthDownloads: z.number().optional(),
    /* Set on projects efkrdnzz did not author. Describes the actual
       relationship rather than flattening everything to "contributor". */
    note: z.string().optional(),
    author: z.string().default('efkrdnzz'),
    role: z.enum(['author', 'contributor']).default('author'),
    featured: z.boolean().default(false),
    order: z.number().default(50),
    hasGuide: z.boolean().default(false),
    /* A codex is the other shape a wiki can take: a searchable database of
       one mod's own data rather than a route through it. A mod has one or
       the other, not both — they answer different questions. */
    hasCodex: z.boolean().default(false),
    /* The third shape a wiki takes: a moveset. Not a route through the mod
       and not a database of it — a reference you read by suit. */
    hasManual: z.boolean().default(false),
    /* Set when a mod belongs to a family that shares a library. Drives the
       series band on the home page; unset mods are unaffected. */
    series: z.string().optional(),
    /* Somebody else covered this mod. Only outward-facing coverage belongs
       here — a platform, a channel, a publication — never efkrdnzz's own
       posts, which would make the credential meaningless. Link the canonical
       post on the outlet's real domain, not a mirror or a share link. */
    press: z
      .array(
        z.object({
          outlet: z.string(),
          /* What the coverage physically is: "Instagram reel", "video". */
          kind: z.string(),
          url: z.string().url(),
          /* Optional, and left unset rather than guessed. */
          date: z.string().optional(),
          note: z.string().optional(),
        })
      )
      .default([]),
    features: z
      .array(z.object({ k: z.string(), t: z.string(), d: z.string() }))
      .default([]),
    /* Left empty on purpose — real loader/version data needed from you
       rather than guessed. Fill these and the download table lights up. */
    loaders: z.array(z.string()).default([]),
    mcVersions: z.array(z.string()).default([]),
  })
    /* A released mod without a store page or a download count would render a
       broken card and skew the totals, so the build refuses it rather than
       shipping a zero. */
    .superRefine((d, ctx) => {
      if (d.status !== 'released') return;
      if (!d.curseforge)
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['curseforge'],
          message: 'a released mod needs its CurseForge URL' });
      if (d.downloads === undefined)
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['downloads'],
          message: 'a released mod needs its download count' });
    }),
});

/* Community addons. Somebody else's work that extends one of these mods, so
   the shape deliberately differs from a mod: it leads with the author and the
   mod it plugs into, and carries no download count. Ranking a brand-new
   community addon by downloads against a 2M-download mod tells the reader
   nothing useful and discourages the next person from building one. */
const addons = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/addons' }),
  schema: z.object({
    title: z.string(),
    /* Whose work this is. May be efkrdnzz for a first-party addon. */
    author: z.string(),
    authorUrl: z.string().url().optional(),
    /* Who stands behind it. "official" is efkrdnzz's own; "partnered" is
       somebody else's that he vouches for; "community" is listed without
       any claim either way. */
    tier: z.enum(['official', 'partnered', 'community']).default('community'),
    /* Unreleased addons are listed without a download, so the store link is
       optional and the refinement below enforces it once released. */
    release: z.enum(['released', 'upcoming']).default('released'),
    /* The slug in src/content/mods that this addon extends. */
    forMod: z.string(),
    tagline: z.string(),
    blurb: z.string(),
    curseforge: z.string().url().optional(),
    modrinth: z.string().url().optional(),
    loaders: z.array(z.string()).default([]),
    mcVersions: z.array(z.string()).default([]),
    /* Optional extras the addon itself asks for, beyond the parent mod. */
    alsoNeeds: z.array(z.string()).default([]),
    /* A branch note when the addon does not target the mod's current branch. */
    caveat: z.string().optional(),
    /* Config keys worth documenting, shown on the addon's Vault page. */
    config: z
      .array(z.object({ key: z.string(), value: z.string(), meaning: z.string() }))
      .default([]),
    /* Commands the addon adds, same treatment. */
    commands: z
      .array(z.object({ cmd: z.string(), does: z.string() }))
      .default([]),
    /* Longer prose for the Vault page; the card stays short. */
    detail: z
      .array(z.object({ heading: z.string(), body: z.string() }))
      .default([]),
    order: z.number().default(50),
  })
    /* A released addon with no store link would render a card nobody can act
       on, so the build refuses it rather than shipping a dead end. */
    .superRefine((a, ctx) => {
      if (a.release === 'released' && !a.curseforge)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['curseforge'],
          message: 'a released addon needs its CurseForge URL',
        });
    }),
});

export const collections = { mods, addons };
