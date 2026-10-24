import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Euro, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/page-header';
import { StatStrip, StatTile } from '@/components/shared/calm';
import { EmptyState } from '@/components/shared/empty-state';
import { ListView } from '@/components/shared/list-view/list-view';
import { useListState } from '@/components/shared/list-view/use-list-state';
import { useWorkspace } from '@/hooks/use-workspace';
import { useHeldKeys } from '@/lib/hold-for-undo';
import { todayInRome } from '@/lib/stay-dates';
import { cn, formatCurrency } from '@/lib/utils';
import { useLeases } from '@/queries/use-leases';
import { useRentRegister } from '@/queries/use-rent-register';
import type { RentRegisterPage, RentRegisterRow } from '@/types';
import { RecordRentPaymentDialog } from './components/record-rent-payment-dialog';
import { RentMonthPicker } from './components/rent-month-picker';
import { RentReminderDialog } from './components/rent-reminder-dialog';
import { isRentMonth, monthName, monthOfDate, rentStatusOfChip } from './lib/rent-register';
import { useRentsList } from './rents-list';

const RENTS_PATH = '/app/long-rent/rents';
const LEASE_CREATE_PATH = '/app/long-rent/leases/new';
const PAGE_SIZE = 25;
const NO_ROWS: readonly RentRegisterRow[] = [];

/** The address of the register for a month and a quick filter; the month in the address is only written when it is not this one. */
function rentsHref(month: string, currentMonth: string, chip?: string): string {
  const params = new URLSearchParams();
  if (month !== currentMonth) params.set('mese', month);
  if (chip) params.set('chip', chip);
  const query = params.toString();
  return query ? `${RENTS_PATH}?${query}` : RENTS_PATH;
}

/**
 * The three numbers of the month, from the counters of the whole month (they do not change with the quick filter or the page):
 * what came in against what was expected, what is late, and what is still to come. Each one leads to the installments it is made of.
 */
function RentMonthNumbers({ data, month, currentMonth, dimmed }: { data: RentRegisterPage; month: string; currentMonth: string; dimmed: boolean }) {
  const { t, i18n } = useTranslation();
  const { counters } = data;
  const euros = (amount: number) => formatCurrency(amount);
  const late = counters.overdue.count > 0;

  return (
    <StatStrip label={t('longRentRents.stats.label')} className={cn('transition-opacity', dimmed && 'opacity-60')} data-testid="rents-numbers">
      <StatTile
        label={t('longRentRents.stats.collected', { month: monthName(month, i18n.language, false) })}
        value={euros(counters.collected.amount)}
        delta={t('longRentRents.stats.collectedDelta', {
          count: counters.expected.count,
          paid: counters.collected.count,
          expected: euros(counters.expected.amount),
        })}
        href={rentsHref(month, currentMonth, 'paid')}
        data-testid="rents-numbers-collected"
      />
      <StatTile
        label={t('longRentRents.stats.overdue')}
        value={euros(counters.overdue.amount)}
        tone={late ? 'danger' : 'neutral'}
        delta={late ? t('longRentRents.stats.overdueDelta', { count: counters.overdue.count }) : t('longRentRents.stats.noOverdue')}
        href={rentsHref(month, currentMonth, 'overdue')}
        data-testid="rents-numbers-overdue"
      />
      <StatTile
        label={t('longRentRents.stats.pending')}
        value={euros(counters.pending.amount)}
        delta={
          counters.pending.count > 0
            ? t('longRentRents.stats.pendingDelta', { count: counters.pending.count })
            : t('longRentRents.stats.nothingPending')
        }
        href={rentsHref(month, currentMonth, 'pending')}
        data-testid="rents-numbers-pending"
      />
    </StatStrip>
  );
}

/**
 * Canoni (LR-04b): who has paid, who still has to and who is late, month by month. The month is in the address (`?mese=2026-10`),
 * the quick filter and the page are the list's (`?chip=overdue&page=2`), and the numbers of the month come from the server, whole,
 * whatever the filter. The landlord declares a payment received (a window of its own) and sends a reminder to a tenant who is late
 * (another one): nothing is written to anyone unless they press the button, and an e-mail waits six seconds with an «Annulla».
 * Who may only read the leases sees the register and no button.
 */
export function RentsPage() {
  const { t } = useTranslation();
  const { hasPermission } = useWorkspace();
  const canManage = hasPermission('long-rent', 'lease.create');
  const held = useHeldKeys();

  const [params, setParams] = useSearchParams();
  const currentMonth = monthOfDate(todayInRome());
  const requestedMonth = params.get('mese');
  const month = isRentMonth(requestedMonth) ? requestedMonth : currentMonth;

  const [reminding, setReminding] = useState<RentRegisterRow | null>(null);
  const [recording, setRecording] = useState<{ row: RentRegisterRow | null } | null>(null);
  const recordRow = useCallback((row: RentRegisterRow) => setRecording({ row }), []);

  const list = useRentsList({ canManage, held, onRecord: recordRow, onRemind: setReminding });
  const { state } = useListState(list);
  const status = rentStatusOfChip(state.chip);

  const register = useRentRegister({ month, status, page: state.page, pageSize: PAGE_SIZE });
  const data = register.data;
  const rows = data?.items ?? NO_ROWS;
  // The numbers belong to the month the server answered for (the rows of the last month stay a moment while the next one comes).
  const shownMonth = data && isRentMonth(data.month) ? data.month : month;

  // «No rent this month» is not «no contract at all»: the second one starts the person on the first contract.
  const monthIsEmpty = !!data && !register.isPlaceholderData && data.total === 0 && status === 'All';
  const leases = useLeases(undefined, { enabled: monthIsEmpty });
  const noContracts = monthIsEmpty && leases.isSuccess && leases.data.length === 0;

  const goToMonth = (next: string) => {
    const copy = new URLSearchParams(params);
    if (next === currentMonth) copy.delete('mese');
    else copy.set('mese', next);
    copy.delete('page');
    setParams(copy, { preventScrollReset: true });
  };

  return (
    <div className="min-w-0 space-y-6" data-testid="rents-page">
      <PageHeader
        title={t('nav.rents')}
        description={t('longRentRents.description')}
        crumbs="auto"
        primary={
          canManage
            ? { label: t('longRentRents.actions.recordNew'), icon: Plus, onClick: () => setRecording({ row: null }), testId: 'rents-record-new' }
            : undefined
        }
        mobilePrimary="fab"
      />

      <RentMonthPicker month={month} currentMonth={currentMonth} onChange={goToMonth} />

      {data && !register.isError && !noContracts ? (
        <RentMonthNumbers data={data} month={shownMonth} currentMonth={currentMonth} dimmed={register.isPlaceholderData} />
      ) : null}

      {noContracts ? (
        <div className="rounded-lg border bg-card" data-testid="rents-no-contracts">
          <EmptyState
            icon={Euro}
            title={t('longRentRents.empty.noContractsTitle')}
            description={t('longRentRents.empty.noContractsDescription')}
            action={canManage ? { label: t('longRentRents.empty.noContractsAction'), href: LEASE_CREATE_PATH } : undefined}
          />
        </div>
      ) : (
        <ListView<RentRegisterRow>
          list={list}
          mode="server"
          rows={rows}
          totalCount={data?.total}
          pageSize={PAGE_SIZE}
          isLoading={register.isLoading}
          isRefreshing={register.isPlaceholderData}
          isError={register.isError && !register.isLoading}
          error={register.error}
          errorTitle={t('longRentRents.loadError')}
          onRetry={() => void register.refetch()}
          chipCounts={{ overdue: data?.counters.overdue.count }}
          testId="rents-list"
        />
      )}

      {reminding ? (
        <RentReminderDialog
          key={reminding.id}
          row={reminding}
          onlinePaymentsAvailable={data?.onlinePaymentsAvailable ?? false}
          intervalHours={data?.reminderIntervalHours ?? 24}
          onClose={() => setReminding(null)}
        />
      ) : null}

      {recording ? (
        <RecordRentPaymentDialog key={recording.row?.id ?? 'choose'} row={recording.row ?? undefined} onClose={() => setRecording(null)} />
      ) : null}
    </div>
  );
}
