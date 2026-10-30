import type { LabelMode } from '../engine/region';
import type { View } from '../engine/view';

/**
 * A pin of a regional map. The position is the one the server publishes, rounded to two decimals (about 1 km): a position with
 * more decimals is refused in development and in tests and rounded in production. A pin never carries an address, an interior
 * or any other detail of where the house is: only what the card of the map may show.
 */
export interface MapPinData {
  id: string;
  lat: number;
  lon: number;
  /** What the pill says: the price of the stay, or the name of a zone. */
  label: string;
  /** The name of the house or zone: it is in the accessible name of the pin and in its card. */
  name: string;
  /** The page of the house. */
  href?: string;
  /** Free for the dates asked: `false` greys the pin out (with an icon and in the accessible name). Default `true`. */
  available?: boolean;
  /** Why it is not free («Non libera dal 12 ottobre»); the accessible name says «non libera» when this is missing. */
  unavailableNote?: string;
  /** `zone` pins (a place to explore) have no card. Default `house`. */
  tone?: 'house' | 'zone';
  /** What the card shows besides the name and the price. */
  card?: { zone?: string; photoUrl?: string; rating?: number; priceLabel?: string };
}

export interface RegionMapProps {
  pins: readonly MapPinData[];
  /** The selected pin; without it the map keeps the selection itself. */
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  /** The pin lit because the same item of the list is hovered or focused (see `useMapLink`), and the way back. */
  activeId?: string | null;
  onActiveChange?: (id: string | null) => void;
  /** Pins to emphasise. */
  highlightIds?: readonly string[];
  /** The frame to start from; without it the map is fitted to the pins, with a margin. */
  view?: View;
  /** Names of the towns on the map. */
  labels?: LabelMode;
  /** Towns to emphasise on the map (ids or names). */
  highlightTowns?: readonly string[];
  /** Width over height of the box: a fixed ratio, so the page does not jump while the map loads. Without it the map fills its parent, which has to have a height. */
  aspect?: number;
  className?: string;
}
