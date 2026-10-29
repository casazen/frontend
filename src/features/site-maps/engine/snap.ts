/**
 * Pins on land (DB-19a): the position of a house is rounded to about 1 km, so near the sea it may fall into the water on the map.
 * `snapToLand` moves such a position to the nearest land (or shore of a lake) within a short distance and leaves it alone
 * otherwise. The area of a house is approximate by declaration; this only keeps the pin from looking absurd. It works on the
 * finest level of the data whatever the view, so a pin does not jump when the map is zoomed.
 */
import { pip, type Pt } from './geometry';
import { geoBase } from './region/registry';
import type { Shape } from './region/model';
import { publicPoint, toKm, type LatLon, LAT_KM, LON_KM, ORIGIN_LAT, ORIGIN_LON } from './view';

const INSET_KM = 0.12; // how far inside the shore the pin is put

interface Hit {
  d: number;
  /** The nearest point of the edge. */
  c: Pt;
}

function nearestOnEdges(ring: Shape, p: Pt, within: number): Hit | null {
  const [x0, y0, x1, y1] = ring.box;
  if (p[0] < x0 - within || p[0] > x1 + within || p[1] < y0 - within || p[1] > y1 + within) return null;
  let best: Hit | null = null;
  const k = ring.k;
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

const insideShape = (ring: Shape, p: Pt): boolean => p[0] >= ring.box[0] && p[0] <= ring.box[2] && p[1] >= ring.box[1] && p[1] <= ring.box[3] && pip(ring.k, p[0], p[1]);

/**
 * The position moved to land: unchanged when it already is on land or when no shore is within `maxKm`. The position is a
 * position of a house, so two decimals at most (see `publicPoint`); the result may have more, it is only for drawing.
 */
export function snapToLand(point: LatLon, { maxKm = 1.5 }: { maxKm?: number } = {}): LatLon {
  const base = geoBase();
  const given = publicPoint(point);
  if (!base) return given;
  const lod = base.lods[base.lods.length - 1];
  const p = toKm(given.lat, given.lon);
  const lake = lod.lakes.find((r) => insideShape(r, p));
  const onLand = lod.land.some((r) => insideShape(r, p));
  let target: Pt | null = null;
  if (lake) {
    // in a lake: out to the nearest shore
    const hit = nearestOnEdges(lake, p, maxKm);
    if (hit) target = [hit.c[0] + ((hit.c[0] - p[0]) / (hit.d || 1)) * INSET_KM, hit.c[1] + ((hit.c[1] - p[1]) / (hit.d || 1)) * INSET_KM];
  } else if (!onLand) {
    // in the sea: in to the nearest coast
    let best: Hit | null = null;
    for (const r of lod.land) {
      const hit = nearestOnEdges(r, p, maxKm);
      if (hit && (!best || hit.d < best.d)) best = hit;
    }
    if (best) target = [best.c[0] + ((best.c[0] - p[0]) / (best.d || 1)) * INSET_KM, best.c[1] + ((best.c[1] - p[1]) / (best.d || 1)) * INSET_KM];
  }
  if (!target) return given;
  const round3 = (v: number): number => Math.round(v * 1000) / 1000;
  return { lat: round3(ORIGIN_LAT + target[1] / LAT_KM), lon: round3(ORIGIN_LON + target[0] / LON_KM) };
}
