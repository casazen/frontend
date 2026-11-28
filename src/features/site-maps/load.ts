/**
 * The regions of the maps (DB-19a): which data a view needs, loading them on demand, and which region a set of positions is in.
 * The code and the data of the maps are in chunks that only the pages with a map load: the national base (`data/italy.ts`,
 * Italy and Switzerland) and, where the view touches them, the detail packs of Lombardia and Svizzera (`data/lombardia.ts`,
 * `data/svizzera.ts`). Nothing is fetched from a third party: the files are part of the build. Call `loadRegionData` before
 * drawing; drawing without the data gives a plain sea, never an error. `data/regions.ts`, the one file here that is always
 * loaded, holds the boxes and the coarse outlines of the regions with a pack, so that the choice of the frame is immediate.
 */
import { distToLine, pip, type Pt } from './engine/geometry';
import { decodePack, decodeShape, hasBase, hasPack, installBase, installPack } from './engine/region/registry';
import type { RawPack } from './engine/region/model';
import { LAT_KM, LON_KM, fitView, makeView, publicPoint, sane, toKm, type LatLon, type View } from './engine/view';
import { REGION_INDEX } from './data/regions';

export type MapRegion = 'italia' | 'lombardia' | 'svizzera';
export type RegionId = 'italia' | 'lombardia' | 'svizzera' | 'lombardia-svizzera';

type PackId = Exclude<MapRegion, 'italia'>;
type Box = readonly [number, number, number, number];
const PACK_IDS: readonly PackId[] = ['lombardia', 'svizzera'];
const boxOf = (id: PackId): Box => REGION_INDEX.regions.find((r) => r.id === id)?.box ?? [0, 0, 0, 0];
const REGION_BOX: Record<PackId, Box> = { lombardia: boxOf('lombardia'), svizzera: boxOf('svizzera') };
const ITALY_BOX: Box = [35.3, 6.4, 47.3, 18.9];

const inBox = (p: LatLon, [la0, lo0, la1, lo1]: Box): boolean => p.lat >= la0 && p.lat <= la1 && p.lon >= lo0 && p.lon <= lo1;

export const isMappable = (p: LatLon): boolean => inBox(p, ITALY_BOX) || inBox(p, REGION_BOX.svizzera);

export function regionsForView(view: Partial<View>): MapRegion[] {
  const v = sane(view);
  const hKm = v.spanKm / v.aspect;
  const dLat = hKm / 2 / 111.19;
  const dLon = v.spanKm / 2 / (111.32 * Math.cos((v.lat * Math.PI) / 180));
  const out: MapRegion[] = ['italia'];
  for (const id of PACK_IDS) {
    const [la0, lo0, la1, lo1] = REGION_BOX[id];
    if (v.lat + dLat >= la0 && v.lat - dLat <= la1 && v.lon + dLon >= lo0 && v.lon - dLon <= lo1) out.push(id);
  }
  return out;
}

const PACKS: Record<PackId, () => Promise<RawPack>> = {
  lombardia: async () => (await import('./data/lombardia')).LOMBARDIA,
  svizzera: async () => (await import('./data/svizzera')).SVIZZERA,
};

export async function loadRegionData(region: MapRegion): Promise<void> {
  if (region === 'italia') {
    if (!hasBase()) installBase((await import('./data/italy')).ITALY);
    return;
  }
  if (!hasPack(region)) installPack(decodePack(await PACKS[region]()));
}

const NEAR_KM = 3;
const HOME_PAD = 0.05;
export const FIT = { padPct: 0.42, minSpanKm: 40 };

interface Outline {
  id: PackId;
  ring: Pt[];
  box: [number, number, number, number];
}
let outlines: Outline[] | null = null;
function outlinesOf(): Outline[] {
  outlines ??= REGION_INDEX.regions.map((r) => {
    const { k, box } = decodeShape(r.ring, 100);
    return { id: r.id, ring: [...k, k[0]], box };
  });
  return outlines;
}

function regionOfPoint(p: LatLon): PackId | null {
  const k = toKm(p.lat, p.lon);
  const near = outlinesOf().filter((o) => k[0] >= o.box[0] - NEAR_KM && k[0] <= o.box[2] + NEAR_KM && k[1] >= o.box[1] - NEAR_KM && k[1] <= o.box[3] + NEAR_KM);
  return near.find((o) => pip(o.ring, k[0], k[1]))?.id ?? near.find((o) => distToLine(o.ring, k[0], k[1]) <= NEAR_KM)?.id ?? null;
}

function homeView(aspect: number): View {
  const boxes = PACK_IDS.map((id) => REGION_BOX[id]);
  const la0 = Math.min(...boxes.map((b) => b[0]));
  const lo0 = Math.min(...boxes.map((b) => b[1]));
  const la1 = Math.max(...boxes.map((b) => b[2]));
  const lo1 = Math.max(...boxes.map((b) => b[3]));
  const wKm = (lo1 - lo0) * LON_KM * (1 + 2 * HOME_PAD);
  const hKm = (la1 - la0) * LAT_KM * (1 + 2 * HOME_PAD);
  return makeView({ lat: (la0 + la1) / 2, lon: (lo0 + lo1) / 2, spanKm: Math.max(wKm, hKm * aspect), aspect });
}

export const VIEW_LOMBARDIA_SVIZZERA: Readonly<View> = Object.freeze(homeView(4 / 3));

export interface RegionChoice {
  /** Where the positions are: `lombardia`, `svizzera` or `lombardia-svizzera` when all of them are in the regions the site works in, `italia` otherwise (also with no position). */
  id: RegionId;
  view: View;
  regions: MapRegion[];
}

/**
 * The region of a set of positions, with the frame a map starts from and the data it needs. When every position is in Lombardia
 * and/or Svizzera (which border on each other) the frame is the one of the two together; otherwise it is fitted to the positions,
 * as `RegionMap` does without a `view`. The positions are the ones of the houses, two decimals at most (see `publicPoint`; the ones
 * outside Italy and Switzerland are not on the maps and do not count); `aspect`
 * is the width over the height of the box the map is shown in. Pass `view` to `RegionMap`: the button «Inquadra tutte le case»
 * still fits the map to the pins.
 */
export function getRegionForPoints(points: readonly LatLon[], { aspect = 4 / 3 }: { aspect?: number } = {}): RegionChoice {
  const pts = (Array.isArray(points) ? points : []).filter((p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lon)).map(publicPoint).filter(isMappable);
  const where = pts.map(regionOfPoint);
  if (pts.length > 0 && where.every((w) => w !== null)) {
    const lombardia = where.includes('lombardia');
    const svizzera = where.includes('svizzera');
    const view = homeView(sane({ aspect }).aspect);
    return { id: lombardia && svizzera ? 'lombardia-svizzera' : lombardia ? 'lombardia' : 'svizzera', view, regions: regionsForView(view) };
  }
  const view = fitView(pts, { aspect, ...FIT });
  return { id: 'italia', view, regions: regionsForView(view) };
}
