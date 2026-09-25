import { useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { AlertTriangle, ArrowLeft, CalendarDays, FileText, History, Mail, MapPin, Phone, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useSupplierInboxItem } from '@/queries/use-supplier';
import {
  useCompleteServiceRequest,
  useRejectServiceRequest,
  useTakeServiceRequest,
} from '@/queries/use-service-requests';
import { getProblemMessage } from '@/lib/api-errors';
import { getServiceCategoryLabel, getServiceRequestStatusLabel } from '@/lib/i18n-labels';
import { formatRomeDateTime, formatStayDate } from '@/lib/stay-dates';
import type {
  ServiceRequestHistoryEntry,
  ServiceRequestUrgency,
  SupplierServiceRequestDetail,
} from '@/types/service-request';
import { RejectServiceRequestDialog } from './components/reject-service-request-dialog';

const INBOX_PATH = '/app/supplier/inbox';
const URGENCY_KEYS: Record<ServiceRequestUrgency, string> = {
  Normal: 'serviceRequest.urgencyNormal',
  High: 'serviceRequest.urgencyHigh',
  Emergency: 'serviceRequest.urgencyEmergency',
};
const LONG_DATE: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
const HISTORY_DATE_TIME: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};

function BackLink() {
  const { t } = useTranslation();
  return (
    <Link
      to={INBOX_PATH}
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      data-testid="supplier-request-back"
    >
      <ArrowLeft className="h-4 w-4" />
      {t('supplier.request.back')}
    </Link>
  );
}

function Section({ title, icon, testId, children }: { title: string; icon: ReactNode; testId: string; children: ReactNode }) {
  return (
    <Card data-testid={testId}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">{children}</CardContent>
    </Card>
  );
}

function Field({ label, children, testId }: { label: string; children: ReactNode; testId?: string }) {
  return (
    <div className="flex flex-wrap gap-x-2">
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium" data-testid={testId}>
        {children}
      </span>
    </div>
  );
}

function Hint({ children, testId }: { children: ReactNode; testId: string }) {
  return (
    <p className="text-muted-foreground" data-testid={testId}>
      {children}
    </p>
  );
}

function WhereSection({ request }: { request: SupplierServiceRequestDetail }) {
  const { t } = useTranslation();
  return (
    <Section title={t('supplier.request.whereTitle')} icon={<MapPin className="h-4 w-4" />} testId="supplier-request-where">
      <Field label={t('supplier.request.property')}>{request.propertyName}</Field>
      <Field label={t('supplier.request.comune')} testId="supplier-request-city">
        {request.city}
      </Field>
      {request.postalCode && (
        <Field label={t('supplier.request.postalCode')} testId="supplier-request-postal-code">
          {request.postalCode}
        </Field>
      )}
      {request.address ? (
        <Field label={t('supplier.request.address')} testId="supplier-request-address">
          {request.address}
        </Field>
      ) : (
        !request.contactDisclosed &&
        request.status !== 'Rifiutato' && (
          <Hint testId="supplier-request-address-hidden">{t('supplier.request.addressAfterTake')}</Hint>
        )
      )}
    </Section>
  );
}

function WhenSection({ request }: { request: SupplierServiceRequestDetail }) {
  const { t, i18n } = useTranslation();
  return (
    <Section title={t('supplier.request.whenTitle')} icon={<CalendarDays className="h-4 w-4" />} testId="supplier-request-when">
      {request.scheduledFor ? (
        <>
          <Field label={t('supplier.request.scheduledFor')} testId="supplier-request-scheduled-for">
            {formatStayDate(request.scheduledFor, i18n.language, LONG_DATE)}
          </Field>
          <p className="text-xs text-muted-foreground">{t('supplier.request.scheduledForHint')}</p>
        </>
      ) : (
        <Hint testId="supplier-request-no-date">{t('supplier.request.noDate')}</Hint>
      )}
      {request.stay ? (
        <Field label={t('supplier.request.stay')} testId="supplier-request-stay">
          {t('supplier.request.stayDates', {
            from: formatStayDate(request.stay.checkIn, i18n.language),
            to: formatStayDate(request.stay.checkOut, i18n.language),
          })}
        </Field>
      ) : (
        request.rentalContext === 'LongRent' && <Hint testId="supplier-request-long-rent">{t('supplier.request.longRent')}</Hint>
      )}
    </Section>
  );
}

function HostSection({ request }: { request: SupplierServiceRequestDetail }) {
  const { t } = useTranslation();
  const contact = request.hostContact;
  let content: ReactNode;
  if (request.contactDisclosed && contact) {
    content = (
      <>
        <Field label={t('supplier.request.hostName')} testId="supplier-request-host-name">
          {contact.name}
        </Field>
        {contact.phone && (
          <Field label={t('supplier.request.phone')}>
            <a href={`tel:${contact.phone.replace(/\s+/g, '')}`} className="inline-flex items-center gap-1 underline" data-testid="supplier-request-host-phone">
              <Phone className="h-3.5 w-3.5" />
              {contact.phone}
            </a>
          </Field>
        )}
        {contact.email && (
          <Field label={t('supplier.request.email')}>
            <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-1 underline" data-testid="supplier-request-host-email">
              <Mail className="h-3.5 w-3.5" />
              {contact.email}
            </a>
          </Field>
        )}
        {!contact.phone && !contact.email && (
          <Hint testId="supplier-request-host-no-details">{t('supplier.request.noContactDetails')}</Hint>
        )}
      </>
    );
  } else if (request.status === 'Rifiutato') {
    content = <Hint testId="supplier-request-contact-rejected">{t('supplier.request.contactRejected')}</Hint>;
  } else {
    content = <Hint testId="supplier-request-contact-hidden">{t('supplier.request.contactAfterTake')}</Hint>;
  }

  return (
    <Section title={t('supplier.request.hostTitle')} icon={<User className="h-4 w-4" />} testId="supplier-request-host">
      {content}
    </Section>
  );
}

function historyActor(entry: ServiceRequestHistoryEntry, t: (key: string) => string): string {
  if (entry.actor === 'Host') return t('supplier.request.actorHost');
  return entry.actorName ? `${entry.actorName} (${t('supplier.request.actorSupplier')})` : t('supplier.request.actorSupplier');
}

function HistorySection({ history }: { history: ServiceRequestHistoryEntry[] }) {
  const { t, i18n } = useTranslation();
  return (
    <Section title={t('supplier.request.historyTitle')} icon={<History className="h-4 w-4" />} testId="supplier-request-history">
      <ol className="space-y-3 border-l pl-4">
        {history.map((entry, index) => (
          <li key={`${entry.status}-${index}`} data-testid={`supplier-request-history-${index}`}>
            <p className="font-medium">{getServiceRequestStatusLabel(entry.status, t)}</p>
            <p className="text-xs text-muted-foreground">
              {formatRomeDateTime(entry.at, i18n.language, HISTORY_DATE_TIME)} · {historyActor(entry, t)}
            </p>
            {entry.reason && <p className="text-xs">{t('supplier.request.historyReason', { reason: entry.reason })}</p>}
          </li>
        ))}
      </ol>
    </Section>
  );
}

/**
 * Actions of the state machine (SU-10) for the request's status, in a bar kept at the bottom of the screen on a phone:
 * take or reject a new request, complete a taken one. A 409/422 (another member or tab changed the request) reloads it.
 */
function ActionBar({ request, onChanged }: { request: SupplierServiceRequestDetail; onChanged: () => void }) {
  const { t } = useTranslation();
  const take = useTakeServiceRequest();
  const complete = useCompleteServiceRequest();
  const reject = useRejectServiceRequest();
  const [rejecting, setRejecting] = useState(false);
  const busy = take.isPending || complete.isPending || reject.isPending;

  let content: ReactNode = null;
  if (request.status === 'Richiesto') {
    content = (
      <>
        <Button
          className="flex-1 sm:flex-none"
          onClick={() => take.mutate(request.id, { onError: onChanged })}
          disabled={busy}
          data-testid="supplier-request-take"
        >
          {t('serviceRequest.take')}
        </Button>
        <Button
          className="flex-1 sm:flex-none"
          variant="outline"
          onClick={() => setRejecting(true)}
          disabled={busy}
          data-testid="supplier-request-reject"
        >
          {t('serviceRequest.reject')}
        </Button>
      </>
    );
  } else if (request.status === 'PresoInCarico' || request.status === 'InCorso') {
    content = (
      <Button
        className="flex-1 sm:flex-none"
        onClick={() => complete.mutate({ id: request.id }, { onError: onChanged })}
        disabled={busy}
        data-testid="supplier-request-complete"
      >
        {t('serviceRequest.complete')}
      </Button>
    );
  } else {
    const key =
      request.status === 'Pagato'
        ? 'supplier.request.closedPaid'
        : request.status === 'Rifiutato'
          ? 'supplier.request.closedRejected'
          : 'supplier.request.closedCompleted';
    content = (
      <div className="text-sm text-muted-foreground" data-testid="supplier-request-closed">
        <p>{t(key)}</p>
        {request.status === 'Rifiutato' && request.rejectionReason && (
          <p data-testid="supplier-request-rejection-reason">
            {t('supplier.request.rejectionReason')}: {request.rejectionReason}
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      <div
        className="sticky bottom-0 z-10 -mx-4 flex gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0"
        role="group"
        aria-label={t('supplier.request.actionsTitle')}
        data-testid="supplier-request-actions"
      >
        {content}
      </div>
      {rejecting && (
        <RejectServiceRequestDialog
          open
          isPending={reject.isPending}
          onCancel={() => setRejecting(false)}
          onConfirm={(reason) =>
            reject.mutate(
              { id: request.id, reason },
              { onSuccess: () => setRejecting(false), onError: onChanged },
            )
          }
        />
      )}
    </>
  );
}

/**
 * Detail of one request in the supplier console (SU-08, A4-14): where (comune and zone, street address after the take),
 * when (check-out day of the stay, Europe/Rome), host contact after the take, host notes, history with date and actor,
 * and the actions of its status. The guest of the stay is never shown: the API does not send it.
 */
export function SupplierRequestDetailPage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { data: request, isLoading, isError, error, refetch } = useSupplierInboxItem(id);

  if (isLoading) {
    return (
      <div className="space-y-4" data-testid="supplier-request-loading" aria-busy="true" aria-label={t('supplier.request.loading')}>
        <BackLink />
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (isError || !request) {
    const notFound = isAxiosError(error) && error.response?.status === 404;
    return (
      <div className="space-y-4">
        <BackLink />
        <Card className="border-destructive/40" role="alert" data-testid={notFound ? 'supplier-request-not-found' : 'supplier-request-error'}>
          <CardContent className="flex flex-wrap items-center gap-3 py-4">
            <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
            <p className="flex-1 text-sm text-destructive">
              {notFound ? t('supplier.request.notFound') : (getProblemMessage(error, t) ?? t('supplier.request.loadError'))}
            </p>
            {!notFound && (
              <Button size="sm" variant="outline" onClick={() => void refetch()}>
                {t('supplier.retry')}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="supplier-request-detail">
      <BackLink />
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight" data-testid="supplier-request-title">
          {getServiceCategoryLabel(request.category, t)} · {request.propertyName}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <Badge data-testid="supplier-request-status">{getServiceRequestStatusLabel(request.status, t)}</Badge>
          <Badge variant={request.urgency === 'Normal' ? 'secondary' : 'destructive'} data-testid="supplier-request-urgency">
            {t('serviceRequest.urgency')}: {t(URGENCY_KEYS[request.urgency] ?? URGENCY_KEYS.Normal)}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {t('supplier.inbox.receivedOn', { date: formatRomeDateTime(request.createdAt, i18n.language, HISTORY_DATE_TIME) })}
          </span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <WhereSection request={request} />
        <WhenSection request={request} />
        <HostSection request={request} />
        {request.notes && (
          <Section title={t('supplier.request.notesTitle')} icon={<FileText className="h-4 w-4" />} testId="supplier-request-notes">
            <p className="whitespace-pre-line">{request.notes}</p>
          </Section>
        )}
      </div>

      <HistorySection history={request.history} />
      <ActionBar request={request} onChanged={() => void refetch()} />
    </div>
  );
}
