import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, ChevronRight, type LucideIcon } from 'lucide-react';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { useDetailDrawer } from '@/components/shared/detail-drawer/use-detail-drawer';
import { UnreadMessagesBadge } from '@/components/shared/unread-messages-badge';
import { Button } from '@/components/ui/button';
import { useApproveBookingRequest, useDeclineBookingRequest } from '@/queries/use-bookings';
import { useRefreshDashboard } from '@/queries/use-dashboard';
import { cn } from '@/lib/utils';
import type { HomeRow, RowAction } from '../lib/home-model';
import { NoteLine } from './note-line';

// At least 44 px high on every device, and a long label wraps instead of pushing the page sideways (the calm blocks' rule).
const TOUCH = 'h-auto min-h-11 whitespace-normal py-2 text-center leading-tight';
const OPEN =
  'group/open flex min-h-11 min-w-0 flex-col justify-center rounded-md text-left outline-hidden ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

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

function RowActionControl({ action, name }: { action: RowAction; name: string }) {
  const { t } = useTranslation();
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
    case 'respond':
      return <RespondButtons action={action} name={name} />;
  }
}

interface HomeRowItemProps {
  row: HomeRow;
  icon?: LucideIcon;
  /** The deadline above the title ("Da fare"), instead of under it. */
  noteFirst?: boolean;
  className?: string;
}

export function HomeRowItem({ row, icon: Icon, noteFirst = false, className }: HomeRowItemProps) {
  const { t } = useTranslation();
  const drawer = useDetailDrawer();
  const { search } = useLocation();
  const note = row.note ? <NoteLine note={row.note} /> : null;
  const done = row.done === true;

  if (row.kind === 'arrivals') {
    return (
      <li data-testid="home-row" data-kind={row.kind} data-done={done || undefined}>
        <Link
          to={row.to}
          state={{ arrivalsSearch: search }}
          className={cn('group grid min-h-11 gap-1 rounded-md py-3 hover:bg-muted/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-x-4', className)}
        >
          <span className="min-w-0 space-y-1">
            <span className="flex items-center gap-2 break-words font-semibold">
              {Icon ? <Icon aria-hidden="true" className="size-5 shrink-0 text-primary-text" /> : null}
              {row.title}
            </span>
            <span className="block break-words text-sm text-foreground/75">{row.sub}</span>
            {note}
          </span>
          <span className="inline-flex items-center gap-1 self-center text-sm font-semibold text-primary-text group-hover:underline">
            {t('dashboard.today.action.openCheckIn')}<ChevronRight aria-hidden="true" className="size-4" />
          </span>
        </Link>
      </li>
    );
  }

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
          <span className={cn('block break-words font-semibold group-hover/open:underline', done && 'text-foreground/70')}>
            {row.title}
            {row.unread ? <UnreadMessagesBadge count={row.unread} className="ml-2 align-middle" /> : null}
          </span>
          {row.sub ? <span className="block break-words text-sm text-foreground/70">{row.sub}</span> : null}
        </Link>
        {noteFirst ? null : note}
      </div>

      {row.action ? (
        <div className={cn('flex flex-wrap items-center gap-2 pt-1 sm:justify-end sm:pt-0', Icon ? 'col-start-2 sm:col-start-3' : 'col-start-1 sm:col-start-2')}>
          <RowActionControl action={row.action} name={row.subject ?? row.title} />
        </div>
      ) : null}
    </li>
  );
}
