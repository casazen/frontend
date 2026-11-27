import { useState, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { StatusBadge } from '@/components/shared/status/status-badge';
import { Button } from '@/components/ui/button';
import { requestTitle } from '@/features/supplier/requests/request-model';
import { getServiceCategoryLabel } from '@/lib/i18n-labels';
import { formatRomeDateTime, romeDateOf, todayInRome } from '@/lib/stay-dates';
import { useMarkLongRentServiceRequestPaid, useMarkServiceRequestPaid } from '@/queries/use-service-requests';
import type { ServiceRequest, ServiceRequestContextKey } from '@/types/service-request';
import { interventionPath } from '../interventions/paths';
import { hasReplacement, suppliersThatRejected, WAITING_HINT_KEYS } from '../lib/request-history';
import { lastStep } from '../lib/request-list';
import { cancellationReasonText, isClosedRequest, whenText } from '../long-rent/long-rent-request-model';
import { longRentRequestPath } from '../long-rent/paths';
import { MarkPaidDialog } from './mark-paid-dialog';
import { ServiceRequestForm } from './service-request-form';

const STEP_DAY_TIME: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };

// The same control as a row of a `DayList`: at least 44 px high, the name and the line under it in one link.
const OPEN =
  'group/open flex min-h-11 min-w-0 flex-col justify-center rounded-md text-left outline-hidden ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

export interface ServiceRequestRowProps {
  request: ServiceRequest;
  /** Every request of the list: «Richiedi ad altro fornitore» needs the ones already made for the same job. */
  requests: readonly ServiceRequest[];
  context: ServiceRequestContextKey;
  showStay: boolean;
  showProperty: boolean;
  canManage: boolean;
  /** Opens the request in the drawer of the app; false when it cannot (no drawer on the page), and the link goes to its page. */
  onOpenDetail: (request: ServiceRequest, event: MouseEvent<HTMLAnchorElement>) => void;
}

/** «2 nov, 19:21», with the year when it is not this one. Europe/Rome, whatever the time zone of the browser. */
function stepMoment(instant: string | null, language: string): string {
  if (!instant) return '';
  const sameYear = romeDateOf(instant).slice(0, 4) === todayInRome().slice(0, 4);
  return formatRomeDateTime(instant, language, sameYear ? STEP_DAY_TIME : { ...STEP_DAY_TIME, year: 'numeric' });
}

/** The reason a supplier gave for refusing: what its history says, else what the request keeps. `null` when it gave none. */
function rejectionReasonOf(request: ServiceRequest): string | null {
  const entry = request.history?.find((step) => step.status === 'Rifiutato');
  return (entry?.reason ?? request.rejectionReason)?.trim() || null;
}

/** The reason of a cancellation, as a sentence: what a person wrote as it is, the code of the automatic one in words. */
function cancellationReasonOf(request: ServiceRequest, t: TFunction): string | null {
  const entry = request.history?.find((step) => step.status === 'Annullato');
  return cancellationReasonText(entry?.reason ?? request.cancellationReason, t);
}

/** Who made the last step, in a few words: only the three parties a host's request has. */
function byText(actor: string | null, t: TFunction): string | null {
  return actor === 'Host' || actor === 'Supplier' || actor === 'System' ? t(`serviceRequest.list.by.${actor}`) : null;
}

/**
 * One supplier request of a stay or a property, on one line of the list: what it is and who it was asked of, then what matters now. A request
 * that is still to follow says when the job is and what it waits for (the sentence the golden journey reads); one that is over says who closed it
 * and when. The one thing the host can do is a button of the row («Segna pagato», «Richiedi ad altro fornitore»); the story of the request, with
 * every step, is in the drawer that its name opens.
 */
export function ServiceRequestRow({ request, requests, context, showStay, showProperty, canManage, onOpenDetail }: ServiceRequestRowProps) {
  const { t, i18n } = useTranslation();
  const markStayPaid = useMarkServiceRequestPaid();
  const markLongRentPaid = useMarkLongRentServiceRequestPaid();
  const markPaid = context === 'long-rent' ? markLongRentPaid : markStayPaid;
  const [confirmingPaid, setConfirmingPaid] = useState(false);
  const [reRequesting, setReRequesting] = useState(false);

  const closed = isClosedRequest(request.status);
  const category = getServiceCategoryLabel(request.category, t);
  const replaced = request.status === 'Rifiutato' && hasReplacement(request, requests);
  const supplier = request.supplierName?.trim();
  const waitingKey = WAITING_HINT_KEYS[request.status];

  const when = whenText(request, i18n.language, t);
  const whenLine = [when.day, when.time].filter(Boolean).join(' · ');
  const step = lastStep(request);
  const closing = [byText(step.actor, t), stepMoment(step.at, i18n.language)].filter(Boolean).join(' · ');
  // What the line under the name says: the job to come, or who closed the request.
  const detail = closed
    ? closing
    : [showProperty ? request.propertyName?.trim() : null, whenLine || t('serviceRequest.list.noTime')].filter(Boolean).join(' · ');

  const rejection = request.status === 'Rifiutato' ? rejectionReasonOf(request) : null;
  const cancellation = request.status === 'Annullato' ? cancellationReasonOf(request, t) : null;

  return (
    <li className="py-3" data-testid={`service-request-${request.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="min-w-0 flex-1 basis-52 space-y-1">
          <Link
            to={context === 'long-rent' ? longRentRequestPath(request.id) : interventionPath(request.id)}
            onClick={(event) => onOpenDetail(request, event)}
            className={OPEN}
            data-testid={`service-request-open-${request.id}`}
          >
            <span className="block break-words">
              <span className="font-semibold group-hover/open:underline">{requestTitle(request, t)}</span>
              {supplier ? <span className="text-foreground/70"> · {supplier}</span> : null}
            </span>
            {detail ? <span className="block break-words text-sm text-foreground/70">{detail}</span> : null}
          </Link>

          {waitingKey ? (
            <p
              className={request.status === 'Completato' ? 'break-words text-sm font-medium' : 'break-words text-sm text-foreground/70'}
              data-testid={`service-request-waiting-${request.id}`}
            >
              {t(waitingKey)}
            </p>
          ) : null}

          {request.status === 'Rifiutato' ? (
            <p className="break-words text-sm" data-testid={`service-request-rejection-${request.id}`}>
              {rejection
                ? t('serviceRequest.timeline.rejectionReason', { reason: rejection })
                : t('serviceRequest.timeline.noRejectionReason')}
            </p>
          ) : null}

          {cancellation ? (
            <p className="break-words text-sm text-foreground/70" data-testid={`service-request-cancellation-${request.id}`}>
              {t('serviceRequest.list.cancelReason', { reason: cancellation })}
            </p>
          ) : null}

          {showStay ? (
            request.bookingId ? (
              <Link
                to={`/app/short-rent/bookings/${request.bookingId}`}
                className="inline-block text-xs text-primary-text hover:underline"
                data-testid={`service-request-stay-${request.id}`}
              >
                {t('serviceRequest.viewStay')} &#8594;
              </Link>
            ) : (
              <p className="text-xs text-foreground/70" data-testid={`service-request-no-stay-${request.id}`}>
                {t('serviceRequest.noStayLegacy')}
              </p>
            )
          ) : null}

          {canManage && request.status === 'Completato' ? (
            <div className="pt-1">
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
          ) : null}

          {request.status === 'Rifiutato' ? (
            replaced ? (
              <p className="text-xs text-foreground/70" data-testid={`service-request-replaced-${request.id}`}>
                {t('serviceRequest.timeline.alreadyReRequested')}
              </p>
            ) : canManage ? (
              <div className="pt-1">
                <Button size="sm" variant="outline" onClick={() => setReRequesting(true)} data-testid={`request-other-supplier-${request.id}`}>
                  {t('serviceRequest.requestOtherSupplier')}
                </Button>
              </div>
            ) : null
          ) : null}
        </div>

        <StatusBadge kind="request" status={request.status} className="shrink-0" />
      </div>

      {confirmingPaid && request.status === 'Completato' ? (
        <MarkPaidDialog
          supplierName={request.supplierName}
          category={category}
          isPending={markPaid.isPending}
          onCancel={() => setConfirmingPaid(false)}
          onConfirm={() => markPaid.mutate(request.id, { onSuccess: () => setConfirmingPaid(false) })}
        />
      ) : null}
      {reRequesting && request.status === 'Rifiutato' ? (
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
      ) : null}
    </li>
  );
}
