import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MapSkeleton } from './map-skeleton';
import type { LocalMapProps } from './types-local';
import { useLazyCanvas } from './use-lazy-canvas';

const loadCanvas = () => import('./local-map-canvas');

/**
 * The map of the zone of a house (DB-19b): a scheme of the neighbourhood drawn from the slug of the house, a circle for the
 * approximate zone, the house at the centre and the points of interest as buttons with their names, lit together with the
 * rows of the list (`activeId` / `onActiveChange`). The map never shows an exact position, and the exact address is never on it:
 * the note says when it arrives. The information is also in the list of points of interest of the page.
 */
export function LocalMap(props: LocalMapProps) {
  const { t } = useTranslation();
  const { aspect = 4 / 3, className } = props;
  const { canvas, retry } = useLazyCanvas<LocalMapProps>(loadCanvas);
  return (
    <div
      className={cn('relative overflow-hidden rounded-2xl border border-[var(--cz-public-border,rgba(0,0,0,0.15))] bg-[#efe6d6]', className)}
      style={{ aspectRatio: String(aspect) }}
      data-testid="local-map-box"
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
