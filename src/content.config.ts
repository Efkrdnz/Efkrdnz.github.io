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

export const collections = { mods };
