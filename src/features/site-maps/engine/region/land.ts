/**
 * Where there is land (DB-19a): tests on the level of detail of the base, in km. Used to pull a position that fell into the sea
 * (a house rounded to about 1 km, a coastal town of 1:10 000 000 data) back to the nearest shore.
 */
import { pip, type Pt } from '../geometry';
import type { GeoLod, Shape } from './model';

/** How far inside the shore a moved position is put (km). */
const INSET_KM = 0.12;

const inside = (s: Shape, p: Pt): boolean => p[0] >= s.box[0] && p[0] <= s.box[2] && p[1] >= s.box[1] && p[1] <= s.box[3] && pip(s.k, p[0], p[1]);

interface Hit {
  d: number;
  /** The nearest point of the edge. */
  c: Pt;
}

function nearestOnEdges(s: Shape, p: Pt, within: number): Hit | null {
  const [x0, y0, x1, y1] = s.box;
  if (p[0] < x0 - within || p[0] > x1 + within || p[1] < y0 - within || p[1] > y1 + within) return null;
  let best: Hit | null = null;
  const k = s.k;
  for (let i = 0, j = k.length - 1; i < k.length; j = i++) {
    const a = k[j];
    const b = k[i];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
    const c: Pt = [a[0] + t * dx, a[1] + t * dy];
    const d = Math.hypot(p[0] - c[0], p[1] - c[1]);
    if (!best || d < best.d) best = { d, c };
  }
  return best && best.d <= within ? best : null;
}

/** Past the shore, `INSET_KM` further along the direction from the point to the shore. */
const pastShore = (p: Pt, hit: Hit): Pt => {
  const d = hit.d || 1;
  return [hit.c[0] + ((hit.c[0] - p[0]) / d) * INSET_KM, hit.c[1] + ((hit.c[1] - p[1]) / d) * INSET_KM];
};

/**
 * The position on land: unchanged when it already is (or when no shore is within `maxKm`); a point in the sea goes in to the
 * nearest coast, a point in a lake out to the nearest shore.
 */
export function snapKm(lod: GeoLod, p: Pt, maxKm: number): Pt {
  const lake = lod.lakes.find((r) => inside(r, p));
  if (lake) {
    const hit = nearestOnEdges(lake, p, maxKm);
    return hit ? pastShore(p, hit) : p;
  }
  if (lod.land.some((r) => inside(r, p))) return p;
  let best: Hit | null = null;
  for (const r of lod.land) {
    const hit = nearestOnEdges(r, p, maxKm);
    if (hit && (!best || hit.d < best.d)) best = hit;
  }
  return best ? pastShore(p, best) : p;
}
