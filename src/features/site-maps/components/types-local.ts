import type { LocalKind, MapLabel } from '../engine/local';

export interface LocalPoi {
  id: string;
  type: string;
  name: string;
  mode: 'walk' | 'car';
  minutes: number;
  bearingDeg: number;
  distM: number;
}

export interface LocalMapProps {
  kind: LocalKind;
  seed: string;
  spanM?: number;
  seaBearingDeg?: number;
  pois?: readonly LocalPoi[];
  /** The point lit because the same row of the list is hovered or focused (see `useMapLink`), and the way back. */
  activeId?: string | null;
  onActiveChange?: (id: string | null) => void;
  addressUnlocked?: boolean;
  labels?: readonly MapLabel[];
  aspect?: number;
  className?: string;
}
