import { Layers } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface MapClusterProps {
  count: number;
  /** Position in percent of the frame and shift in px, like a pin. */
  x: number;
  y: number;
  dx?: number;
  dy?: number;
  /** Brings the map closer to the houses of the group. */
  onZoom: () => void;
}

/**
 * Several houses that would sit on top of each other at this zoom: one bubble with their number, a button that brings the map
 * closer to them. The houses are all in the list of the page and appear as pins as soon as the map is closer, or when one of
 * them is selected from the list.
 */
export function MapCluster({ count, x, y, dx = 0, dy = 0, onZoom }: MapClusterProps) {
  const { t } = useTranslation();
  return (
    <li className="absolute" style={{ left: `calc(${x}% + ${dx}px)`, top: `calc(${y}% + ${dy}px)`, transform: 'translate(-50%, -50%)', zIndex: 8 }}>
      <button
        type="button"
        onClick={onZoom}
        aria-label={t('siteMap.cluster', { count })}
        data-testid="map-cluster"
        className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-full border-2 border-[var(--cz-public-text,#111)] bg-[var(--cz-public-surface,#fff)] px-3 text-sm font-bold leading-none text-[var(--cz-public-text,#111)] shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cz-public-primary-text,#1d4ed8)] focus-visible:ring-offset-2"
      >
        <Layers className="h-4 w-4" aria-hidden="true" />
        <span aria-hidden="true">{count}</span>
      </button>
    </li>
  );
}
