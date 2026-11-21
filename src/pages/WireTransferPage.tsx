import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { AgencyAccessRefused, AgencyFinanceGate } from '@/components/finance/agency-finance-gate';
import { StaleReadNotice } from '@/components/finance/stale-read-notice';
import { WireAccessLimited } from '@/components/finance/wire-access-limited';
import { WireAmount } from '@/components/finance/wire-amount';
import { WireBatchCard } from '@/components/finance/WireBatchCard';
import {
  isListCapped,
  isPayable,
  ownerIdsOf,
  payableRows,
  readStateOf,
  WIRE_CURRENCIES,
  WIRE_PAYABLE_LIST_CAP,
  withoutIban,
  type PayableRow,
} from '@/components/finance/wire-model';
import { PlainSection } from '@/components/shared/calm';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { ErrorState } from '@/components/shared/error-state';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SkeletonCard } from '@/components/ui/skeleton';
import { OWNER_CLOSE_PATH, ownerFinancialPath, shortId } from '@/features/owner-accounting/owner-accounting-model';
import { useOwnerFormat } from '@/features/owner-accounting/use-owner-format';
import { failureMessage, problemCodeOf } from '@/lib/agency-finance';
import { getHttpStatus } from '@/lib/api-errors';
import { isStayDate, todayInRome } from '@/lib/stay-dates';
import { useCreateBatch, usePayablePayouts, useWireBatches } from '@/queries/wireTransfer';
import type { CreateBatchResponse, WireBatch, WireCurrency } from '@/types';

const NO_BATCHES: readonly WireBatch[] = [];

/** What one request of the last attempt came to: the file the server made for a currency, or its refusal in words (and the owners it lists, by id and name). */
interface Attempt {
  currency: WireCurrency;
  /** The batch as the server answered it; `null` when the server refused. */
  batch: CreateBatchResponse | null;
  message: string;
  code: string | undefined;
  /** The owners the refusal lists: the server sends their ids, the names are the ones the page had for them when the request was made. */
  owners: ReadonlyArray<{ id: string; name: string }>;
}

/** Where the list of the payable payouts of one currency stands: the states of a read, and the refusal of the server (403) as a state of its own. */
type PayableState = 'loading' | 'notFound' | 'error' | 'refused' | 'ready';

/**
 * «Bonifici proprietari» of the Amministrazione (ADR-017, E16/F02/US01/T01): the bank file («file per la banca», ISO 20022) that pays the owners from their CONFIRMED
 * PAYOUTS (the net after the withholding), one file per currency, and the list of the files with their steps. The backend gives it only to the owner and the administrators
 * of an org on the agency plan (`agency.wire.manage`), so the role and the plan are checked before anything is read (`AgencyFinanceGate`). CasaZen makes the file and
 * records what the administrator says; it does not move money and does not know whether the bank executed the transfers. The debit account is the one of the issuer profile
 * of the org (the «Fatturazione» setup): the page never asks for an account and never shows one.
 *
 * What can be chosen comes from the server, one list for each currency (`payable-payouts?currency=CHF` and `...=EUR`, never mixed): the payouts that are confirmed, published
 * to the owner (with a net amount above zero) and in no file yet, the oldest first and at most `WIRE_PAYABLE_LIST_CAP` of them: a list that long says it may not be the whole of
 * what can be paid. A payout that went into a file leaves the list at once and does not come back after a reload (nor in this visit, whatever a list read again says); the
 * refusals of the server stay as the second line of defence. The server says only whether an owner has an IBAN, as a yes or a no: a payout of an owner without one is shown,
 * blocked, with the reason.
 */
export function WireTransferPage() {
  const { t } = useTranslation();
  return (
    <AgencyFinanceGate testId="wire-transfer-page" title={t('wire.title')} description={t('wire.description')} loadingLabel={t('wire.loading')}>
      <WireTransferBody />
    </AgencyFinanceGate>
  );
}

function WireTransferBody() {
  const { t } = useTranslation();
  const format = useOwnerFormat();
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  // The payouts that went into a file in this visit: the page keeps them off the choice even when the list it read again has not come back yet (the server leaves them out
  // of its list as soon as the file exists, and refuses them anyway, `payouts_already_in_batch`, also for the ones another visit or person put in a file).
  const [batchedIds, setBatchedIds] = useState<ReadonlySet<string>>(new Set());
  const [executionDate, setExecutionDate] = useState(() => todayInRome());
  const [confirming, setConfirming] = useState(false);
  // What the person is asked to confirm, as it was when the confirmation opened: the files (one for each currency) and the payouts of each. What they confirm is what is sent,
  // whatever the list does meanwhile, and the dialog does not change under them while the files are made.
  const [planned, setPlanned] = useState<ReadonlyArray<readonly [WireCurrency, readonly string[]]>>([]);
  const [running, setRunning] = useState(false);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  // A request is on its way: the state of the mutation says it a moment later than the click, so a second one in between is stopped here.
  const sending = useRef(false);

  // One read for each currency: the franc page of the list never holds a euro payout, and the other way round.
  const chfQuery = usePayablePayouts('CHF');
  const eurQuery = usePayablePayouts('EUR');
  const batchesQuery = useWireBatches();
  const createBatch = useCreateBatch();
  const payableReads = { CHF: chfQuery, EUR: eurQuery };

  const batches = batchesQuery.data ?? NO_BATCHES;
  const chfRows = useMemo(() => payableRows(chfQuery.data, 'CHF', batchedIds), [chfQuery.data, batchedIds]);
  const eurRows = useMemo(() => payableRows(eurQuery.data, 'EUR', batchedIds), [eurQuery.data, batchedIds]);
  const groups = useMemo(() => {
    const byCurrency: Record<WireCurrency, PayableRow[]> = { CHF: chfRows, EUR: eurRows };
    return WIRE_CURRENCIES.map((currency): [WireCurrency, PayableRow[]] => [currency, byCurrency[currency]]);
  }, [chfRows, eurRows]);
  const ownerName = (ownerId: string, name: string) => name || t('ownerAccounting.owner.unnamed', { id: shortId(ownerId) });

  // What is chosen, by currency: only what a file can pay, and only what is still on the list (a read that took a payout away drops it from the choice).
  const chosenByCurrency = useMemo(() => {
    const byCurrency = new Map<WireCurrency, string[]>();
    for (const [currency, items] of groups) {
      const ids = items.filter((row) => isPayable(row) && selected.has(row.id)).map((row) => row.id);
      if (ids.length > 0) byCurrency.set(currency, ids);
    }
    return byCurrency;
  }, [groups, selected]);
  const chosenCount = [...chosenByCurrency.values()].reduce((sum, ids) => sum + ids.length, 0);

  const today = todayInRome();
  const dateOk = isStayDate(executionDate) && executionDate >= today;
  const busy = running || createBatch.isPending;
  const canCreate = chosenCount > 0 && dateOk && !busy;

  const toggle = (id: string) => {
    if (busy) return;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /** Chooses every payout of a currency that a file can pay, or clears the choice when they are all chosen. */
  const toggleGroup = (items: readonly PayableRow[]) => {
    if (busy) return;
    const payable = items.filter(isPayable);
    const all = payable.length > 0 && payable.every((row) => selected.has(row.id));
    setSelected((current) => {
      const next = new Set(current);
      for (const row of payable) {
        if (all) next.delete(row.id);
        else next.add(row.id);
      }
      return next;
    });
  };

  /**
   * One file for each currency of the choice, in turn, once the person has confirmed. Each request is the server's to accept or refuse as a whole (nothing is saved on a
   * refusal), so a refusal of one currency never stops the other, and what the page tells is only what the server answered: the file it made (never a success it did not
   * confirm) or the refusal in words, with the owners it lists. The payouts of a file the server made leave the choice and the list; after every request, made or refused, the
   * mutation reads the lists again.
   */
  const create = async () => {
    if (sending.current || busy || planned.length === 0 || !dateOk) return;
    sending.current = true;
    setRunning(true);
    setAttempts([]);
    const results: Attempt[] = [];
    // The names of the owners as the page has them now: a refusal lists only their ids.
    const namesById = new Map(groups.flatMap(([, items]) => items.map((row) => [row.ownerId, ownerName(row.ownerId, row.ownerName)] as const)));
    try {
      for (const [currency, ids] of planned) {
        try {
          const batch = await createBatch.mutateAsync({ payoutIds: [...ids], executionDate });
          results.push({ currency, batch, message: '', code: undefined, owners: [] });
          setBatchedIds((current) => new Set([...current, ...ids]));
          setSelected((current) => {
            const next = new Set(current);
            for (const id of ids) next.delete(id);
            return next;
          });
        } catch (error) {
          results.push({
            currency,
            batch: null,
            message: withoutIban(failureMessage(error, t, t('wire.createError', { currency }), t('wire.notFoundPayout'))),
            code: problemCodeOf(error),
            owners: ownerIdsOf(error).map((id) => ({ id, name: namesById.get(id) ?? ownerName(id, '') })),
          });
        } finally {
          createBatch.reset();
        }
      }
    } finally {
      setAttempts(results);
      setRunning(false);
      sending.current = false;
    }
  };

  const openConfirmation = () => {
    setPlanned([...chosenByCurrency.entries()]);
    setConfirming(true);
  };

  const dismissConfirmation = (open: boolean) => {
    // The requests are on their way: the dialog stays until the server has answered them all.
    if (!open && !busy && !sending.current) setConfirming(false);
  };

  const header = <PageHeader title={t('wire.title')} description={t('wire.description')} crumbs="auto" />;

  // The server refuses the list of the files (a 403 the read accepts, so that the app stays here): the access is not there, and nothing of the page is offered.
  if (batchesQuery.data === null) {
    return (
      <div className="space-y-6" data-testid="wire-transfer-page">
        {header}
        <AgencyAccessRefused />
      </div>
    );
  }

  /**
   * Where the list of one currency stands. A refusal (403) is a state of its own and is never an empty list; a 404 is «not found» whatever the cache holds (a failed read keeps
   * the last answer); and a list that failed to refresh and has nothing to show is a failure, never «no payments to make».
   */
  const payableStateOf = (currency: WireCurrency, rows: readonly PayableRow[]): PayableState => {
    const read = payableReads[currency];
    const state = readStateOf(read);
    if (state !== 'ready') return state;
    if (read.data === null) return 'refused';
    return read.isError && rows.length === 0 ? 'error' : 'ready';
  };
  const payableStates: Record<WireCurrency, PayableState> = {
    CHF: payableStateOf('CHF', chfRows),
    EUR: payableStateOf('EUR', eurRows),
  };
  const batchesState = readStateOf(batchesQuery);
  const retryFailed = () => {
    for (const read of [chfQuery, eurQuery, batchesQuery]) if (read.isError) void read.refetch();
  };
  // A failed read with the last answer in memory (a 404 or nothing to show is told in its part): the figures may be out of date.
  const stale =
    WIRE_CURRENCIES.some((currency) => payableStates[currency] === 'ready' && payableReads[currency].isError) ||
    (batchesQuery.isError && Boolean(batchesQuery.data) && getHttpStatus(batchesQuery.error) !== 404);

  const chosenSummary = [...chosenByCurrency.entries()].map(([currency, ids]) => t('wire.chosenCount', { count: ids.length, currency })).join(' · ');

  const composeBody = () => {
    const states = WIRE_CURRENCIES.map((currency) => payableStates[currency]);
    // The server refuses the payouts (403: the caller reaches only some properties): told where the payouts would be, not an empty list and not the page of no access.
    if (states.includes('refused')) return <WireAccessLimited testId="wire-payouts-refused" />;
    if (states.includes('notFound')) return <ErrorState title={t('wire.notFound')} onRetry={retryFailed} />;
    if (states.includes('loading')) return <SkeletonCard lines={4} label={t('wire.loading')} />;

    // A list that could not be read is told, with a way to read it again, never as «no payments to make»: for its own currency when only one failed (the other is still
    // offered), and once for the page when both did.
    const failed = WIRE_CURRENCIES.filter((currency) => payableStates[currency] === 'error');
    const failures =
      failed.length === WIRE_CURRENCIES.length ? (
        <ErrorState
          testId="wire-load-error"
          title={t('wire.loadError')}
          error={payableReads[failed[0]].error}
          onRetry={() => {
            for (const currency of failed) void payableReads[currency].refetch();
          }}
        />
      ) : (
        failed.map((currency) => (
          <ErrorState
            key={currency}
            testId={`wire-load-error-${currency}`}
            title={t('wire.loadErrorCurrency', { currency })}
            error={payableReads[currency].error}
            onRetry={() => void payableReads[currency].refetch()}
          />
        ))
      );
    const shown = groups.filter(([, items]) => items.length > 0);
    if (shown.length === 0) {
      if (failed.length > 0) return <div className="space-y-3">{failures}</div>;
      return (
        <Alert
          variant="info"
          title={t('wire.noPayouts')}
          icon={AlertCircle}
          action={
            <Button asChild size="sm" variant="outline">
              <Link to={OWNER_CLOSE_PATH}>{t('wire.openClose')}</Link>
            </Button>
          }
        >
          {t('wire.noPayoutsDescription')}
        </Alert>
      );
    }
    return (
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">{t('wire.payoutsHint')}</p>
        {failures}
        {shown.map(([currency, items]) => {
          const payable = items.filter(isPayable);
          const allChosen = payable.length > 0 && payable.every((row) => selected.has(row.id));
          return (
            <div key={currency} className="space-y-3" data-testid={`wire-group-${currency}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-semibold">{t('wire.currencyGroup', { currency })}</h3>
                {payable.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => toggleGroup(items)} disabled={busy} data-testid={`wire-select-group-${currency}`}>
                    {allChosen ? t('wire.clearGroup') : t('wire.selectGroup')}
                  </Button>
                )}
              </div>
              {isListCapped(payableReads[currency].data) && (
                <p className="text-sm text-muted-foreground" data-testid={`wire-cap-note-${currency}`}>
                  {t('wire.payoutsCapNote', { limit: WIRE_PAYABLE_LIST_CAP, currency })}
                </p>
              )}
              <ul role="list" className="space-y-2">
                {items.map((row) => {
                  const payableRow = isPayable(row);
                  const chosen = selected.has(row.id);
                  const reasonId = `wire-payout-${row.id}-reason`;
                  return (
                    <li
                      key={row.id}
                      data-testid={`wire-payout-${row.id}`}
                      className={`rounded-lg border p-3 transition-colors ${chosen && payableRow ? 'border-primary bg-muted/40' : ''}`}
                    >
                      <label className={`flex items-start gap-3 ${payableRow && !busy ? 'cursor-pointer' : 'opacity-70'}`}>
                        <input
                          type="checkbox"
                          checked={chosen && payableRow}
                          disabled={busy || !payableRow}
                          aria-describedby={payableRow ? undefined : reasonId}
                          onChange={() => toggle(row.id)}
                          className="mt-1 size-4"
                        />
                        <span className="grid min-w-0 flex-1 gap-1 sm:grid-cols-[1fr_auto] sm:gap-x-6 sm:gap-y-0">
                          <span className="min-w-0">
                            <span className="block break-words font-medium" data-testid="wire-payout-owner">
                              {ownerName(row.ownerId, row.ownerName)}
                            </span>
                            <span className="block text-sm text-muted-foreground" data-testid="wire-payout-period">
                              {t('wire.row.period', { period: format.month(row.periodYear, row.periodMonth) })}
                            </span>
                          </span>
                          <span className="min-w-0 sm:text-right">
                            <WireAmount amount={row.amount} currency={row.currency} className="block font-semibold" testId="wire-payout-amount" />
                            {!row.hasIban && (
                              <span className="block text-sm font-medium text-destructive" data-testid="wire-payout-iban-badge">
                                {t('wire.row.ibanMissingBadge')}
                              </span>
                            )}
                          </span>
                        </span>
                      </label>
                      {!row.hasIban && (
                        <p id={reasonId} className="mt-2 pl-7 text-sm" data-testid="wire-payout-iban-missing">
                          {t('wire.row.ibanMissing')}{' '}
                          <Link to={ownerFinancialPath(row.ownerId)} className="font-medium underline">
                            {t('wire.openOwner')}
                          </Link>
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}

        <div className="space-y-4 border-t pt-6">
          <div className="max-w-xs">
            <Label htmlFor="wire-execution-date">{t('wire.executionDate')}</Label>
            <Input
              id="wire-execution-date"
              type="date"
              value={executionDate}
              min={today}
              onChange={(event) => setExecutionDate(event.target.value)}
              disabled={busy}
              aria-invalid={executionDate !== '' && !dateOk}
              aria-describedby="wire-execution-date-hint"
              className="mt-1"
            />
            <p id="wire-execution-date-hint" className="mt-1 text-xs text-muted-foreground">
              {executionDate !== '' && !dateOk ? t('wire.executionDateInvalid') : t('wire.executionDateHint')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={openConfirmation} disabled={!canCreate} data-testid="wire-create">
              {t('wire.create')}
            </Button>
            {chosenCount > 0 && (
              <span className="text-sm text-muted-foreground" data-testid="wire-selection">
                {chosenSummary}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  const batchesBody = () => {
    if (batchesState === 'loading') return <SkeletonCard lines={3} label={t('wire.loading')} />;
    if (batchesState === 'notFound' || batchesState === 'error') {
      const notFound = batchesState === 'notFound';
      return (
        <ErrorState
          title={notFound ? t('wire.batches.notFound') : t('wire.batches.loadError')}
          error={notFound ? undefined : batchesQuery.error}
          onRetry={() => void batchesQuery.refetch()}
        />
      );
    }
    if (batches.length === 0) return <p className="text-sm text-muted-foreground">{t('wire.batches.empty')}</p>;
    return (
      <ul role="list" className="space-y-3">
        {batches.map((batch) => (
          <li key={batch.id}>
            <WireBatchCard batch={batch} />
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="space-y-6" data-testid="wire-transfer-page">
      {header}
      {stale && <StaleReadNotice onRetry={retryFailed} />}

      <PlainSection title={t('wire.selectPayouts')} data-testid="wire-compose">
        {composeBody()}
        {attempts.length > 0 && (
          <div className="mt-4 space-y-3" data-testid="wire-outcome">
            {attempts.map((attempt) =>
              attempt.batch ? (
                <Alert key={attempt.currency} variant="success" data-testid={`wire-created-${attempt.currency}`}>
                  <p className="font-medium">{t('wire.created', { count: attempt.batch.transferCount, currency: attempt.batch.currency })}</p>
                  <p>
                    {t('wire.createdTotal')} <WireAmount amount={attempt.batch.totalAmount} currency={attempt.batch.currency} testId="wire-created-amount" />
                  </p>
                  <p>{t('wire.createdNext')}</p>
                </Alert>
              ) : (
                <Alert
                  key={attempt.currency}
                  variant={attempt.code === 'wire_batch_schema_unavailable' ? 'warning' : 'danger'}
                  title={t('wire.notCreated', { currency: attempt.currency })}
                  data-testid={`wire-refused-${attempt.currency}`}
                >
                  <p>{attempt.message}</p>
                  {attempt.owners.length > 0 && (
                    <ul role="list" className="mt-2 space-y-1" data-testid="wire-owner-problems">
                      {attempt.owners.map((owner) => (
                        <li key={owner.id} data-testid={`wire-owner-problem-${owner.id}`}>
                          <span className="font-medium">{owner.name}</span>{' '}
                          <Link to={ownerFinancialPath(owner.id)} className="underline">
                            {t('wire.openOwner')}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </Alert>
              ),
            )}
          </div>
        )}
      </PlainSection>

      <PlainSection title={t('wire.batches.title')} count={batches.length} data-testid="wire-batches">
        {batchesBody()}
      </PlainSection>

      <ConfirmationDialog
        open={confirming}
        onOpenChange={dismissConfirmation}
        title={t('wire.confirmCreateTitle')}
        description={t('wire.confirmCreateDescription', { count: planned.length, date: format.date(executionDate) })}
        consequences={[t('wire.consequenceLocked'), t('wire.consequenceNoExecution')]}
        confirmLabel={t('wire.create')}
        isLoading={busy}
        confirmDisabled={planned.length === 0 || !dateOk}
        onConfirm={create}
      >
        <ul role="list" className="space-y-1 rounded-md bg-muted/50 p-3 text-sm" data-testid="wire-confirm-files">
          {planned.map(([currency, ids]) => (
            <li key={currency}>{t('wire.confirmCreateFile', { count: ids.length, currency })}</li>
          ))}
        </ul>
      </ConfirmationDialog>
    </div>
  );
}
