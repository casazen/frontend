/**
 * Pins on land (DB-19a): the position of a house is rounded to about 1 km, so near the sea it may fall into the water on the map.
 * `snapToLand` moves such a position to the nearest land (or shore of a lake) within a short distance and leaves it alone
 * otherwise. The area of a house is approximate by declaration; this only keeps the pin from looking absurd. It works on the
 * finest level of the data whatever the view, so a pin does not jump when the map is zoomed.
 */
import { snapKm } from './region/land';
import { geoBase } from './region/registry';
import { LAT_KM, LON_KM, ORIGIN_LAT, ORIGIN_LON, publicPoint, toKm, type LatLon } from './view';

/**
 * The position moved to land: unchanged when it already is on land or when no shore is within `maxKm` (1.5 by default). The
 * position is the one of a house, so two decimals at most (see `publicPoint`); the result may have more, it is only for drawing.
 */
export function snapToLand(point: LatLon, { maxKm = 1.5 }: { maxKm?: number } = {}): LatLon {
  const base = geoBase();
  const given = publicPoint(point);
  if (!base) return given;
  const p = toKm(given.lat, given.lon);
  const q = snapKm(base.lods[base.lods.length - 1], p, maxKm);
  if (q === p) return given;
  const round3 = (v: number): number => Math.round(v * 1000) / 1000;
  return { lat: round3(ORIGIN_LAT + q[1] / LAT_KM), lon: round3(ORIGIN_LON + q[0] / LON_KM) };
}
