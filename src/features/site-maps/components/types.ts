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
  place?: string;
  label: string;
  name: string;
  href?: string;
  available?: boolean;
  unavailableNote?: string;
  tone?: 'house' | 'zone';
  card?: { zone?: string; photoUrl?: string; rating?: number; priceLabel?: string };
}

export interface RegionMapProps {
  pins: readonly MapPinData[];
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  /** The pin lit because the same item of the list is hovered or focused (see `useMapLink`), and the way back. */
  activeId?: string | null;
  onActiveChange?: (id: string | null) => void;
  hideCard?: boolean;
  highlightIds?: readonly string[];
  view?: View;
  labels?: LabelMode;
  highlightTowns?: readonly string[];
  aspect?: number;
  className?: string;
}
