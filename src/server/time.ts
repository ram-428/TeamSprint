/** Parses "1w 2d 3h 30m" (1w=5d, 1d=8h) → seconds. */
export function parseDuration(s: string): number | null {
  const re = /(\d+(?:\.\d+)?)\s*([wdhm])/gi; let m, total = 0, any = false;
  while ((m = re.exec(s))) { any = true; total += Number(m[1]) * { w: 144000, d: 28800, h: 3600, m: 60 }[m[2].toLowerCase() as 'w']; }
  return any && total > 0 ? Math.round(total) : null;
}

