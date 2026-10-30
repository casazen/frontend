import { useTranslation } from 'react-i18next';

/**
 * What stands in for a map while its code and data are loading: the same box, so nothing moves when the map comes. It says it
 * is loading to a screen reader; the page around it already has the same information as a list.
 */
export function MapSkeleton() {
  const { t } = useTranslation();
  return (
    <div role="status" className="absolute inset-0 animate-pulse bg-[var(--cz-public-border,rgba(0,0,0,0.08))]" data-testid="map-skeleton">
      <span className="sr-only">{t('siteMap.loading')}</span>
    </div>
  );
}
