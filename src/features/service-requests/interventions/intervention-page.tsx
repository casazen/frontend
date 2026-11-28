import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ClipboardCheck, Building2, CalendarDays, Phone, Wrench, XCircle } from 'lucide-react';
import { ServicePageHeader } from '@/features/supplier/components/service-page-header';
import type { PageHeaderMenuItem } from '@/components/layout/page-header-actions';
import { PlainSection } from '@/components/shared/calm';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { StatusBadge } from '@/components/shared/status/status-badge';
import { StatusPipeline } from '@/components/shared/status/status-pipeline';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { CleaningVatQuestionHost } from '@/features/owner-accounting/components/cleaning-vat-dialog';
import { propertyPath } from '@/features/properties/properties-paths';
import { clientStatusFromRedirect } from '@/features/public-booking/checkout-outcome';
import { requestTitle } from '@/features/supplier/requests/request-model';
import { getHttpStatus } from '@/lib/api-errors';
import { useIntervention } from '@/queries/use-service-requests';
import type { ServiceRequest } from '@/types/service-request';
import { whenText } from '../long-rent/long-rent-request-model';
import { InterventionGroup } from './intervention-group';
import { canDo, phoneHref } from './intervention-model';
import { InterventionNow } from './intervention-now';
import { InterventionFacts, InterventionHistory, InterventionPhotos, InterventionSupplier } from './intervention-parts';
import { INTERVENTIONS_PATH } from './paths';
import { useHostPermissions } from './use-host-permissions';
import { useInterventionActions } from './use-intervention-actions';

function DetailSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-busy="true" className="min-w-0 space-y-6" data-testid="intervention-loading">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-2/3 max-w-sm motion-reduce:animate-none" />
          <Skeleton className="h-4 w-1/2 max-w-xs motion-reduce:animate-none" />
        </div>
        <Skeleton className="h-36 w-full rounded-xl motion-reduce:animate-none" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-full motion-reduce:animate-none" />
          <Skeleton className="h-4 w-11/12 motion-reduce:animate-none" />
          <Skeleton className="h-4 w-2/3 motion-reduce:animate-none" />
        </div>
      </div>
    </div>
  );
}

interface InterventionDetailProps {
  request: ServiceRequest;
  returned: 'sent' | 'failed' | null;
}

function InterventionDetail({ request, returned }: InterventionDetailProps) {
  const { t, i18n } = useTranslation();
  const permissions = useHostPermissions();
  const actions = useInterventionActions();
  const paymentSent = actions.paymentSent || returned === 'sent';
  const awaitingStripe = paymentSent && request.status === 'Completato';

  const title = requestTitle(request, t);
  const when = whenText(request, i18n.language, t, true);
  const phone = request.supplierContact?.phone?.trim();
  const mayCancel = permissions.canManage && canDo(request, 'cancel');
  const hasPhotos = (request.workPhotos ?? []).length > 0;

  const menu: PageHeaderMenuItem[] = [
    { label: t('longRentRequests.detail.openProperty'), icon: Building2, to: propertyPath(request.propertyId), testId: 'intervention-open-property' },
    ...(request.stay ? [{ label: t('interventions.action.openStay'), icon: CalendarDays, to: `/app/short-rent/bookings/${request.stay.bookingId}`, testId: 'intervention-open-stay' }] : []),
    ...(phone ? [{ label: t('interventions.action.call'), icon: Phone, to: phoneHref(phone), testId: 'intervention-call' }] : []),
    ...(mayCancel
      ? [
          { separator: true as const },
          { label: t('interventions.action.cancel'), icon: XCircle, danger: true, onClick: () => actions.steps.cancel(request), testId: 'intervention-cancel' },
        ]
      : []),
  ];

  return (
    <div className="min-w-0 space-y-6" data-testid="intervention-page">
      <ServicePageHeader
        icon={ClipboardCheck}
        crumbs="auto"
        title={title}
        description={[request.propertyName, request.propertyCity, when.day].filter(Boolean).join(' · ') || undefined}
        status={<StatusBadge kind="request" status={request.status} data-testid="intervention-status" />}
        secondary={menu}
      />

      <StatusPipeline kind="request" status={request.status} />

      {awaitingStripe ? (
        <Alert variant="info" data-testid="intervention-pay-processing">
          {t('interventions.pay.processing')}
        </Alert>
      ) : null}
      {returned === 'failed' ? (
        <Alert variant="danger" data-testid="intervention-pay-failed">
          {t('interventions.pay.failed')}
        </Alert>
      ) : null}

      <InterventionNow request={request} steps={actions.steps} busy={actions.busy} permissions={permissions} paymentSent={paymentSent} />

      <div className="grid min-w-0 items-start gap-6 lg:grid-cols-2">
        {request.group ? (
          <PlainSection title={t('interventions.group.title')} data-testid="intervention-group-section">
            <InterventionGroup group={request.group} />
          </PlainSection>
        ) : null}

        <PlainSection title={t('longRentRequests.detail.detailsTitle')} data-testid="intervention-details">
          <InterventionFacts request={request} />
        </PlainSection>

        {hasPhotos ? (
          <PlainSection title={t('interventions.photos.title')} data-testid="intervention-photos-section">
            <InterventionPhotos request={request} />
          </PlainSection>
        ) : null}

        <PlainSection title={t('interventions.detail.supplierTitle')} data-testid="intervention-supplier">
          <InterventionSupplier request={request} />
        </PlainSection>

        <PlainSection title={t('longRentRequests.detail.historyTitle')} data-testid="intervention-history-section">
          <InterventionHistory request={request} />
        </PlainSection>
      </div>

      {actions.dialogs}
    </div>
  );
}

/**
 * `/app/short-rent/interventions/:id`: one intervention of the host (SR-08). The header says what it is and where, with its state and the
 * menu «⋯» (the property, the stay, a call to the supplier and «Annulla intervento» while it can still be cancelled); under it the way
 * it has gone, the one highlighted block «Prossimo passo», its details, the photos of the work, the supplier and the history. A request
 * outside the host's scope is not found, as on the server.
 *
 * The «Da fare» `StateCleaningVat` of a cleaning recharged to the owner opens this page with the question «La ditta di pulizie ha applicato
 * l'IVA su questa fattura?» over it (`?cleaningVat=<request>`, FIX/FE-CLEANING-VAT-QUESTION), for who may write the properties.
 */
export function InterventionDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  return (
    <>
      <InterventionPage key={id} id={id} />
      <CleaningVatQuestionHost />
    </>
  );
}

function InterventionPage({ id }: { id: string }) {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [outcome] = useState(() => clientStatusFromRedirect(searchParams.get('redirect_status')));
  const returned = outcome === 'succeeded' || outcome === 'processing' ? 'sent' : outcome === 'failed' ? 'failed' : null;
  const { data: request, isLoading, isError, error, refetch } = useIntervention(id, { poll: returned === 'sent' });

  if (isLoading) return <DetailSkeleton label={t('interventions.detail.loading')} />;

  if (isError && getHttpStatus(error) !== 404) {
    return (
      <div className="min-w-0 space-y-6">
        <ServicePageHeader icon={ClipboardCheck} crumbs="auto" title={t('interventions.detail.fallbackTitle')} />
        <ErrorState testId="intervention-load-error" title={t('interventions.detail.loadError')} error={error} onRetry={() => void refetch()} />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="min-w-0 space-y-6">
        <ServicePageHeader icon={ClipboardCheck} crumbs="auto" title={t('interventions.detail.fallbackTitle')} />
        <EmptyState
          icon={Wrench}
          title={t('interventions.detail.notFound')}
          description={t('interventions.detail.notFoundDescription')}
          action={{ label: t('interventions.detail.backToList'), href: INTERVENTIONS_PATH }}
        />
      </div>
    );
  }

  return <InterventionDetail request={request} returned={returned} />;
}
