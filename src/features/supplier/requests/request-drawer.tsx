import { useTranslation } from 'react-i18next';
import { PlainSection } from '@/components/shared/calm';
import type { DetailContentProps, DetailTitleProps } from '@/components/shared/detail-drawer/detail-registry';
import { ErrorState } from '@/components/shared/error-state';
import { SkeletonLine } from '@/components/ui/skeleton';
import { useSupplierInboxItem } from '@/queries/supplier/use-inbox';
import { RequestDispute } from '../inquiry/dispute-block';
import { requestTitle } from './request-model';
import { RequestFacts, RequestHistory, RequestNow, RequestStateBadge } from './request-parts';
import { useRequestActions } from './use-request-actions';

/** The name of the drawer is the job; until the request arrives the drawer shows its generic name. */
export function RequestDrawerTitle({ id }: DetailTitleProps) {
  const { t } = useTranslation();
  const { data } = useSupplierInboxItem(id);
  return <>{data ? requestTitle(data, t) : ''}</>;
}

/**
 * One request in the drawer of the shell (UI-15): where it is, what to do now, when, where, who and how much, and what happened.
 * Taking, refusing and completing work from here; the whole page of the request is one link away.
 */
export function RequestDrawerContent({ id }: DetailContentProps) {
  const { t } = useTranslation();
  const { data, isLoading, isError, error, refetch } = useSupplierInboxItem(id);
  const actions = useRequestActions(() => void refetch());

  if (isLoading) return <SkeletonLine lines={6} label={t('supplier.requests.loading')} />;
  if (isError || !data) {
    return <ErrorState testId="supplier-request-drawer-error" title={t('supplier.requests.loadError')} error={error} onRetry={() => void refetch()} />;
  }

  return (
    <div className="min-w-0 space-y-6" data-testid="supplier-request-drawer">
      <div className="space-y-1">
        <RequestStateBadge request={data} size="lg" />
        <p className="break-words text-sm text-foreground/70">{[data.clientName, data.propertyName].filter(Boolean).join(' · ')}</p>
      </div>
      <RequestNow request={data} actions={actions} inDrawer />
      <RequestDispute request={data} suspended={actions.suspended} />
      <RequestFacts request={data} compact />
      <PlainSection title={t('supplier.requests.history.title')}>
        <RequestHistory request={data} limit={3} />
      </PlainSection>
      {actions.dialog}
    </div>
  );
}
