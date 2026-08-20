import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

/* ──────────────────────────────────────────────────────────────
   DEPLOY TARGET — the only lines to change for GitHub Pages.

   Root user site   repo named "<username>.github.io"
     SITE = 'https://<username>.github.io'      BASE = '/'

   Project repo     repo named e.g. "portfolio"
     SITE = 'https://<username>.github.io'      BASE = '/portfolio'

   Custom domain    CNAME file in public/
     SITE = 'https://your-domain.tld'           BASE = '/'
   ────────────────────────────────────────────────────────────── */
const SITE = 'https://efkrdnz.github.io';
const BASE = '/';

export default defineConfig({
  site: SITE,
  base: BASE,
  trailingSlash: 'ignore',
  integrations: [mdx(), sitemap()],
  build: { format: 'directory' },
});
