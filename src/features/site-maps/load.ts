/**
 * Loading of the map data on demand (DB-19a). The code and the data of the maps are in chunks that only the pages with a map
 * load: the national base (`data/italy.ts`) and, where the view touches them, the detail packs (Puglia for now). Nothing is
 * fetched from a third party: the files are part of the build. Call this before drawing; drawing without the data gives a plain
 * sea, never an error.
 */
import { hasBase, hasPack, installBase, installPack } from './engine/region/registry';
import { sane, type View } from './engine/view';

export type MapRegion = 'italia' | 'puglia';

/** Area of every region: [min lat, min lon, max lat, max lon]. */
const REGION_BOX: Record<MapRegion, [number, number, number, number]> = {
  italia: [34, 4, 48.5, 23],
  puglia: [39.4, 14.9, 42.2, 18.9],
};

/** The data a view needs: the national base always, a detail pack when the frame touches the area it covers. */
export function regionsForView(view: Partial<View>): MapRegion[] {
  const v = sane(view);
  const hKm = v.spanKm / v.aspect;
  const dLat = hKm / 2 / 111.19;
  const dLon = v.spanKm / 2 / (111.32 * Math.cos((v.lat * Math.PI) / 180));
  const out: MapRegion[] = ['italia'];
  const [la0, lo0, la1, lo1] = REGION_BOX.puglia;
  if (v.lat + dLat >= la0 && v.lat - dLat <= la1 && v.lon + dLon >= lo0 && v.lon - dLon <= lo1) out.push('puglia');
  return out;
}

/** Loads the data of a region (once). */
export async function loadRegionData(region: MapRegion): Promise<void> {
  if (region === 'italia') {
    if (!hasBase()) installBase((await import('./data/italy')).ITALY);
    return;
  }
  if (!hasPack(region)) installPack((await import('./data/puglia')).PUGLIA);
}
