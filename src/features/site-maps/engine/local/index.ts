/**
 * Neighbourhood maps (DB-19a): `localMapSvg` draws a stylised 4:3 map of the area around a house (countryside, coast or historic
 * centre) from a seed, and `localPlace` puts a point of interest («east, 400 m») where the map shows land. The maps are schemes
 * generated from the seed, not the real streets: the page that shows them says so.
 */
import type { Pt } from '../geometry';
import { DEG, hashStr, num } from '../numeric';
import { nextPrefix } from '../style';
import { drawCoast, drawCountry, drawHistoric, labelLayer, localCtx, type Drawn, type MapLabel } from './draw';
import { genCoast, type CoastData, type LocalGen } from './gen-coast';
import { genCountry, type CountryData } from './gen-country';
import { genHistoric, type HistoricData } from './gen-historic';
import { UH, UW, VY0, VY1 } from './shared';

export const LOCAL_KINDS = ['country', 'coast', 'historic'] as const;
export type LocalKind = (typeof LOCAL_KINDS)[number];
export type { MapLabel };

export interface LocalSpec {
  kind: LocalKind;
  /** Any stable text or number (the slug of the house): the same seed always gives the same map. */
  seed?: string | number;
  /** Width of the drawn area in metres: it converts the metres of `localPlace` into map units. */
  spanM?: number;
  /** Compass bearing of the sea on a `coast` map (0 = north, 90 = east, the default). */
  seaBearingDeg?: number;
}

interface ModelBase {
  isLand: (x: number, y: number) => boolean;
  inLandMargin: (x: number, y: number) => boolean;
  /** Rotation applied to the drawing, in degrees (only coast maps with a sea direction other than east). */
  rotDeg: number;
}
type LocalModel =
  | (ModelBase & { kind: 'coast'; d: CoastData })
  | (ModelBase & { kind: 'historic'; d: HistoricData })
  | (ModelBase & { kind: 'country'; d: CountryData });

/** Applies a function to every `[x, y]` pair of a data structure (arrays of two numbers are points, other numbers stay as they are). */
function mapPoints<T>(o: T, f: (p: Pt) => Pt): T {
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) {
      if (v.length === 2 && typeof v[0] === 'number' && typeof v[1] === 'number') return f([v[0], v[1]]);
      return v.map(walk);
    }
    if (v && typeof v === 'object') {
      const r: Record<string, unknown> = {};
      for (const k of Object.keys(v)) r[k] = walk((v as Record<string, unknown>)[k]);
      return r;
    }
    return v;
  };
  return walk(o) as T;
}

/** Rotation of the drawing that puts the sea (east in the generated drawing) at the given compass bearing; 0 when it is already there. */
function seaRotation(bearingDeg: number | undefined): number {
  if (bearingDeg == null || !Number.isFinite(bearingDeg)) return 0;
  const r = Math.round((((bearingDeg - 90) % 360) + 540) % 360) - 180;
  return Math.abs(r) < 1 ? 0 : r;
}

const LOCAL_CACHE = new Map<string, LocalModel>();

/** Model of a map (already flipped and rotated from the seed): the data is generated once. */
function localModel(kind: string, seed: string, seaBearingDeg: number | undefined): LocalModel {
  const k: LocalKind = (LOCAL_KINDS as readonly string[]).includes(kind) ? (kind as LocalKind) : 'country';
  const rotDeg = k === 'coast' ? seaRotation(seaBearingDeg) : 0;
  const key = `${k}|${seed}|${rotDeg}`;
  const hit = LOCAL_CACHE.get(key);
  if (hit) return hit;
  const h = hashStr(`flip|${k}|${seed}`);
  const fx = (h & 1) === 1 && k !== 'coast'; // the Adriatic is always east
  const fy = (h & 2) === 2;
  const flip = (p: Pt): Pt => [fx ? UW - p[0] : p[0], fy ? UH - p[1] : p[1]];
  const cosR = Math.cos(rotDeg * DEG);
  const sinR = Math.sin(rotDeg * DEG);
  const turn = (p: Pt, s: number): Pt => [50 + (p[0] - 50) * cosR - (p[1] - 50) * s * sinR, 50 + (p[0] - 50) * s * sinR + (p[1] - 50) * cosR];
  const fwd = (p: Pt): Pt => (rotDeg ? turn(flip(p), 1) : flip(p));
  const inv = (x: number, y: number): Pt => (rotDeg ? flip(turn([x, y], -1)) : flip([x, y]));
  const place = <D>(g: LocalGen<D>): { d: D } & ModelBase => ({
    d: mapPoints(g.data, fwd),
    isLand: (x, y) => g.land(...inv(x, y)),
    inLandMargin: (x, y) => g.margin(...inv(x, y)),
    rotDeg,
  });
  const model: LocalModel =
    k === 'coast'
      ? { kind: 'coast', ...place(genCoast(seed, rotDeg !== 0)) }
      : k === 'historic'
        ? { kind: 'historic', ...place(genHistoric(seed)) }
        : { kind: 'country', ...place(genCountry(seed)) };
  LOCAL_CACHE.set(key, model);
  if (LOCAL_CACHE.size > 32) {
    const oldest = LOCAL_CACHE.keys().next();
    if (!oldest.done) LOCAL_CACHE.delete(oldest.value);
  }
  return model;
}

function drawModel(m: LocalModel, c: ReturnType<typeof localCtx>, id: string): Drawn {
  if (m.kind === 'coast') return drawCoast(m.d, m.rotDeg, c, id);
  if (m.kind === 'historic') return drawHistoric(m.d, c, id);
  return drawCountry(m.d, c, id);
}

/**
 * Map of the neighbourhood (stylised, 4:3): viewBox `0 0 width width*0.75`; the house is at 50 %, 50 %.
 * labels: [{ text, x, y }] with x, y in percent of the frame (light halo, like the regional maps).
 */
export function localMapSvg(spec: LocalSpec & { width?: number; labels?: readonly MapLabel[] }): string {
  const { kind, seed = 1, width = 800, labels = [], seaBearingDeg } = spec;
  const m = localModel(kind, String(seed), seaBearingDeg);
  const c = localCtx(width);
  const id = nextPrefix();
  const { defs, out } = drawModel(m, c, id);
  defs.push(
    `<filter id="${id}n" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="${hashStr(String(seed)) % 90}" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 .36  0 0 0 0 .29  0 0 0 0 .19  1.1 1.1 1.1 0 -1.52"/></filter>`,
  );
  out.push(`<rect width="${num(c.W)}" height="${num(c.H)}" filter="url(#${id}n)" opacity=".11"/>`);
  out.push(labelLayer(labels, c));
  return `<svg class="sm-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${num(c.W)} ${num(c.H, 2)}" preserveAspectRatio="xMidYMid slice" role="presentation" aria-hidden="true" focusable="false"><defs>${defs.join('')}</defs>${out.join('')}</svg>`;
}

/**
 * Position (percent of the frame, house at 50, 50) of a point of interest `distM` metres away towards `bearingDeg`
 * (0 = north, 90 = east). The point is snapped: always on land and, when possible, on a street.
 */
export function localPlace({ kind, seed = 1, spanM = 1500, seaBearingDeg }: LocalSpec, { bearingDeg = 0, distM = 0 }: { bearingDeg?: number; distM?: number } = {}): { x: number; y: number } {
  const m = localModel(kind, String(seed), seaBearingDeg);
  const unitM = (spanM > 0 ? spanM : 1500) / UW; // metres per drawing unit
  const rad = (Number.isFinite(bearingDeg) ? bearingDeg : 0) * DEG;
  const dist = Number.isFinite(distM) && distM > 0 ? distM : 0;
  const dx = (Math.sin(rad) * dist) / unitM;
  const dy = (-Math.cos(rad) * dist) / unitM;
  if (Math.hypot(dx, dy) < 0.5) return { x: 50, y: 50 };
  // stays inside the frame (margin of 5 units) along the same direction
  let t = 1;
  if (dx > 0) t = Math.min(t, (95 - 50) / dx);
  else if (dx < 0) t = Math.min(t, (5 - 50) / dx);
  if (dy > 0) t = Math.min(t, (VY1 - 5 - 50) / dy);
  else if (dy < 0) t = Math.min(t, (VY0 + 5 - 50) / dy);
  // if it falls into the sea, walks back towards the house until there is land with some margin from the cliff
  while (t > 0 && !m.inLandMargin(50 + dx * t, 50 + dy * t)) t -= 0.01;
  let p: Pt = [50 + dx * Math.max(0, t), 50 + dy * Math.max(0, t)];
  // snaps to the nearest street or alley
  let best: Pt | null = null;
  let bd = 3.4;
  for (const s of m.d.streets) {
    if (s[1] < VY0 + 2 || s[1] > VY1 - 2 || s[0] < 2 || s[0] > UW - 2) continue;
    const dd = Math.hypot(s[0] - p[0], s[1] - p[1]);
    if (dd < bd && m.isLand(s[0], s[1])) {
      bd = dd;
      best = s;
    }
  }
  if (best) p = best;
  return { x: Math.round(p[0] * 100) / 100, y: Math.round(((p[1] - VY0) / (VY1 - VY0)) * 10000) / 100 };
}
