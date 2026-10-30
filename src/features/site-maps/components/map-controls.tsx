import { LocateFixed, Minus, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface MapControlsProps {
  canZoomIn: boolean;
  canZoomOut: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  /** What a screen reader hears after a change («Mappa a 40 km di larghezza»). */
  announcement: string;
  className?: string;
}

const BUTTON = cn(
  'grid h-11 w-11 place-items-center rounded-full border border-[var(--cz-public-border,rgba(0,0,0,0.2))] bg-[var(--cz-public-surface,#fff)] text-[var(--cz-public-text,#111)] shadow-md',
  'hover:bg-[var(--cz-public-bg,#f5f5f5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cz-public-primary-text,#1d4ed8)] focus-visible:ring-offset-2',
  'aria-disabled:cursor-not-allowed aria-disabled:opacity-50 motion-safe:transition-transform motion-safe:active:scale-90',
);

/**
 * Zoom in, zoom out and «fit to the results»: round buttons of 44 px with a name, and a polite announcement of the new level.
 * At the end of the zoom a button is dimmed (`aria-disabled`) but keeps the focus, so that a keyboard does not lose its place.
 * The wheel does not zoom (the page keeps its scrolling) unless Ctrl or Cmd is held.
 */
export function MapControls({ canZoomIn, canZoomOut, onZoomIn, onZoomOut, onFit, announcement, className }: MapControlsProps) {
  const { t } = useTranslation();
  return (
    <div role="group" aria-label={t('siteMap.controls')} className={cn('flex flex-col gap-2', className)} data-testid="map-controls">
      <button type="button" className={BUTTON} onClick={() => canZoomIn && onZoomIn()} aria-disabled={!canZoomIn} aria-label={t('siteMap.zoomIn')}>
        <Plus className="h-5 w-5" aria-hidden="true" />
      </button>
      <button type="button" className={BUTTON} onClick={() => canZoomOut && onZoomOut()} aria-disabled={!canZoomOut} aria-label={t('siteMap.zoomOut')}>
        <Minus className="h-5 w-5" aria-hidden="true" />
      </button>
      <button type="button" className={BUTTON} onClick={onFit} aria-label={t('siteMap.fit')}>
        <LocateFixed className="h-5 w-5" aria-hidden="true" />
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </div>
  );
}
