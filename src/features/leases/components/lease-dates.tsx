import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DayList, PlainSection } from '@/components/shared/calm';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SkeletonCard } from '@/components/ui/skeleton';
import { getProblemMessage } from '@/lib/api-errors';
import { todayInRome } from '@/lib/stay-dates';
import { useLongRentDeadlines } from '@/queries/use-long-rent-agenda';
import type { LeaseDetail } from '@/types';
import { agendaWindow, leaseDeadlineRows } from '../deadlines/deadlines-model';
import { leaseSheetPath } from '../lib/lease-next-step';
import { leaseTermFacts } from '../lifecycle/lifecycle-format';

/** A year from today: the most the server answers for, so the end of the period and the last day of notice are in it. */
const WINDOW_DAYS = 366;

/**
 * The dates of this contract (LR-03c), the ones the server keeps for it (`GET /long-rent/deadlines?leaseId=`): the registration and the
 * Questura communication while they are to be done, the end of the period and the last day to give notice, and the rents late or next.
 * Nothing is worked out here: which dates there are, and which are late, is the server's. A renewal by itself is told in words, with no
 * number of months or days (the figures of the law are the legal's to confirm). The panels of the registration and of the Questura stay
 * under it, as they were.
 */
export function LeaseDates({ lease }: { lease: LeaseDetail }) {
  const { t } = useTranslation();
  const agenda = useLongRentDeadlines({ ...agendaWindow(todayInRome(), WINDOW_DAYS), leaseId: lease.id });
  const renews = leaseTermFacts(lease, t).some((fact) => fact.key === 'renews');
  const { rows, moreRents } = useMemo(() => leaseDeadlineRows(agenda.data?.items ?? [], { t }, { renews }), [agenda.data, t, renews]);

  // The rents past the next ones are on the tab of the payments: one quiet way there, only when some were left out.
  const more = moreRents > 0 ? { actionLabel: t('leaseSheet.deadlines.allRents'), href: leaseSheetPath(lease.id, 'pagamenti') } : {};

  return (
    <PlainSection title={t('leaseSheet.deadlines.title')} data-testid="lease-dates" {...more}>
      {agenda.isError ? (
        <Alert
          variant="danger"
          title={t('leaseSheet.deadlines.loadError')}
          data-testid="lease-dates-error"
          action={
            <Button variant="outline" size="sm" onClick={() => void agenda.refetch()} disabled={agenda.isFetching}>
              {t('leases.retry')}
            </Button>
          }
        >
          {getProblemMessage(agenda.error, t)}
        </Alert>
      ) : agenda.data ? (
        rows.length > 0 ? (
          <DayList items={rows} data-testid="lease-dates-list" />
        ) : (
          <p className="text-sm text-foreground/70" data-testid="lease-dates-empty">
            {t('leaseSheet.deadlines.none')}
          </p>
        )
      ) : (
        <SkeletonCard lines={3} label={t('leaseSheet.deadlines.loading')} />
      )}
    </PlainSection>
  );
}
