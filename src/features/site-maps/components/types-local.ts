import type { LocalKind, MapLabel } from '../engine/local';

/**
 * A point of interest of the zone map: a beach, a sight, a restaurant… With the bearing and the distance from the house, and
 * the time to get there. It has no coordinates: the map never knows where the house is, only the zone around it.
 */
export interface LocalPoi {
  id: string;
  /** `beach`, `sight`, `food`, `shop`, `transport`, `health`, `parking`. */
  type: string;
  name: string;
  mode: 'walk' | 'car';
  minutes: number;
  /** Compass bearing from the house: 0 is north, 90 east. */
  bearingDeg: number;
  distM: number;
}

export interface LocalMapProps {
  kind: LocalKind;
  /** The slug of the house: the same seed always gives the same map. */
  seed: string;
  /** Width of the drawing in metres (default 1500). */
  spanM?: number;
  /** Where the sea is on a coast map (the bearing of the «beach» point of interest); east by default. */
  seaBearingDeg?: number;
  pois?: readonly LocalPoi[];
  /** The point lit because the same row of the list is hovered or focused (see `useMapLink`), and the way back. */
  activeId?: string | null;
  onActiveChange?: (id: string | null) => void;
  /** After the unlock (the day before the arrival) the note says that the address is in the booking: it is never on the map. */
  addressUnlocked?: boolean;
  /** Short names written on the drawing; keep the array stable between renders. */
  labels?: readonly MapLabel[];
  /** Width over height of the box (default 4:3, the ratio of the drawing). */
  aspect?: number;
  className?: string;
}
