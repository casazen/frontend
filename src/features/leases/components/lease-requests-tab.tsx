import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DayList, PlainSection } from '@/components/shared/calm';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SkeletonCard } from '@/components/ui/skeleton';
import { getProblemMessage } from '@/lib/api-errors';
import { useLeaseServiceRequests } from '@/queries/use-service-requests';
import { leaseRequestRows } from '../lib/lease-requests';

interface LeaseRequestsTabProps {
  leaseId: string;
  /** Opens the window that asks a supplier for a job, ready with the property and the lease; `undefined` for who may not ask. */
  onRequest: (() => void) | undefined;
}

/**
 * The jobs asked of the suppliers for this contract (LR-03c, `GET /long-rent/service-requests?leaseId=`): the ones still to follow, the ones
 * that wait for the landlord first and each with the one thing to do about it, and, apart, the ones that are over. «Richiedi intervento» asks
 * for a new one for this property and this lease. The request is the same as the one made from the page of the property: the lease is a link
 * on it and no datum of the tenant goes to the supplier. The page of a request is the one of the area (Interventi), where it is followed up.
 */
export function LeaseRequestsTab({ leaseId, onRequest }: LeaseRequestsTabProps) {
  const { t, i18n } = useTranslation();
  const requests = useLeaseServiceRequests(leaseId);
  const [showClosed, setShowClosed] = useState(false);
  const rows = useMemo(() => leaseRequestRows(requests.data?.items ?? [], { t, language: i18n.language }), [requests.data, t, i18n.language]);
  const ask = onRequest ? { actionLabel: t('leaseSheet.requests.request'), onAction: onRequest, actionTestId: 'lease-request-new' } : {};

  return (
    <PlainSection title={t('leaseSheet.requests.title')} data-testid="lease-requests" {...ask}>
      {requests.isError ? (
        <Alert
          variant="danger"
          title={t('leaseSheet.requests.loadError')}
          data-testid="lease-requests-error"
          action={
            <Button variant="outline" size="sm" onClick={() => void requests.refetch()} disabled={requests.isFetching}>
              {t('leases.retry')}
            </Button>
          }
        >
          {getProblemMessage(requests.error, t)}
        </Alert>
      ) : requests.data ? (
        <>
          {rows.open.length > 0 ? (
            <DayList items={rows.open} data-testid="lease-requests-list" />
          ) : (
            <p className="text-sm text-foreground/70" data-testid="lease-requests-empty">
              {t(rows.closed.length > 0 ? 'leaseSheet.requests.noneOpen' : 'leaseSheet.requests.none')}
            </p>
          )}

          {rows.closed.length > 0 ? (
            <div className="space-y-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-expanded={showClosed}
                onClick={() => setShowClosed((shown) => !shown)}
                data-testid="lease-requests-closed-toggle"
              >
                {showClosed ? t('leaseSheet.requests.hideClosed') : t('leaseSheet.requests.showClosed', { count: rows.closed.length })}
              </Button>
              {showClosed ? <DayList items={rows.closed} data-testid="lease-requests-closed" /> : null}
            </div>
          ) : null}
        </>
      ) : (
        <SkeletonCard lines={3} label={t('leaseSheet.requests.loading')} />
      )}
    </PlainSection>
  );
}
