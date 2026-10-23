import type { ReactNode } from 'react';
import { ChevronDown, Lock, Mail, Phone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { FocusBlock, PlainSection, type CalmAction } from '@/components/shared/calm';
import { StatusBadge } from '@/components/shared/status/status-badge';
import { STATUS_ICONS } from '@/components/shared/status/status-icons';
import { STATUS_TONE_CLASSES } from '@/components/shared/status/status-view';
import { Timeline, type TimelineEvent, type TimelineTone } from '@/components/shared/timeline/timeline';
import { formatRomeDateTime, formatStayDate } from '@/lib/stay-dates';
import { cn } from '@/lib/utils';
import { formatWorkDuration } from '@/lib/work-duration';
import type {
  ServiceRequestHistoryEntry,
  ServiceRequestStatus,
  ServiceRequestUrgency,
  SupplierServiceRequest,
  SupplierServiceRequestDetail,
} from '@/types/service-request';
import { formatMoney } from '../services/lib/service-money';
import { actionsOf, phaseOf, reasonText, requestTitle, requestWhen, respondByText, type RequestAction } from './request-model';
import type { RequestActions } from './use-request-actions';

const URGENCY_KEYS: Record<ServiceRequestUrgency, string> = {
  Normal: 'serviceRequest.urgencyNormal',
  High: 'serviceRequest.urgencyHigh',
  Emergency: 'serviceRequest.urgencyEmergency',
};

/** The state of a request in the words of the supplier. A time proposed and not answered yet is a phase, not a status of the API. */
export function RequestStateBadge({ request, size }: { request: SupplierServiceRequest; size?: 'default' | 'lg' }) {
  const { t } = useTranslation();
  if (phaseOf(request) !== 'proposalPending') return <StatusBadge kind="request" status={request.status} perspective="supplier" size={size} />;

  const Icon = STATUS_ICONS.hourglass;
  return (
    <span
      data-status-kind="request"
      data-status="ProposalPending"
      className={cn('inline-flex max-w-full items-center gap-1 rounded-full font-semibold ring-1 ring-inset', size === 'lg' ? 'px-3 py-1 text-sm' : 'px-2.5 py-0.5 text-xs', STATUS_TONE_CLASSES.info)}
    >
      <Icon aria-hidden="true" className={cn('shrink-0', size === 'lg' ? 'size-4' : 'size-3.5')} />
      <span className="min-w-0 break-words">{t('supplier.requests.phase.proposalPending')}</span>
    </span>
  );
}

/* ----------------------------------------------------------------------------------------------------- Adesso */

/**
 * "Adesso": what to do about this request, whose turn it is and what the customer sees, with the buttons of the phase. It is the one
 * highlighted block of the page and of the drawer; a request that waits for somebody else, or is over, shows the same words without
 * the colour and without buttons, because there is nothing to do.
 */
export function RequestNow({ request, actions }: { request: SupplierServiceRequest; actions: RequestActions }) {
  const { t, i18n } = useTranslation();
  const phase = phaseOf(request);
  const plan = actionsOf(phase);
  // A job the server accepted by itself (SP-04d) says so, and says how to get out of it.
  const base = phase === 'scheduled' && request.autoAccepted ? 'supplier.requests.now.scheduledAuto' : `supplier.requests.now.${phase}`;
  const online = phase === 'completed' && request.paymentMode === 'Online';
  const toConfirm = phase === 'completed' && Boolean(request.payment?.needsAmountConfirmation || request.price?.needsCustomerConfirmation);
  const reason = reasonText(phase === 'rejected' ? request.rejectionReason : request.cancellationReason, t);

  const act = (kind: RequestAction): CalmAction => {
    const id = request.id;
    switch (kind) {
      case 'take':
        return { label: t('supplier.requests.action.take'), onClick: () => actions.take(id), loading: actions.takingId === id, disabled: actions.suspended || (actions.busy && actions.takingId !== id), testId: 'supplier-request-take' };
      case 'reject':
        return { label: t('supplier.requests.action.reject'), onClick: () => actions.askReject(id), disabled: actions.suspended || actions.busy, testId: 'supplier-request-reject' };
      case 'complete':
        return { label: t('supplier.requests.action.complete'), onClick: () => actions.complete(id), loading: actions.completingId === id, disabled: actions.suspended || (actions.busy && actions.completingId !== id), testId: 'supplier-request-complete' };
      case 'cancel':
        return { label: t('supplier.requests.action.cancel'), onClick: () => actions.askCancel(id), disabled: actions.suspended || actions.busy, testId: 'supplier-request-cancel' };
    }
  };

  const lines = (
    <>
      <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[auto_1fr]">
        <dt className="text-sm font-semibold text-foreground/70">{t('supplier.requests.now.label.you')}</dt>
        <dd className="min-w-0 break-words">{t(online ? `${base}.youOnline` : `${base}.you`)}</dd>
        <dt className="text-sm font-semibold text-foreground/70">{t('supplier.requests.now.label.client')}</dt>
        <dd className="min-w-0 break-words">{t(`${base}.client`)}</dd>
      </dl>
      {reason ? <p className="mt-2 break-words text-foreground/80">{t('supplier.requests.now.reason', { reason })}</p> : null}
      {toConfirm ? <p className="mt-2 break-words font-medium">{t('supplier.requests.now.amountToConfirm')}</p> : null}
    </>
  );

  if (!plan.primary) {
    return (
      <PlainSection title={t('supplier.requests.now.quietTitle')} data-testid="supplier-request-now">
        <p className="break-words font-medium">{t(`${base}.title`)}</p>
        <div className="text-sm sm:text-base">{lines}</div>
      </PlainSection>
    );
  }

  const then = i18n.exists(`${base}.then`) ? t(`${base}.then`) : undefined;
  return (
    <>
      <FocusBlock
        data-testid="supplier-request-now"
        kicker={t('supplier.requests.now.kicker')}
        title={t(`${base}.title`)}
        when={respondByText(request, i18n.language, t) ?? undefined}
        body={lines}
        then={then}
        primary={act(plan.primary)}
        secondary={plan.secondary ? act(plan.secondary) : undefined}
      />
      {actions.suspended ? (
        <p className="text-sm text-foreground/70" data-testid="supplier-request-actions-suspended">
          {t('supplier.requests.suspendedHint')}
        </p>
      ) : null}
    </>
  );
}

/* ----------------------------------------------------------------------------------------------------- In breve */

function Fact({ label, value, note, testId }: { label: string; value: ReactNode; note?: ReactNode; testId: string }) {
  return (
    <div className="min-w-0" data-testid={testId}>
      <dt className="text-xs font-semibold uppercase tracking-wide text-foreground/70">{label}</dt>
      <dd className="mt-1 break-words font-semibold">{value}</dd>
      {note ? <dd className="break-words text-sm text-foreground/70">{note}</dd> : null}
    </div>
  );
}

/** When, where, who and how much: four short facts, in two columns in a narrow place (the drawer). The street address is for after the take (decision D9). */
export function RequestFacts({ request, compact = false }: { request: SupplierServiceRequest; compact?: boolean }) {
  const { t, i18n } = useTranslation();
  const phase = phaseOf(request);
  const when = requestWhen(request, i18n.language, true);
  const over = phase === 'rejected' || phase === 'cancelled';
  const price = request.price?.amountCents ?? null;
  const net = request.payment?.netCents ?? null;
  const place = request.postalCode ? `${request.city} (${request.postalCode})` : request.city;
  const showcase = request.source === 'showcase';

  return (
    <dl className={cn('grid grid-cols-1 gap-x-6 gap-y-4 border-y py-4 sm:grid-cols-2', !compact && 'lg:grid-cols-4')} data-testid="supplier-request-facts">
      <Fact
        testId="supplier-request-when"
        label={t('supplier.requests.facts.when')}
        value={when.day ?? t('supplier.requests.facts.whenTbd')}
        note={
          [
            when.time,
            when.minutes ? formatWorkDuration(when.minutes, t) : null,
            request.urgency !== 'Normal' ? t('supplier.requests.facts.urgency', { level: t(URGENCY_KEYS[request.urgency] ?? URGENCY_KEYS.Normal) }) : null,
          ]
            .filter(Boolean)
            .join(' · ') || undefined
        }
      />
      <Fact
        testId="supplier-request-where"
        label={t('supplier.requests.facts.where')}
        value={place}
        note={request.address ?? (request.contactDisclosed || over ? undefined : t('supplier.requests.facts.addressAfterTake'))}
      />
      <Fact
        testId="supplier-request-client"
        label={t('supplier.requests.facts.client')}
        value={request.clientName || t('supplier.requests.facts.clientUnknown')}
        note={t(showcase ? 'supplier.requests.facts.fromShowcase' : 'supplier.requests.facts.fromHost')}
      />
      <Fact
        testId="supplier-request-price"
        label={t('supplier.requests.facts.price')}
        value={price !== null ? formatMoney(price, i18n.language) : t('supplier.requests.facts.priceTbd')}
        note={net !== null ? t('supplier.requests.facts.net', { amount: formatMoney(net, i18n.language) }) : undefined}
      />
    </dl>
  );
}

/* ------------------------------------------------------------------------------------------------ Dettagli e storia */

/** A part of the page that opens on request: the title and a line under it, the content below. Native `details`: keyboard and screen reader for free. */
function MoreGroup({ title, sub, open, testId, children }: { title: string; sub?: string; open?: boolean; testId: string; children: ReactNode }) {
  return (
    <details open={open} className="group" data-testid={testId}>
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block break-words font-semibold">{title}</span>
          {sub ? <span className="block break-words text-sm text-foreground/70">{sub}</span> : null}
        </span>
        <ChevronDown aria-hidden="true" className="size-5 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
      </summary>
      <div className="space-y-2 px-4 pb-4 text-sm">{children}</div>
    </details>
  );
}

/** A label and its value. `tall` is for a value that is a link of a finger's height: the label is centred on it. */
function Row({ label, children, testId, tall = false }: { label: string; children: ReactNode; testId?: string; tall?: boolean }) {
  return (
    <div className={cn('grid gap-x-4 gap-y-0.5 sm:grid-cols-[11rem_1fr]', tall && 'sm:items-center')}>
      <dt className="text-foreground/70">{label}</dt>
      <dd className="min-w-0 break-words font-medium" data-testid={testId}>
        {children}
      </dd>
    </div>
  );
}

const PAYMENT_STATUSES = new Set(['Requested', 'Processing', 'Paid', 'Failed', 'PartiallyRefunded', 'Refunded', 'NeedsReview']);

function JobGroup({ request, open }: { request: SupplierServiceRequest; open: boolean }) {
  const { t, i18n } = useTranslation();
  return (
    <MoreGroup testId="supplier-request-job" title={t('supplier.requests.job.title')} sub={t('supplier.requests.job.sub')} open={open}>
      <dl className="space-y-2">
        <Row label={t('supplier.requests.job.service')}>{requestTitle(request, t)}</Row>
        {request.propertyName ? <Row label={t('supplier.requests.job.property')}>{request.propertyName}</Row> : null}
        <Row label={t('supplier.requests.job.urgency')}>{t(URGENCY_KEYS[request.urgency] ?? URGENCY_KEYS.Normal)}</Row>
        {request.stay ? (
          <Row label={t('supplier.requests.job.stay')} testId="supplier-request-stay">
            {t('supplier.requests.job.stayDates', { from: formatStayDate(request.stay.checkIn, i18n.language), to: formatStayDate(request.stay.checkOut, i18n.language) })}
          </Row>
        ) : null}
        {request.notes ? (
          <Row label={t('supplier.requests.job.notes')} testId="supplier-request-notes">
            <span className="whitespace-pre-line">{request.notes}</span>
          </Row>
        ) : null}
      </dl>
      {!request.stay && request.rentalContext === 'LongRent' ? <p className="text-foreground/70">{t('supplier.requests.job.longRent')}</p> : null}
    </MoreGroup>
  );
}

function ContactGroup({ request, open }: { request: SupplierServiceRequest; open: boolean }) {
  const { t } = useTranslation();
  const contact = request.hostContact;
  const phase = phaseOf(request);
  // A request that was refused or cancelled before the take never gave its contact: it is not "after you accept" any more.
  const closed = !request.contactDisclosed && (phase === 'rejected' || phase === 'cancelled');
  let content: ReactNode;
  if (request.contactDisclosed) {
    content = (
      <dl className="space-y-2">
        {request.address ? <Row label={t('supplier.requests.contact.address')} testId="supplier-request-address">{request.address}</Row> : null}
        {contact?.name ? <Row label={t('supplier.requests.contact.name')} testId="supplier-request-host-name">{contact.name}</Row> : null}
        {contact?.phone ? (
          <Row label={t('supplier.requests.contact.phone')} tall>
            <a href={`tel:${contact.phone.replace(/\s+/g, '')}`} className="inline-flex min-h-11 items-center gap-1 underline" data-testid="supplier-request-host-phone">
              <Phone aria-hidden="true" className="size-4" />
              {contact.phone}
            </a>
          </Row>
        ) : null}
        {contact?.email ? (
          <Row label={t('supplier.requests.contact.email')} tall>
            <a href={`mailto:${contact.email}`} className="inline-flex min-h-11 items-center gap-1 underline" data-testid="supplier-request-host-email">
              <Mail aria-hidden="true" className="size-4" />
              {contact.email}
            </a>
          </Row>
        ) : null}
        {!contact?.phone && !contact?.email ? <p className="text-foreground/70">{t('supplier.requests.contact.none')}</p> : null}
      </dl>
    );
  } else {
    content = (
      <p className="flex items-start gap-2 text-foreground/70" data-testid="supplier-request-contact-hidden">
        <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <span>{t(closed ? 'supplier.requests.contact.closed' : 'supplier.requests.contact.afterTake')}</span>
      </p>
    );
  }
  return (
    <MoreGroup
      testId="supplier-request-contact"
      title={t('supplier.requests.contact.title')}
      sub={t(request.contactDisclosed ? 'supplier.requests.contact.subShown' : closed ? 'supplier.requests.contact.subClosed' : 'supplier.requests.contact.subHidden')}
      open={open}
    >
      {content}
    </MoreGroup>
  );
}

/** What the server says about the payment of a completed job, as it says it: the amounts, the state, no date promised. */
function PaymentGroup({ request }: { request: SupplierServiceRequest }) {
  const { t, i18n } = useTranslation();
  const payment = request.payment;
  if (!payment) return null;
  const money = (cents: number | null | undefined) => (cents === null || cents === undefined ? null : formatMoney(cents, i18n.language));
  const status = payment.status ? (PAYMENT_STATUSES.has(payment.status) ? payment.status : 'unknown') : null;
  const commission = money(payment.commissionCents);

  return (
    <MoreGroup
      testId="supplier-request-payment"
      title={t('supplier.requests.payment.title')}
      sub={money(payment.netCents) ? t('supplier.requests.payment.subNet', { amount: money(payment.netCents) }) : undefined}
      open={Boolean(payment.late || payment.needsAmountConfirmation)}
    >
      <dl className="space-y-2">
        {money(payment.amountCents) ? <Row label={t('supplier.requests.payment.amount')}>{money(payment.amountCents)}</Row> : null}
        {commission ? (
          <Row label={t('supplier.requests.payment.commission')}>
            {payment.commissionPercent ? `${commission} (${payment.commissionPercent} %)` : commission}
          </Row>
        ) : null}
        {money(payment.netCents) ? <Row label={t('supplier.requests.payment.net')}>{money(payment.netCents)}</Row> : null}
        {status ? <Row label={t('supplier.requests.payment.state')} testId="supplier-request-payment-state">{t(`supplier.requests.payment.status.${status}`)}</Row> : null}
        {payment.paidAt ? <Row label={t('supplier.requests.payment.paidAt')}>{formatRomeDateTime(payment.paidAt, i18n.language, { day: 'numeric', month: 'long', year: 'numeric' })}</Row> : null}
      </dl>
      {payment.late ? <p className="font-medium">{t('supplier.requests.payment.late')}</p> : null}
      {payment.needsAmountConfirmation ? <p className="font-medium">{t('supplier.requests.now.amountToConfirm')}</p> : null}
    </MoreGroup>
  );
}

const HISTORY_TONES: Record<ServiceRequestStatus, TimelineTone> = {
  Richiesto: 'info',
  PresoInCarico: 'success',
  InCorso: 'info',
  Completato: 'success',
  Pagato: 'success',
  Rifiutato: 'neutral',
  Annullato: 'warning',
};

const HISTORY_KEYS: Record<ServiceRequestStatus, string> = {
  Richiesto: 'supplier.requests.history.Richiesto',
  PresoInCarico: 'supplier.requests.history.PresoInCarico',
  InCorso: 'supplier.requests.history.InCorso',
  Completato: 'supplier.requests.history.Completato',
  Pagato: 'supplier.requests.history.Pagato',
  Rifiutato: 'supplier.requests.history.Rifiutato',
  Annullato: 'supplier.requests.history.Annullato',
};

/** What happened to the request, in the words of the supplier: "Hai accettato la richiesta", with who did it and the reason of a refusal. */
function historyEvents(history: readonly ServiceRequestHistoryEntry[], t: (key: string, options?: Record<string, unknown>) => string): TimelineEvent[] {
  return history.map((entry, index) => {
    const byClient = entry.actor === 'Host' || entry.actor === 'Customer';
    // The step the server wrote by itself: the supplier turned on the automatic acceptance of its regular hosts (SP-04d).
    const automatic = entry.status === 'PresoInCarico' && entry.actor === 'System';
    const key = automatic
      ? 'supplier.requests.history.PresoInCaricoAuto'
      : entry.status === 'Annullato' && entry.actor === 'Supplier'
        ? 'supplier.requests.history.AnnullatoBySupplier'
        : entry.status === 'Annullato' && entry.actor === 'System'
          ? 'supplier.requests.history.AnnullatoBySystem'
          : HISTORY_KEYS[entry.status];
    return {
      id: `${entry.status}-${index}`,
      at: entry.at,
      // A status this version does not know (the server is newer) is shown as it came, never as a key.
      title: key ? t(key) : entry.status,
      description: automatic ? t('supplier.requests.history.PresoInCaricoAutoNote') : (reasonText(entry.reason, t) ?? undefined),
      actor: byClient ? t('supplier.requests.actor.client') : entry.actor === 'System' ? t('supplier.requests.actor.system') : (entry.actorName ?? t('supplier.requests.actor.you')),
      tone: HISTORY_TONES[entry.status] ?? 'neutral',
    };
  });
}

/** The history of the request, the latest step first. */
export function RequestHistory({ request, limit }: { request: SupplierServiceRequestDetail; limit?: number }) {
  const { t } = useTranslation();
  return <Timeline testId="supplier-request-history" label={t('supplier.requests.history.label')} events={historyEvents(request.history ?? [], t)} limit={limit} />;
}

/**
 * The rest, one click away: the job (service, urgency, notes), the address and the contact (after the take), the payment when there is
 * one, and the history. A request that waits for the answer opens the job, one that is taken opens the contact.
 */
export function RequestDetails({ request }: { request: SupplierServiceRequestDetail }) {
  const { t } = useTranslation();
  const phase = phaseOf(request);
  return (
    <div className="divide-y overflow-hidden rounded-xl bg-card ring-1 ring-inset ring-border" data-testid="supplier-request-details">
      <JobGroup request={request} open={phase === 'toAnswer'} />
      <ContactGroup request={request} open={phase === 'scheduled' || phase === 'inProgress'} />
      <PaymentGroup request={request} />
      <MoreGroup testId="supplier-request-history-group" title={t('supplier.requests.history.title')} sub={t('supplier.requests.history.sub')}>
        <RequestHistory request={request} />
      </MoreGroup>
    </div>
  );
}
