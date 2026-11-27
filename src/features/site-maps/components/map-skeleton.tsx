import { useTranslation } from 'react-i18next';

export function MapSkeleton() {
  const { t } = useTranslation();
  return (
    <div role="status" className="absolute inset-0 animate-pulse bg-[var(--cz-public-border,rgba(0,0,0,0.08))]" data-testid="map-skeleton">
      <span className="sr-only">{t('siteMap.loading')}</span>
    </div>
  );
}
