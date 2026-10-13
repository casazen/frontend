import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useMarkLongRentServiceRequestPaid, useMarkServiceRequestPaid } from '@/queries/use-service-requests';
import type {
  ServiceRequest,
  ServiceRequestContextKey,
  ServiceRequestHistoryEntry,
} from '@/types/service-request';
import { getServiceCategoryLabel, getServiceRequestStatusLabel } from '@/lib/i18n-labels';
import { formatRomeDateTime } from '@/lib/stay-dates';
import { hasReplacement, suppliersThatRejected, WAITING_HINT_KEYS } from '../lib/request-history';
import { MarkPaidDialog } from './mark-paid-dialog';
import { ServiceRequestForm } from './service-request-form';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  Richiesto: 'secondary',
  PresoInCarico: 'default',
  InCorso: 'default',
  Completato: 'outline',
  Pagato: 'default',
  Rifiutato: 'destructive',
};
const STEP_DATE_TIME: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};

interface ServiceRequestTimelineProps {
  requests: ServiceRequest[];
  /** Workspace the list is shown in: decides which API marks a request paid and which context a new request is for (D2). */
  context?: ServiceRequestContextKey;
  /** Property overview in short-rent: each request links to its stay (older ones without a stay say so). */
  showStay?: boolean;
  /** Lists that span several properties name the property of each request. */
  showProperty?: boolean;
  /** The caller may pay and re-request (`property.write` of the context): the buttons are hidden otherwise. */
  canManage?: boolean;
}

/**
 * Who made a step: the host's team for the host's steps, the supplier by name for the supplier's. A member of the
 * supplier's team is never named to the host (SU-09).
 */
function stepActor(entry: ServiceRequestHistoryEntry, supplierName: string | null | undefined, t: (key: string) => string) {
  if (entry.actor === 'Host') return t('serviceRequest.timeline.actorHost');
  return supplierName || t('serviceRequest.timeline.actorSupplier');
}

function RequestHistory({ request }: { request: ServiceRequest }) {
  const { t, i18n } = useTranslation();
  const history = request.history ?? [];
  const waitingKey = WAITING_HINT_KEYS[request.status];

  return (
    <div className="space-y-2">
      <ol className="space-y-2 border-l pl-4" data-testid={`service-request-history-${request.id}`}>
        {history.map((entry) => (
          <li key={entry.status} data-testid={`service-request-step-${request.id}-${entry.status}`}>
            <p className="text-sm font-medium">{getServiceRequestStatusLabel(entry.status, t)}</p>
            <p className="text-xs text-muted-foreground">
              {formatRomeDateTime(entry.at, i18n.language, STEP_DATE_TIME)} · {stepActor(entry, request.supplierName, t)}
            </p>
            {entry.status === 'Rifiutato' && (
              <p className="text-sm" data-testid={`service-request-rejection-${request.id}`}>
                {entry.reason
                  ? t('serviceRequest.timeline.rejectionReason', { reason: entry.reason })
                  : t('serviceRequest.timeline.noRejectionReason')}
              </p>
            )}
          </li>
        ))}
      </ol>
      {waitingKey && (
        <p className="text-xs text-muted-foreground" data-testid={`service-request-waiting-${request.id}`}>
          {t(waitingKey)}
        </p>
      )}
    </div>
  );
}

function ServiceRequestItem({
  request,
  requests,
  context,
  showStay,
  showProperty,
  canManage,
}: { request: ServiceRequest; requests: ServiceRequest[] } & Required<
  Pick<ServiceRequestTimelineProps, 'context' | 'showStay' | 'showProperty' | 'canManage'>
>) {
  const { t } = useTranslation();
  const markStayPaid = useMarkServiceRequestPaid();
  const markLongRentPaid = useMarkLongRentServiceRequestPaid();
  const markPaid = context === 'long-rent' ? markLongRentPaid : markStayPaid;
  const [confirmingPaid, setConfirmingPaid] = useState(false);
  const [reRequesting, setReRequesting] = useState(false);

  const category = getServiceCategoryLabel(request.category, t);
  const replaced = request.status === 'Rifiutato' && hasReplacement(request, requests);

  return (
    <div
      className="flex flex-col gap-2 border-b pb-4 last:border-0 last:pb-0"
      data-testid={`service-request-${request.id}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={STATUS_VARIANT[request.status] ?? 'secondary'}>
          {getServiceRequestStatusLabel(request.status, t)}
        </Badge>
        <span className="text-sm font-medium">{category}</span>
        {showProperty && request.propertyName && (
          <span className="text-sm text-muted-foreground">· {request.propertyName}</span>
        )}
        {request.supplierName && <span className="text-sm text-muted-foreground">— {request.supplierName}</span>}
      </div>
      {request.notes && <p className="text-sm text-muted-foreground">{request.notes}</p>}
      <RequestHistory request={request} />
      {showStay &&
        (request.bookingId ? (
          <Link
            to={`/app/short-rent/bookings/${request.bookingId}`}
            className="text-xs text-primary hover:underline"
            data-testid={`service-request-stay-${request.id}`}
          >
            {t('serviceRequest.viewStay')} &#8594;
          </Link>
        ) : (
          <span className="text-xs text-muted-foreground" data-testid={`service-request-no-stay-${request.id}`}>
            {t('serviceRequest.noStayLegacy')}
          </span>
        ))}
      {canManage && request.status === 'Completato' && (
        <div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setConfirmingPaid(true)}
            disabled={markPaid.isPending}
            data-testid={`mark-paid-${request.id}`}
          >
            {t('serviceRequest.markPaid')}
          </Button>
        </div>
      )}
      {request.status === 'Rifiutato' &&
        (replaced ? (
          <p className="text-xs text-muted-foreground" data-testid={`service-request-replaced-${request.id}`}>
            {t('serviceRequest.timeline.alreadyReRequested')}
          </p>
        ) : (
          canManage && (
            <div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setReRequesting(true)}
                data-testid={`request-other-supplier-${request.id}`}
              >
                {t('serviceRequest.requestOtherSupplier')}
              </Button>
            </div>
          )
        ))}

      {confirmingPaid && request.status === 'Completato' && (
        <MarkPaidDialog
          supplierName={request.supplierName}
          category={category}
          isPending={markPaid.isPending}
          onCancel={() => setConfirmingPaid(false)}
          onConfirm={() => markPaid.mutate(request.id, { onSuccess: () => setConfirmingPaid(false) })}
        />
      )}
      {reRequesting && request.status === 'Rifiutato' && (
        <ServiceRequestForm
          propertyId={request.propertyId}
          context={context}
          bookingId={request.bookingId ?? undefined}
          preselectedCategory={request.category}
          initialNotes={request.notes ?? undefined}
          excludeSupplierOrgIds={suppliersThatRejected(request, requests)}
          mode="otherSupplier"
          open
          onOpenChange={setReRequesting}
          hideTrigger
        />
      )}
    </div>
  );
}

/**
 * The supplier requests of a stay, a property or the whole org, each with its real timeline (SU-09, A4-28): requested,
 * taken, completed, paid or rejected, with date (Europe/Rome) and who, the rejection reason, "Segna pagato" behind an
 * explicit confirmation, and "Richiedi ad altro fornitore" after a rejection.
 */
export function ServiceRequestTimeline({
  requests,
  context = 'short-rent',
  showStay = false,
  showProperty = false,
  canManage = true,
}: ServiceRequestTimelineProps) {
  return (
    <div className="space-y-4" data-testid="service-request-timeline">
      {requests.map((request) => (
        <ServiceRequestItem
          key={request.id}
          request={request}
          requests={requests}
          context={context}
          showStay={showStay}
          showProperty={showProperty}
          canManage={canManage}
        />
      ))}
    </div>
  );
}
