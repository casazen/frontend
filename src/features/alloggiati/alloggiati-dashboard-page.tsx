import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Info } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { FocusBlock, PlainSection } from '@/components/shared/calm';
import { ErrorState } from '@/components/shared/error-state';
import { StatusBadge } from '@/components/shared/status/status-badge';
import { SkeletonCard, SkeletonLine } from '@/components/ui/skeleton';
import { ComplianceRow } from '@/features/compliance/components/compliance-row';
import { NoteLine } from '@/features/dashboard/components/note-line';
import { urgencyOf, type RowNote } from '@/features/dashboard/lib/home-model';
import { useAlloggiatiSummary } from '@/queries/use-alloggiati';
import type { AlloggiatiSummaryDto } from '@/types/alloggiati.types';
import { MarkSentManuallyButton } from './components/resend-button';
import { formatRecordDate, isAlloggiatiSent } from './alloggiati-status.utils';

const bookingPath = (row: AlloggiatiSummaryDto) => `/app/short-rent/bookings/${row.bookingId}?tab=alloggiati`;

/** What comes first: a communication that failed, then one to send, then the ones that wait for the arrival day, and last the sent ones. */
function rank(row: AlloggiatiSummaryDto): number {
  if (row.status === 'Errore' || row.status === 'Rifiutato') return 0;
  if (row.status === 'DaInviareManualmente') return 1;
  return isAlloggiatiSent(row.status) ? 3 : 2;
}

function deadlineTime(row: AlloggiatiSummaryDto): number {
  const time = new Date(row.deadlineAt).getTime();
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
}

/** Most pressing first: by kind, then what is past its deadline, then the nearest deadline. */
function byUrgency(a: AlloggiatiSummaryDto, b: AlloggiatiSummaryDto): number {
  return rank(a) - rank(b) || Number(b.isOverdue) - Number(a.isOverdue) || deadlineTime(a) - deadlineTime(b);
}

/** Until when, from the deadline the backend works out (24 hours from arrival, 6 if the stay is short): it is never worked out here. */
function deadlineNote(row: AlloggiatiSummaryDto, context: { t: TFunction; locale: string }): RowNote {
  const note = urgencyOf(row.deadlineAt, context);
  return row.isShortStay ? { ...note, text: `${note.text} (${context.t('alloggiati.shortStayTerm')})` } : note;
}

/**
 * The communications to the Questura: the one that needs the host first, with the button that takes to its data, then one row
 * per stay with its state, its deadline and the button that declares it sent. CasaZen sends nothing: the host sends on the
 * portal and says so here.
 */
export function AlloggiatiDashboardPage() {
  const { t, i18n } = useTranslation();
  const { data, isLoading, isError, error, refetch } = useAlloggiatiSummary();
  const rows = useMemo(() => (Array.isArray(data) ? [...data].sort(byUrgency) : []), [data]);
  const context = { t, locale: i18n.language };

  const actionable = rows.filter((row) => rank(row) <= 1);
  const focus = actionable[0];
  const failed = focus ? rank(focus) === 0 : false;

  return (
    <AppShell>
      <div className="space-y-6 md:space-y-8" data-testid="alloggiati-dashboard">
        <PageHeader title={t('alloggiati.title')} description={t('alloggiati.description')} crumbs="auto" />

        {isError && !data ? (
          <ErrorState title={t('alloggiati.summaryError')} error={error} onRetry={() => void refetch()} testId="alloggiati-dashboard-error" />
        ) : isLoading ? (
          <>
            <SkeletonCard lines={3} label={t('alloggiati.loading')} />
            <SkeletonLine lines={4} />
          </>
        ) : (
          <>
            {focus ? (
              <FocusBlock
                tone={failed || focus.isOverdue ? 'danger' : 'warning'}
                kicker={t('compliance.cockpit.kicker')}
                title={t(failed ? 'alloggiati.focus.fix' : 'alloggiati.focus.send', { name: focus.guestName })}
                body={[focus.propertyName, `${t('alloggiati.checkIn')} ${formatRecordDate(focus.checkInDate)}`, focus.dataComplete ? null : t('alloggiati.incompleteData')]
                  .filter(Boolean)
                  .join(' · ')}
                when={focus.isOverdue ? t('alloggiati.overdue') : deadlineNote(focus, context).text}
                then={actionable.length > 1 ? t('alloggiati.focus.then', { count: actionable.length - 1 }) : undefined}
                primary={{
                  label: t(failed ? 'dashboard.todo.ResolveAlloggiatiFailure.cta' : 'dashboard.todo.SendAlloggiati.cta'),
                  href: bookingPath(focus),
                  ariaLabel: `${t(failed ? 'dashboard.todo.ResolveAlloggiatiFailure.cta' : 'dashboard.todo.SendAlloggiati.cta')}: ${focus.guestName}`,
                  testId: 'alloggiati-focus-cta',
                }}
                data-testid="alloggiati-focus"
              />
            ) : (
              <FocusBlock
                tone="success"
                title={t('alloggiati.focus.ok.title')}
                body={t(rows.some((row) => rank(row) === 2) ? 'alloggiati.waitingArrivalNotice' : 'alloggiati.noPendingReport')}
                primary={{ label: t('alloggiati.focus.ok.cta'), href: '/app/short-rent/bookings', testId: 'alloggiati-focus-cta' }}
                data-testid="alloggiati-focus"
              />
            )}

            {rows.length > 0 ? (
              <PlainSection title={t('alloggiati.list.title')} count={rows.length}>
                <ul role="list" className="divide-y divide-border border-y border-border">
                  {rows.map((row) => (
                    <ComplianceRow
                      key={row.bookingId}
                      testId={`alloggiati-row-${row.bookingId}`}
                      title={row.guestName}
                      to={bookingPath(row)}
                      sub={`${row.propertyName} · ${t('alloggiati.checkIn')} ${formatRecordDate(row.checkInDate)}`}
                      detail={row.dataComplete ? undefined : t('alloggiati.incompleteData')}
                      badge={<StatusBadge kind="alloggiati" status={row.status} data-testid="alloggiati-status-badge" />}
                      note={
                        isAlloggiatiSent(row.status) ? undefined : row.isOverdue ? (
                          <span data-testid="alloggiati-overdue-badge">
                            <NoteLine note={{ text: t('alloggiati.overdue'), tone: 'danger' }} />
                          </span>
                        ) : (
                          <NoteLine note={deadlineNote(row, context)} />
                        )
                      }
                      action={<MarkSentManuallyButton bookingId={row.bookingId} status={row.status} checkInDate={row.checkInDate} />}
                    />
                  ))}
                </ul>
              </PlainSection>
            ) : null}

            <p className="flex items-start gap-2 text-sm text-foreground/70" data-testid="alloggiati-manual-banner">
              <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span className="min-w-0 break-words">{t('alloggiati.manualBanner')}</span>
            </p>
          </>
        )}
      </div>
    </AppShell>
  );
}
