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
    downloads: z.number(),
    categories: z.array(z.string()),
    curseforge: z.string().url(),
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
    features: z
      .array(z.object({ k: z.string(), t: z.string(), d: z.string() }))
      .default([]),
    /* Left empty on purpose — real loader/version data needed from you
       rather than guessed. Fill these and the download table lights up. */
    loaders: z.array(z.string()).default([]),
    mcVersions: z.array(z.string()).default([]),
  }),
});

export const collections = { mods };
