import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MapSkeleton } from './map-skeleton';
import type { RegionMapProps } from './types';
import { useLazyCanvas } from './use-lazy-canvas';

const loadCanvas = () => import('./region-map-canvas');

/**
 * A regional map with price pins (DB-19b): zoom, «fit to the results», dragging, a card for the selected pin and the link with
 * the list of the page (`activeId` / `onActiveChange`, see `useMapLink`). The map is an aid: whatever it shows is also in the list
 * of the page, and the pins are buttons with their own names, reachable with the keyboard.
 *
 * The code of the map, the engine and the data are loaded when the first map is shown (nothing is fetched from a third party);
 * until then a skeleton with the same box stands in, so the page does not jump, and if loading fails the box says so and offers
 * to try again. Pages that do not show a map never load any of it.
 */
export function RegionMap(props: RegionMapProps) {
  const { t } = useTranslation();
  const { aspect, className } = props;
  const { canvas, retry } = useLazyCanvas<RegionMapProps>(loadCanvas);
  return (
    <div
      className={cn('relative overflow-hidden rounded-2xl border border-[var(--cz-public-border,rgba(0,0,0,0.15))] bg-[var(--cz-public-bg,#f5f5f5)]', className)}
      style={aspect ? { aspectRatio: String(aspect) } : undefined}
      data-testid="region-map-box"
    >
      {canvas === null ? (
        <MapSkeleton />
      ) : canvas === 'failed' ? (
        <div role="alert" className="absolute inset-0 grid place-content-center justify-items-center gap-3 p-6 text-center">
          <p className="font-semibold text-[var(--cz-public-text,#111)]">{t('siteMap.error')}</p>
          <Button type="button" variant="outline" onClick={retry}>
            {t('siteMap.retry')}
          </Button>
        </div>
      ) : (
        <canvas.Component {...props} />
      )}
    </div>
  );
}
