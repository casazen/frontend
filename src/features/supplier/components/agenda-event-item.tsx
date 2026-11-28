import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { AlertCircle, AlertTriangle, Ban, CalendarClock, CheckCircle2, DoorOpen, Lock, Moon, Plane, Wrench, type LucideIcon } from 'lucide-react';
import { StatusBadge } from '@/components/shared/status/status-badge';
import { getServiceCategoryLabel } from '@/lib/i18n-labels';
import { cn } from '@/lib/utils';
import type { ServiceRequestStatus } from '@/types/service-request';
import type { SupplierConflictSeverity } from '@/types/supplier';
import { requestPath } from '../requests/request-model';
import { DAY_STATE_LABEL_KEYS, type DayEvent, type DayEventKind, type DayState } from '../lib/supplier-agenda';

// Each kind of entry has its icon, its color and its name, so that none is told apart by color alone.
const KINDS: Record<DayEventKind, { icon: LucideIcon; labelKey: string; tone: string }> = {
  guestOrder: { icon: Wrench, labelKey: 'supplier.eventGuestOrder', tone: 'bg-primary-soft text-primary-text' },
  request: { icon: Wrench, labelKey: 'supplier.eventRequest', tone: 'bg-primary-soft text-primary-text' },
  calendar: { icon: CalendarClock, labelKey: 'supplier.eventFromCalendar', tone: 'bg-muted text-foreground' },
  block: { icon: Lock, labelKey: 'supplier.eventBlock', tone: 'bg-muted text-foreground' },
  extra: { icon: DoorOpen, labelKey: 'supplier.eventExtraOpening', tone: 'bg-success-soft text-success-foreground' },
  timeOff: { icon: Plane, labelKey: 'supplier.eventTimeOff', tone: 'bg-info-soft text-info-foreground' },
};

const TIME_OFF_REASONS = ['Vacation', 'Holiday', 'Illness', 'Other'];

function eventTitle(event: DayEvent, t: TFunction): string {
  if (event.kind === 'request') return event.serviceName?.trim() || getServiceCategoryLabel(event.label, t);
  if (event.label) return event.label;
  if (event.kind === 'timeOff' && event.reason && TIME_OFF_REASONS.includes(event.reason)) {
    return t(`supplier.agenda.reasons.${event.reason}`);
  }
  return t(KINDS[event.kind].labelKey);
}

function eventSubtitle(event: DayEvent, t: TFunction): string {
  const kind = t(KINDS[event.kind].labelKey);
  if (event.kind !== 'request') return kind;
  return [kind, event.clientLabel?.trim(), event.comune?.trim(), event.fromShowcase ? t('supplier.agenda.fromShowcase') : null]
    .filter(Boolean)
    .join(' · ');
}

function ConflictPill({ severity }: { severity: SupplierConflictSeverity }) {
  const { t } = useTranslation();
  const danger = severity === 'danger';
  const Icon = danger ? AlertCircle : AlertTriangle;
  return (
    <span
      data-testid="availability-event-conflict"
      data-severity={severity}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset',
        danger ? 'bg-danger-soft text-danger-foreground ring-danger-border' : 'bg-warning-soft text-warning-foreground ring-warning-border',
      )}
    >
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      {t(danger ? 'supplier.agenda.conflicts.danger' : 'supplier.agenda.conflicts.warning')}
    </span>
  );
}

interface AgendaEventItemProps {
  event: DayEvent;
  layout: 'row' | 'stack';
}

export function AgendaEventItem({ event, layout }: AgendaEventItemProps) {
  const { t } = useTranslation();
  const meta = KINDS[event.kind];
  const Icon = meta.icon;
  const time = event.timeRange ?? t('supplier.allDay');

  const body =
    layout === 'row' ? (
      <>
        <span aria-hidden="true" className={cn('mt-0.5 grid size-7 shrink-0 place-items-center rounded-full', meta.tone)}>
          <Icon className="size-4" />
        </span>
        <span className="min-w-0">
          <span className="block break-words font-medium first-letter:uppercase">{eventTitle(event, t)}</span>
          <span className="block break-words text-sm text-foreground/70 first-letter:uppercase">{eventSubtitle(event, t)}</span>
        </span>
      </>
    ) : (
      <span className="min-w-0">
        <span className="block break-words text-sm font-medium first-letter:uppercase">{eventTitle(event, t)}</span>
        <span className="mt-0.5 flex items-center gap-1 text-xs text-foreground/70">
          <Icon aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="min-w-0 break-words first-letter:uppercase">{eventSubtitle(event, t)}</span>
        </span>
      </span>
    );
  const target = event.guestOrderId ? `/app/supplier/inbox#guest-order-${event.guestOrderId}` : event.requestId ? requestPath(event.requestId) : null;
  const content = target ? (
    <Link
      to={target}
      className="flex min-h-11 min-w-0 items-start gap-2 rounded-md py-1 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {body}
    </Link>
  ) : (
    <div className="flex min-w-0 items-start gap-2 py-1">{body}</div>
  );
  const status =
    event.kind === 'request' && event.status ? (
      <StatusBadge kind="request" status={event.status as ServiceRequestStatus} perspective="supplier" />
    ) : null;
  const flags =
    status || event.conflict ? (
      <div className="flex flex-wrap items-center gap-2">
        {event.conflict ? <ConflictPill severity={event.conflict} /> : null}
        {status}
      </div>
    ) : null;
  const timeClass = 'font-semibold tabular-nums text-foreground/70 first-letter:uppercase';

  if (layout === 'row') {
    return (
      <li
        data-testid={`availability-event-${event.kind}`}
        className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 gap-y-1 py-2 sm:grid-cols-[6.5rem_minmax(0,1fr)_auto] sm:items-center"
      >
        <p className={cn('pt-2 text-sm', timeClass)}>{time}</p>
        {content}
        {flags ? <div className="col-start-2 sm:col-start-3">{flags}</div> : null}
      </li>
    );
  }
  return (
    <li data-testid={`availability-event-${event.kind}`} className="space-y-0.5 py-2">
      <p className={cn('text-xs', timeClass)}>{time}</p>
      {content}
      {flags}
    </li>
  );
}

const STATES: Record<DayState, { icon: LucideIcon; tone: string }> = {
  open: { icon: CheckCircle2, tone: 'text-success-foreground' },
  rest: { icon: Moon, tone: 'text-foreground/70' },
  closed: { icon: Ban, tone: 'text-foreground/70' },
  closedByCalendar: { icon: Ban, tone: 'text-foreground/70' },
  timeOff: { icon: Plane, tone: 'text-foreground/70' },
};

export function DayStateLabel({ state }: { state: DayState }) {
  const { t } = useTranslation();
  const { icon: Icon, tone } = STATES[state];
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5 font-semibold', tone)} data-day-state={state}>
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      <span className="min-w-0 break-words">{t(DAY_STATE_LABEL_KEYS[state])}</span>
    </span>
  );
}

export function PendingDayBadge({ date }: { date: string }) {
  const { t } = useTranslation();
  return (
    <span
      data-testid={`availability-pending-${date}`}
      className="inline-flex items-center rounded-full bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning-foreground ring-1 ring-inset ring-warning-border"
    >
      {t('supplier.freeEventPendingBadge')}
    </span>
  );
}
