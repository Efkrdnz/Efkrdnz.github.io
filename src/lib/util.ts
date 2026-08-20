/** Base-path-safe internal URL. Handles root user sites and project repos. */
export function url(path = '/'): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}` || '/';
}

/** 2300000 -> "2.3M". Used where the exact figure would be noise. */
export function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}

/** 2300000 -> "2,300,000". Used where the number is the point. */
export function full(n: number): string {
  return n.toLocaleString('en-US');
}

export const RARITY_ORDER = ['legendary', 'epic', 'rare', 'uncommon', 'common'] as const;
