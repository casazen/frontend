/**
 * The map data the engine has been given (DB-19a): the national base and the detail packs. The data files are loaded on demand
 * by `loadRegionData` (src/features/site-maps/load.ts), which hands them to the functions here; drawing never fetches anything.
 */
import { sampleCurve, type Pt } from '../geometry';
import { clamp, rngOf, slug } from '../numeric';
import { toKm } from '../view';
import type { BaseTown, DetailPack, GeoBase, GeoLod, GeoName, RawItaly, RawLod, RawName, RawShape, Shape } from './model';

/* ----- decoding of the generated file ----- */

function decodeShape(raw: RawShape, u: number): Shape {
  const k: Pt[] = [];
  let lat = raw[0];
  let lon = raw[1];
  k.push(toKm(lat / u, lon / u));
  for (let i = 2; i + 1 < raw.length; i += 2) {
    lat += raw[i];
    lon += raw[i + 1];
    k.push(toKm(lat / u, lon / u));
  }
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of k) {
    x0 = Math.min(x0, p[0]);
    x1 = Math.max(x1, p[0]);
    y0 = Math.min(y0, p[1]);
    y1 = Math.max(y1, p[1]);
  }
  return { k, box: [x0, y0, x1, y1] };
}

function decodeLod(raw: RawLod): GeoLod {
  const dec = (list: RawShape[]): Shape[] => list.map((s) => decodeShape(s, raw.u));
  return { land: dec(raw.land), italy: dec(raw.italy), lakes: dec(raw.lakes), borders: dec(raw.borders) };
}

function decodeNames(list: RawName[], d: { size: number; ls: number; min: number; max: number }): GeoName[] {
  return list.map((n) => ({
    text: n.n,
    lat: n.a / 1000,
    lon: n.o / 1000,
    size: n.s ?? d.size,
    ls: n.l ?? d.ls,
    min: n.m ?? d.min,
    max: n.x ?? d.max,
    ...(n.r ? { rot: n.r } : {}),
  }));
}

export function decodeItaly(raw: RawItaly): GeoBase {
  const towns: BaseTown[] = raw.towns.map(([name, la, lo, tier, pop]) => ({ id: slug(name), name, lat: la / 1000, lon: lo / 1000, tier, pop: pop * 1000 }));
  return {
    lods: raw.lods.map(decodeLod),
    tol: raw.tol,
    towns,
    regions: decodeNames(raw.regions, { size: 10, ls: 4, min: 90, max: 2000 }),
    seas: decodeNames(raw.seas, { size: 12, ls: 2.2, min: 120, max: 2000 }),
    countries: decodeNames(raw.countries, { size: 9.5, ls: 4, min: 400, max: 2000 }),
  };
}

/* ----- what has been loaded ----- */

let base: GeoBase | null = null;
const packs = new Map<string, DetailPack>();
let version = 0;

export function installBase(raw: RawItaly): void {
  base = decodeItaly(raw);
  version++;
}
export function installPack(pack: DetailPack): void {
  packs.set(pack.id, pack);
  version++;
}
export const hasBase = (): boolean => base !== null;
export const hasPack = (id: string): boolean => packs.has(id);
export const geoVersion = (): number => version;
export const geoBase = (): GeoBase | null => base;
export const geoPacks = (): DetailPack[] => [...packs.values()];

/* ----- the world of the renderer: base and packs merged, in km ----- */

export interface WorldTown {
  id: string;
  name: string;
  lat: number;
  lon: number;
  tier: 1 | 2 | 3;
  /** Position in km. */
  k: Pt;
  /** Radius in km of the built-up area. */
  foot: number;
}
export interface World {
  base: GeoBase | null;
  towns: WorldTown[];
  byKey: Map<string, WorldTown>;
  roads: { c: number; pts: Pt[] }[];
  rails: Pt[][];
  lakes: Pt[][];
  packs: DetailPack[];
}

const TOWN_DEDUPE_KM = 4;
let cache: { v: number; world: World } | null = null;

/** The merged world, rebuilt only when something has been loaded since the last call. */
export function getWorld(): World {
  if (cache && cache.v === version) return cache.world;
  const list = geoPacks();
  const towns: WorldTown[] = [];
  for (const pack of list) {
    for (const t of pack.towns) towns.push({ id: t.id, name: t.name, lat: t.lat, lon: t.lon, tier: t.tier, k: toKm(t.lat, t.lon), foot: pack.foot[t.id] ?? (t.tier === 3 ? 0.7 : 1) });
  }
  const own = towns.length;
  for (const t of base?.towns ?? []) {
    const k = toKm(t.lat, t.lon);
    let dup = false;
    for (let i = 0; i < own && !dup; i++) dup = towns[i].id === t.id || Math.hypot(towns[i].k[0] - k[0], towns[i].k[1] - k[1]) < TOWN_DEDUPE_KM;
    if (!dup) towns.push({ id: t.id, name: t.name, lat: t.lat, lon: t.lon, tier: t.tier, k, foot: clamp(0.011 * Math.sqrt(t.pop), 0.35, 12) });
  }
  const byKey = new Map<string, WorldTown>();
  for (const t of towns) {
    byKey.set(t.id, t);
    byKey.set(slug(t.name), t);
  }
  const pointOf = (pack: DetailPack, q: string | [number, number]): Pt => {
    if (typeof q !== 'string') return toKm(q[0], q[1]);
    const t = byKey.get(q);
    if (t) return t.k;
    const place = [...pack.stations, ...pack.airports].find((s) => s.id === q);
    return place ? toKm(place.lat, place.lon) : [0, 0];
  };
  const roads: World['roads'] = [];
  const rails: Pt[][] = [];
  const lakes: Pt[][] = [];
  for (const pack of list) {
    pack.roads.forEach((def, k) => {
      const raw = def.p.map((q) => pointOf(pack, q));
      const rnd = rngOf('road', k);
      const pts: Pt[] = [raw[0]];
      for (let i = 1; i < raw.length; i++) {
        const a = raw[i - 1];
        const b = raw[i];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const nIns = len > 22 ? 3 : len > 9 ? 2 : len > 4 ? 1 : 0;
        for (let m = 1; m <= nIns; m++) {
          const f = m / (nIns + 1);
          const o = (rnd() - 0.5) * len * 0.07;
          pts.push([a[0] + (b[0] - a[0]) * f - ((b[1] - a[1]) / len) * o, a[1] + (b[1] - a[1]) * f + ((b[0] - a[0]) / len) * o]);
        }
        pts.push(b);
      }
      roads.push({ c: def.c, pts });
    });
    pack.rails.forEach((def, k) => {
      const raw = def.map((q) => pointOf(pack, q));
      const rnd = rngOf('rail', k);
      const pts: Pt[] = [raw[0]];
      for (let i = 1; i < raw.length; i++) {
        const a = raw[i - 1];
        const b = raw[i];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (len > 8) {
          const o = (rnd() - 0.5) * len * 0.05;
          pts.push([(a[0] + b[0]) / 2 - ((b[1] - a[1]) / len) * o, (a[1] + b[1]) / 2 + ((b[0] - a[0]) / len) * o]);
        }
        pts.push(b);
      }
      rails.push(pts);
    });
    for (const l of pack.lakes) lakes.push(sampleCurve(l.pts.map(([la, lo]) => toKm(la, lo)), true, 0.35));
  }
  const world: World = { base, towns, byKey, roads, rails, lakes, packs: list };
  cache = { v: version, world };
  return world;
}
