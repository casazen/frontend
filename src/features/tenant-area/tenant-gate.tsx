import { useTranslation } from 'react-i18next';
import { ErrorState } from '@/components/shared/error-state';

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
  if (status === 'loading') return <p data-testid="tenant-loading">{t('tenantArea.loading')}</p>;
  if (status === 'error') return <ErrorState title={t('tenantArea.loadError')} error={error} onRetry={refetch} testId="tenant-error" />;
  return null;
}
