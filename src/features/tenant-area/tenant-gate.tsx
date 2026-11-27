import { useTranslation } from 'react-i18next';
import { ErrorState } from '@/components/shared/error-state';
import { SkeletonCard } from '@/components/ui/skeleton';

/** While a page of the tenant portal is read: the shape of a card, announced once as «Caricamento…», never the bare word (UX round 2026-11). */
export function TenantLoading() {
  const { t } = useTranslation();
  return (
    <div data-testid="tenant-loading">
      <SkeletonCard lines={3} label={t('tenantArea.loading')} />
    </div>
  );
}

/** Loading and error of a tenant page, or null when the contract is ready. */
export function TenantGate({
  status,
  error,
  refetch,
}: {
  status: 'loading' | 'error' | 'ready';
  error: unknown;
  refetch: () => void;
}) {
  const { t } = useTranslation();
  if (status === 'loading') return <TenantLoading />;
  if (status === 'error') return <ErrorState title={t('tenantArea.loadError')} error={error} onRetry={refetch} testId="tenant-error" />;
  return null;
}
