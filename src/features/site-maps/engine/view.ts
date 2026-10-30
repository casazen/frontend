/**
 * Views and projection of the regional maps (DB-19a). Equirectangular with a fixed cos(lat0), so zoom and pan are linear and
 * exact: the maps are schematic and no distance is ever read from them. A view is a centre, the width of the frame in km and its
 * aspect ratio; points are projected to percent of the frame, to put HTML pins exactly over the SVG.
 */
import { DEG, clamp } from './numeric';

export interface LatLon {
  lat: number;
  lon: number;
}
export interface View extends LatLon {
  /** Width of the frame in km. */
  spanKm: number;
  /** Width over height. */
  aspect: number;
}

export const LAT0 = 40.8;
export const LAT_KM = 111.19; // km per degree of latitude
export const LON_KM = 111.32 * Math.cos(LAT0 * DEG); // km per degree of longitude (at lat0)
const MIN_SPAN_KM = 1;
const MAX_SPAN_KM = 1500;

/** The whole of Italy, portrait. */
export const VIEW_ITALIA: Readonly<View> = Object.freeze({ lat: 41.5, lon: 12.5, spanKm: 1050, aspect: 0.8 });

/** A valid view: missing or non numeric fields fall back on the whole of Italy (never an exception). */
export function sane(v: Partial<View> | null | undefined): View {
  const o: Partial<View> = v && typeof v === 'object' ? v : VIEW_ITALIA;
  return {
    lat: Number.isFinite(o.lat) ? (o.lat as number) : VIEW_ITALIA.lat,
    lon: Number.isFinite(o.lon) ? (o.lon as number) : VIEW_ITALIA.lon,
    spanKm: Number.isFinite(o.spanKm) && (o.spanKm as number) > 0 ? clamp(o.spanKm as number, MIN_SPAN_KM, MAX_SPAN_KM) : VIEW_ITALIA.spanKm,
    aspect: Number.isFinite(o.aspect) && (o.aspect as number) > 0 ? (o.aspect as number) : 4 / 3,
  };
}

/** A view: centre, width of the frame in km (`spanKm`) and aspect ratio. */
export function makeView({ lat, lon, spanKm, aspect = 4 / 3 }: Partial<View> = {}): View {
  return sane({ lat, lon, spanKm, aspect });
}

/** Rounds a coordinate to two decimals, about 1 km: the precision the server publishes. */
export const roundCoord = (v: number): number => Math.round(v * 100) / 100;

/**
 * Whether a house has a position at all. The data say «not set» with `0, 0` together (a host who never gave the coordinates): that
 * is a point in the Gulf of Guinea, not a place, and a map must never take it for one.
 */
export const isPositionSet = (lat: unknown, lon: unknown): lat is number =>
  typeof lat === 'number' && typeof lon === 'number' && Number.isFinite(lat) && Number.isFinite(lon) && !(lat === 0 && lon === 0);
const hasMoreThanTwoDecimals = (v: number): boolean => Math.abs(v * 100 - Math.round(v * 100)) > 1e-6;

/**
 * The position of a house as a map may use it: two decimals at most. More decimals mean that an exact position got here by
 * mistake, so in development and in tests this throws; in production the position is rounded and a warning (without the numbers)
 * goes to the console. A position that is not finite is an error in every case.
 */
export function publicPoint(p: LatLon): LatLon {
  if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon)) throw new RangeError('site-maps: a position needs a finite latitude and longitude');
  if (hasMoreThanTwoDecimals(p.lat) || hasMoreThanTwoDecimals(p.lon)) {
    if (import.meta.env.DEV) throw new RangeError('site-maps: positions have two decimals at most (about 1 km); an exact position must never reach a map');
    console.warn('site-maps: a position with more than two decimals was rounded');
  }
  return { lat: roundCoord(p.lat), lon: roundCoord(p.lon) };
}

/** A view that contains all the points, with a margin (`padPct` = fraction per side) and a minimum width. The points are positions of houses (two decimals). */
export function fitView(points: readonly LatLon[], { aspect = 4 / 3, padPct = 0.2, minSpanKm = 12 }: { aspect?: number; padPct?: number; minSpanKm?: number } = {}): View {
  const pts = (Array.isArray(points) ? points : []).filter((p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lon)).map(publicPoint);
  const asp = sane({ aspect }).aspect;
  // no position to show: the whole of Italy, whatever the shape of the frame
  if (!pts.length) return makeView({ lat: VIEW_ITALIA.lat, lon: VIEW_ITALIA.lon, spanKm: Math.max(VIEW_ITALIA.spanKm, 1280 * asp), aspect: asp });
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  for (const p of pts) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLon = Math.min(minLon, p.lon);
    maxLon = Math.max(maxLon, p.lon);
  }
  const wKm = (maxLon - minLon) * LON_KM * (1 + 2 * padPct);
  const hKm = (maxLat - minLat) * LAT_KM * (1 + 2 * padPct);
  return makeView({ lat: (minLat + maxLat) / 2, lon: (minLon + maxLon) / 2, spanKm: Math.max(wKm, hKm * asp, minSpanKm), aspect: asp });
}

/** Zoom: factor 2 is twice as close. With an anchor the point stays where it is in the frame. */
export function zoomView(view: Partial<View>, factor: number, anchor?: LatLon): View {
  const v = sane(view);
  const f = factor > 0 && Number.isFinite(factor) ? factor : 1;
  const spanKm = clamp(v.spanKm / f, MIN_SPAN_KM, MAX_SPAN_KM);
  if (!anchor || !Number.isFinite(anchor.lat) || !Number.isFinite(anchor.lon)) return { ...v, spanKm };
  const k = spanKm / v.spanKm;
  return { ...v, spanKm, lat: anchor.lat - (anchor.lat - v.lat) * k, lon: anchor.lon - (anchor.lon - v.lon) * k };
}

/** Moves the frame: dxFrac > 0 goes east (right), dyFrac > 0 goes south (down), in fractions of the frame. */
export function panView(view: Partial<View>, dxFrac = 0, dyFrac = 0): View {
  const v = sane(view);
  return {
    ...v,
    lon: v.lon + ((Number.isFinite(dxFrac) ? dxFrac : 0) * v.spanKm) / LON_KM,
    lat: v.lat - ((Number.isFinite(dyFrac) ? dyFrac : 0) * (v.spanKm / v.aspect)) / LAT_KM,
  };
}

/** Geographic coordinates to percent of the frame (0..100, also outside): for HTML pins and labels. */
export function projectPoint(lat: number, lon: number, view: Partial<View>): { x: number; y: number } {
  const v = sane(view);
  const hKm = v.spanKm / v.aspect;
  return {
    x: 50 + (((lon - v.lon) * LON_KM) / v.spanKm) * 100,
    y: 50 - (((lat - v.lat) * LAT_KM) / hKm) * 100,
  };
}

/** Percent of the frame to geographic coordinates. */
export function unprojectPoint(xPct: number, yPct: number, view: Partial<View>): LatLon {
  const v = sane(view);
  const hKm = v.spanKm / v.aspect;
  return {
    lat: v.lat - ((yPct - 50) / 100) * (hKm / LAT_KM),
    lon: v.lon + ((xPct - 50) / 100) * (v.spanKm / LON_KM),
  };
}

/** Kilometres east and north of the origin of the maps (40.8 N, 16.8 E). */
export const ORIGIN_LAT = 40.8;
export const ORIGIN_LON = 16.8;
export const toKm = (lat: number, lon: number): [number, number] => [(lon - ORIGIN_LON) * LON_KM, (lat - ORIGIN_LAT) * LAT_KM];
