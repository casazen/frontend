import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, AlertTriangle, Check, CheckCircle2, Clock, Info, type LucideIcon } from 'lucide-react';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { useDetailDrawer } from '@/components/shared/detail-drawer/use-detail-drawer';
import { Button } from '@/components/ui/button';
import { useApproveBookingRequest, useDeclineBookingRequest } from '@/queries/use-bookings';
import { useResendCheckInLink } from '@/queries/use-checkin';
import { useRefreshDashboard } from '@/queries/use-dashboard';
import { cn } from '@/lib/utils';
import type { HomeRow, NoteTone, RowAction, RowNote } from '../lib/home-model';

const NOTE_ICONS: Record<NoteTone, LucideIcon> = { neutral: Clock, info: Info, success: CheckCircle2, warning: AlertTriangle, danger: AlertCircle };
const NOTE_TEXT: Record<NoteTone, string> = {
  neutral: 'text-foreground/70',
  info: 'text-info-foreground',
  success: 'text-success-foreground',
  warning: 'text-warning-foreground',
  danger: 'text-danger-foreground',
};

// At least 44 px high on every device, and a long label wraps instead of pushing the page sideways (the calm blocks' rule).
const TOUCH = 'h-auto min-h-11 whitespace-normal py-2 text-center leading-tight';
// The title and the line under it are one control, as wide as the column and at least 44 px high.
const OPEN =
  'group/open flex min-h-11 min-w-0 flex-col justify-center rounded-md text-left outline-hidden ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

function NoteLine({ note }: { note: RowNote }) {
  const Icon = NOTE_ICONS[note.tone];
  return (
    <span className={cn('inline-flex items-start gap-1.5 text-sm font-medium', NOTE_TEXT[note.tone])}>
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span className="min-w-0 break-words">{note.text}</span>
    </span>
  );
}

/** "Invia link check-in" / "Invia di nuovo": the email goes at once and the toast says what really happened. */
function SendLinkButton({ action, ariaLabel }: { action: Extract<RowAction, { kind: 'sendLink' }>; ariaLabel: string }) {
  const send = useResendCheckInLink(action.bookingId);
  const refresh = useRefreshDashboard();
  return (
    <Button variant="outline" size="sm" className={TOUCH} loading={send.isPending} aria-label={ariaLabel} onClick={() => send.mutate(undefined, { onSettled: refresh })}>
      {action.label}
    </Button>
  );
}

/** Accept a "pay at the property" request, or decline it after a confirmation (the guest is emailed and the dates are released). */
function RespondButtons({ action, name }: { action: Extract<RowAction, { kind: 'respond' }>; name: string }) {
  const { t } = useTranslation();
  const approve = useApproveBookingRequest();
  const decline = useDeclineBookingRequest();
  const refresh = useRefreshDashboard();
  const [declining, setDeclining] = useState(false);
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className={TOUCH}
        loading={approve.isPending}
        aria-label={t('dashboard.row.actionFor', { action: action.label, name })}
        onClick={() => approve.mutate(action.bookingId, { onSettled: refresh })}
      >
        {action.label}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={TOUCH}
        aria-label={t('dashboard.row.actionFor', { action: t('booking.requests.decline'), name })}
        onClick={() => setDeclining(true)}
      >
        {t('booking.requests.decline')}
      </Button>
      <ConfirmationDialog
        open={declining}
        onOpenChange={setDeclining}
        title={t('dashboard.todo.decline.title')}
        description={t('dashboard.todo.decline.description')}
        confirmLabel={t('booking.requests.decline')}
        variant="destructive"
        isLoading={decline.isPending}
        onConfirm={() => decline.mutate({ id: action.bookingId, data: {} }, { onSuccess: () => setDeclining(false), onSettled: refresh })}
      />
    </>
  );
}

function RowActionControl({ action, name, onRegisterArrival }: { action: RowAction; name: string; onRegisterArrival?: (bookingId: string) => void }) {
  const { t } = useTranslation();
  // Several rows say the same ("Registra arrivo"): the name of the guest tells them apart, after the label.
  const ariaLabel = t('dashboard.row.actionFor', { action: action.label, name });
  switch (action.kind) {
    case 'link':
      return (
        <Button asChild variant="outline" size="sm" className={TOUCH}>
          <Link to={action.to} aria-label={ariaLabel}>
            {action.label}
          </Link>
        </Button>
      );
    case 'registerArrival':
      return (
        <Button variant="outline" size="sm" className={TOUCH} aria-label={ariaLabel} onClick={() => onRegisterArrival?.(action.bookingId)}>
          {action.label}
        </Button>
      );
    case 'sendLink':
      return <SendLinkButton action={action} ariaLabel={ariaLabel} />;
    case 'respond':
      return <RespondButtons action={action} name={name} />;
  }
}

interface HomeRowItemProps {
  row: HomeRow;
  /** The icon of the kind of row ("Oggi"); a row without one has no column for it ("Da fare"). */
  icon?: LucideIcon;
  /** The deadline above the title ("Da fare"), instead of under it. */
  noteFirst?: boolean;
  className?: string;
  onRegisterArrival?: (bookingId: string) => void;
}

/**
 * A row of "Oggi" or "Da fare": what it is about (a link to its page, or to its drawer when the booking has one), a line
 * with a tone and, on the right, the one button that does what it asks.
 */
export function HomeRowItem({ row, icon: Icon, noteFirst = false, className, onRegisterArrival }: HomeRowItemProps) {
  const drawer = useDetailDrawer();
  const note = row.note ? <NoteLine note={row.note} /> : null;
  const done = row.done === true;

  return (
    <li
      data-testid="home-row"
      data-kind={row.kind}
      data-done={done || undefined}
      className={cn(
        'grid gap-x-3 gap-y-1 py-3 sm:items-center',
        Icon ? 'grid-cols-[2.25rem_minmax(0,1fr)] sm:grid-cols-[2.25rem_minmax(0,1fr)_auto]' : 'grid-cols-[minmax(0,1fr)] sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-x-4',
        className,
      )}
    >
      {Icon ? (
        <span
          aria-hidden="true"
          className={cn('grid size-9 place-items-center rounded-full', done ? 'bg-success-soft text-success-foreground' : 'bg-muted text-foreground/70')}
        >
          {done ? <Check className="size-[18px]" /> : <Icon className="size-[18px]" />}
        </span>
      ) : null}

      <div className="min-w-0">
        {noteFirst ? note : null}
        <Link
          to={row.to}
          className={OPEN}
          onClick={(event) => {
            // The drawer of the booking, when there is one; otherwise (or on a page without the drawer) the link goes to the page.
            if (row.bookingId && drawer.open('booking', row.bookingId, { opener: event.currentTarget })) event.preventDefault();
          }}
        >
          <span className={cn('block break-words font-semibold group-hover/open:underline', done && 'text-foreground/70')}>{row.title}</span>
          {row.sub ? <span className="block break-words text-sm text-foreground/70">{row.sub}</span> : null}
        </Link>
        {noteFirst ? null : note}
      </div>

      {row.action ? (
        <div className={cn('flex flex-wrap items-center gap-2 pt-1 sm:justify-end sm:pt-0', Icon ? 'col-start-2 sm:col-start-3' : 'col-start-1 sm:col-start-2')}>
          <RowActionControl action={row.action} name={row.subject ?? row.title} onRegisterArrival={onRegisterArrival} />
        </div>
      ) : null}
    </li>
  );
}
