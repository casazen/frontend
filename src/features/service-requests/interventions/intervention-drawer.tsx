import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { XCircle } from 'lucide-react';
import type { DetailContentProps, DetailTitleProps } from '@/components/shared/detail-drawer/detail-registry';
import { ErrorState } from '@/components/shared/error-state';
import { StatusBadge } from '@/components/shared/status/status-badge';
import { Button } from '@/components/ui/button';
import { SkeletonLine } from '@/components/ui/skeleton';
import { requestTitle } from '@/features/supplier/requests/request-model';
import { getHttpStatus } from '@/lib/api-errors';
import { useIntervention } from '@/queries/use-service-requests';
import { canDo } from './intervention-model';
import { InterventionNow } from './intervention-now';
import { InterventionFacts, InterventionHistory, InterventionPhotos, InterventionSupplier } from './intervention-parts';
import { INTERVENTIONS_PATH } from './paths';
import { useHostPermissions } from './use-host-permissions';
import { useInterventionActions } from './use-intervention-actions';

const LINK = 'h-auto min-h-11 whitespace-normal py-2';

/** The name of the drawer of an intervention: its service, or its category. Nothing until the request is there (the drawer names itself). */
export function InterventionDrawerTitle({ id }: DetailTitleProps) {
  const { t } = useTranslation();
  const { data: request } = useIntervention(id);
  return request ? <>{requestTitle(request, t)}</> : null;
}

/**
 * An intervention in the drawer (UI-15, SR-08): what it is and how it stands, in a block of its own what to do now (the one step the
 * server names, told like the page does), the details, the supplier and, once it took the request, how to reach it, the photos of the
 * work and the history. The rest is on the page of the request, one press away («Apri la scheda completa»). The calendar and the Home
 * open the same drawer with the id of the request.
 */
export function InterventionDrawerContent({ id }: DetailContentProps) {
  const { t } = useTranslation();
  const permissions = useHostPermissions();
  const actions = useInterventionActions();
  const { data: request, isLoading, isError, error, refetch } = useIntervention(id, { poll: actions.paymentSent });

  if (isLoading) return <SkeletonLine lines={5} />;

  if (!request) {
    // Only a 404 is «not found»: an API error is shown as an error, with a way to try again.
    if (isError && getHttpStatus(error) !== 404) {
      return <ErrorState title={t('interventions.drawer.loadError')} error={error} onRetry={() => void refetch()} />;
    }
    return (
      <div className="space-y-3 text-sm" data-testid="intervention-drawer-missing">
        <p>{t('interventions.drawer.missing')}</p>
        <Button asChild variant="outline" className={LINK}>
          <Link to={INTERVENTIONS_PATH}>{t('interventions.detail.backToList')}</Link>
        </Button>
      </div>
    );
  }

  const photos = request.workPhotos ?? [];
  const mayCancel = permissions.canManage && canDo(request, 'cancel');

  return (
    <div className="space-y-5 pb-2" data-testid="intervention-drawer">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-0 break-words text-lg font-semibold">{requestTitle(request, t)}</p>
          <StatusBadge kind="request" status={request.status} />
        </div>
        {request.propertyName ? <p className="break-words text-sm text-foreground/70">{[request.propertyName, request.propertyCity].filter(Boolean).join(' · ')}</p> : null}
      </div>

      <InterventionNow request={request} steps={actions.steps} busy={actions.busy} permissions={permissions} paymentSent={actions.paymentSent} />

      <InterventionFacts request={request} compact />

      <section aria-labelledby="intervention-drawer-supplier" className="space-y-3">
        <h3 id="intervention-drawer-supplier" className="text-sm font-semibold">
          {t('interventions.detail.supplierTitle')}
        </h3>
        <InterventionSupplier request={request} />
      </section>

      {photos.length > 0 ? (
        <section aria-labelledby="intervention-drawer-photos" className="space-y-3">
          <h3 id="intervention-drawer-photos" className="text-sm font-semibold">
            {t('interventions.photos.title')}
          </h3>
          <InterventionPhotos request={request} />
        </section>
      ) : null}

      <section aria-labelledby="intervention-drawer-history" className="space-y-3">
        <h3 id="intervention-drawer-history" className="text-sm font-semibold">
          {t('longRentRequests.detail.historyTitle')}
        </h3>
        <InterventionHistory request={request} />
      </section>

      {mayCancel ? (
        <Button type="button" variant="outline" className={`${LINK} text-destructive`} onClick={() => actions.steps.cancel(request)} data-testid="intervention-drawer-cancel">
          <XCircle aria-hidden="true" className="mr-2 size-4" />
          {t('interventions.action.cancel')}
        </Button>
      ) : null}

      {actions.dialogs}
    </div>
  );
}
