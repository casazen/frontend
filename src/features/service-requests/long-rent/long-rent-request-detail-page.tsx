import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Building2, ChevronDown, Wrench, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import type { PageHeaderMenuItem } from '@/components/layout/page-header-actions';
import { PlainSection } from '@/components/shared/calm';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { StatusBadge } from '@/components/shared/status/status-badge';
import { Timeline } from '@/components/shared/timeline/timeline';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { FACT_LINK, Fact, Facts } from '@/features/bookings/components/booking-facts';
import { longRentPropertyPath } from '@/features/properties/long-rent/paths';
import { clientStatusFromRedirect, type ClientPaymentStatus } from '@/features/public-booking/checkout-outcome';
import { requestTitle } from '@/features/supplier/requests/request-model';
import { useWorkspace } from '@/hooks/use-workspace';
import { getHttpStatus } from '@/lib/api-errors';
import { getServiceCategoryLabel } from '@/lib/i18n-labels';
import { useCreateLongRentPaymentSession, useLongRentServiceRequest, useMarkLongRentServiceRequestPaid } from '@/queries/use-service-requests';
import type { ServicePaymentSession, ServiceRequest } from '@/types/service-request';
import { MarkPaidDialog } from '../components/mark-paid-dialog';
import { ServiceRequestForm } from '../components/service-request-form';
import { CancelLongRentRequestDialog } from './cancel-long-rent-request-dialog';
import { RequestNextStep } from './long-rent-request-next-step';
import { canCancelRequest, historyEvents, PRICE_BASIS_KEYS, priceText, whenText } from './long-rent-request-model';
import { LONG_RENT_REQUESTS_PATH, longRentRequestPath } from './paths';
import { PayLongRentRequestDialog } from './pay-long-rent-request-dialog';

const URGENCY_KEYS = {
  Normal: { labelKey: 'serviceRequest.urgencyNormal' },
  High: { labelKey: 'serviceRequest.urgencyHigh' },
  Emergency: { labelKey: 'serviceRequest.urgencyEmergency' },
} as const;

const PAYMENT_MODE_KEYS: Readonly<Record<string, { labelKey: string }>> = {
  Online: { labelKey: 'longRentRequests.detail.paymentMode.Online' },
  Manual: { labelKey: 'longRentRequests.detail.paymentMode.Manual' },
};

/** From the take on, the request has the way it is paid fixed; before it, `Manual` is only the default of the API. */
const PAYMENT_MODE_KNOWN = new Set(['PresoInCarico', 'InCorso', 'Completato', 'Pagato']);

/** The page while the request loads: the shape of the page, no spinner in the middle of nothing. */
function DetailSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-busy="true" className="min-w-0 space-y-6" data-testid="long-rent-request-loading">
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

type RequestDialog = 'cancel' | 'markPaid' | 'again';

interface RequestDetailProps {
  request: ServiceRequest;
  /** `property.write` (long-rent): who may only read a request sees it, and has no button. */
  canManage: boolean;
  /** A card payment was sent to Stripe: the backend says it is paid when Stripe confirms to it, a little later. */
  paymentSent: boolean;
  onPaymentSent: (status: ClientPaymentStatus) => void;
}

/** What the page says of a request: the block of the next step, its details, and under «Mostra dettagli» the supplier and the history. */
function RequestDetail({ request, canManage, paymentSent, onPaymentSent }: RequestDetailProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<RequestDialog | null>(null);
  const markPaid = useMarkLongRentServiceRequestPaid();
  const createSession = useCreateLongRentPaymentSession();
  const [session, setSession] = useState<ServicePaymentSession | null>(null);
  const awaitingStripe = paymentSent && request.status === 'Completato';

  const title = requestTitle(request, t);
  const when = whenText(request, language, t, true);
  const price = priceText(request, language);
  const basis = request.price?.basis;
  const basisKey = basis && Object.prototype.hasOwnProperty.call(PRICE_BASIS_KEYS, basis) ? PRICE_BASIS_KEYS[basis] : null;
  const paymentMode = PAYMENT_MODE_KNOWN.has(request.status) && request.paymentMode ? PAYMENT_MODE_KEYS[request.paymentMode] : undefined;
  const urgency = URGENCY_KEYS[request.urgency];
  const propertyPath = longRentPropertyPath(request.propertyId);

  const menu: PageHeaderMenuItem[] = [
    { label: t('longRentRequests.detail.openProperty'), icon: Building2, to: propertyPath, testId: 'long-rent-request-property' },
    ...(canManage && canCancelRequest(request.status)
      ? [
          { separator: true as const },
          { label: t('longRentRequests.detail.cancel'), icon: XCircle, danger: true, onClick: () => setDialog('cancel'), testId: 'long-rent-request-cancel' },
        ]
      : []),
  ];

  return (
    <div className="min-w-0 space-y-6" data-testid="long-rent-request-page">
      {/* The trail (Affitti lunghi › Interventi › this request) and, on a phone, the link back to the list (UI-05). */}
      <PageHeader
        crumbs="auto"
        title={title}
        description={[request.propertyName, when.day].filter(Boolean).join(' · ') || undefined}
        action={<StatusBadge kind="request" status={request.status} size="lg" data-testid="long-rent-request-status" />}
        secondary={menu}
      />

      {awaitingStripe ? (
        <Alert variant="info" data-testid="long-rent-request-pay-processing">
          {t('longRentRequests.pay.processing')}
        </Alert>
      ) : null}

      <RequestNextStep
        request={request}
        canManage={canManage}
        onPay={() => createSession.mutate(request.id, { onSuccess: setSession })}
        paying={createSession.isPending || awaitingStripe}
        onMarkPaid={() => setDialog('markPaid')}
        onRequestAgain={() => setDialog('again')}
      />

      <div className="space-y-8">
        <PlainSection title={t('longRentRequests.detail.detailsTitle')} data-testid="long-rent-request-details">
          <Facts>
            <Fact label={t('longRentRequests.detail.type')}>{getServiceCategoryLabel(request.category, t)}</Fact>
            {request.serviceName?.trim() ? <Fact label={t('longRentRequests.detail.service')}>{request.serviceName.trim()}</Fact> : null}
            <Fact label={t('longRentRequests.detail.property')}>
              <Link to={propertyPath} className={FACT_LINK}>
                {request.propertyName || t('longRentRequests.detail.propertyFallback')}
              </Link>
            </Fact>
            <Fact label={t('longRentRequests.detail.when')}>{[when.day, when.time].filter(Boolean).join(' · ') || t('longRentRequests.list.noTime')}</Fact>
            <Fact label={t('longRentRequests.detail.urgency')}>{urgency ? t(urgency.labelKey) : request.urgency}</Fact>
            <Fact label={t('longRentRequests.detail.price')}>
              {price ? (
                <>
                  {price}
                  {basisKey ? <span className="text-foreground/70"> · {t(basisKey)}</span> : null}
                </>
              ) : (
                t('longRentRequests.detail.priceTbd')
              )}
            </Fact>
            {paymentMode ? <Fact label={t('longRentRequests.detail.payment')}>{t(paymentMode.labelKey)}</Fact> : null}
            {request.notes?.trim() ? (
              <Fact label={t('longRentRequests.detail.notes')}>
                <span className="whitespace-pre-wrap">{request.notes.trim()}</span>
              </Fact>
            ) : null}
            {request.completionNotes?.trim() ? (
              <Fact label={t('longRentRequests.detail.supplierNotes')}>
                <span className="whitespace-pre-wrap">{request.completionNotes.trim()}</span>
              </Fact>
            ) : null}
          </Facts>
        </PlainSection>

        <details className="group min-w-0" data-testid="long-rent-request-more">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-md text-sm font-semibold outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
            <ChevronDown aria-hidden="true" className="size-4 shrink-0 transition-transform group-open:rotate-180" />
            {t('longRentRequests.detail.showDetails')}
          </summary>
          <div className="space-y-6 pt-4">
            <Facts>
              <Fact label={t('longRentRequests.detail.supplier')}>{request.supplierName?.trim() || t('longRentRequests.detail.supplierFallback')}</Fact>
            </Facts>
            <section aria-labelledby="long-rent-request-history-title" className="min-w-0 space-y-3">
              <h3 id="long-rent-request-history-title" className="text-base font-semibold">
                {t('longRentRequests.detail.historyTitle')}
              </h3>
              <Timeline
                events={historyEvents(request, t)}
                order="asc"
                limit={Infinity}
                label={t('longRentRequests.detail.historyTitle')}
                emptyText={t('longRentRequests.detail.historyEmpty')}
                testId="long-rent-request-history"
              />
            </section>
          </div>
        </details>
      </div>

      {dialog === 'cancel' ? <CancelLongRentRequestDialog request={request} onClose={() => setDialog(null)} /> : null}

      {dialog === 'markPaid' ? (
        <MarkPaidDialog
          supplierName={request.supplierName}
          category={getServiceCategoryLabel(request.category, t)}
          isPending={markPaid.isPending}
          onCancel={() => setDialog(null)}
          onConfirm={() => markPaid.mutate(request.id, { onSuccess: () => setDialog(null) })}
        />
      ) : null}

      {dialog === 'again' ? (
        <ServiceRequestForm
          propertyId={request.propertyId}
          context="long-rent"
          preselectedCategory={request.category}
          initialNotes={request.notes ?? undefined}
          excludeSupplierOrgIds={request.status === 'Rifiutato' ? [request.supplierOrgId] : undefined}
          mode={request.status === 'Rifiutato' ? 'otherSupplier' : 'new'}
          open
          onOpenChange={(open) => !open && setDialog(null)}
          onCreated={(created) => void navigate(longRentRequestPath(created.id))}
          hideTrigger
        />
      ) : null}

      {session ? (
        <PayLongRentRequestDialog
          session={session}
          returnUrl={window.location.href}
          onClose={() => setSession(null)}
          onSubmitted={(status) => {
            setSession(null);
            onPaymentSent(status);
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * `/app/long-rent/service-requests/:id`: one request to a supplier of Affitti lunghi (LR-08b). The header says what it is and
 * where, with its state and the menu «⋯» (the property, and «Annulla intervento» while it can still be cancelled); under it the
 * one highlighted block, «Prossimo passo», told by the state of the request; then its details, and under «Mostra dettagli» the
 * supplier and the history. A request outside the landlord's scope is not found, as on the server.
 */
export function LongRentRequestDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  // One page per request: what was open (a window, a payment) is not carried over to the next one.
  return <LongRentRequestPage key={id} id={id} />;
}

function LongRentRequestPage({ id }: { id: string }) {
  const { t } = useTranslation();
  const { hasPermission } = useWorkspace();
  const canManage = hasPermission('long-rent', 'property.write');
  const [searchParams] = useSearchParams();
  // A payment sent to Stripe (from the window, or back from the page of the bank): the request is read again until it is paid.
  const [clientStatus, setClientStatus] = useState<ClientPaymentStatus | null>(() => clientStatusFromRedirect(searchParams.get('redirect_status')));
  const paymentSent = clientStatus === 'succeeded' || clientStatus === 'processing';
  const { data: request, isLoading, isError, error, refetch } = useLongRentServiceRequest(id, { poll: paymentSent });

  if (isLoading) return <DetailSkeleton label={t('longRentRequests.detail.loading')} />;

  // An API error is never shown as «not found» (only a 404 is).
  if (isError && getHttpStatus(error) !== 404) {
    return (
      <div className="min-w-0 space-y-6">
        <PageHeader crumbs="auto" title={t('longRentRequests.detail.fallbackTitle')} />
        <ErrorState testId="long-rent-request-load-error" title={t('longRentRequests.detail.loadError')} error={error} onRetry={() => void refetch()} />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="min-w-0 space-y-6">
        <PageHeader crumbs="auto" title={t('longRentRequests.detail.fallbackTitle')} />
        <EmptyState
          icon={Wrench}
          title={t('longRentRequests.detail.notFound')}
          description={t('longRentRequests.detail.notFoundDescription')}
          action={{ label: t('longRentRequests.detail.backToList'), href: LONG_RENT_REQUESTS_PATH }}
        />
      </div>
    );
  }

  return <RequestDetail request={request} canManage={canManage} paymentSent={paymentSent} onPaymentSent={setClientStatus} />;
}
