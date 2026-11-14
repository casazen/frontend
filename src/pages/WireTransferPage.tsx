import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { AgencyAccessRefused, AgencyFinanceGate } from '@/components/finance/agency-finance-gate';
import { StaleReadNotice } from '@/components/finance/stale-read-notice';
import { WireAmount } from '@/components/finance/wire-amount';
import { WireBatchCard } from '@/components/finance/WireBatchCard';
import { groupByCurrency, isPayable, isWireCurrency, ownerIdsOf, payableRows, withoutIban, type PayableRow } from '@/components/finance/wire-model';
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
import { useCreateBatch, useWireBatches, useWireOwners, useWirePayouts } from '@/queries/wireTransfer';
import type { CreateBatchResponse, OwnerPayout, WireBatch, WireOwner } from '@/types';

const NO_PAYOUTS: readonly OwnerPayout[] = [];
const NO_OWNERS: readonly WireOwner[] = [];
const NO_BATCHES: readonly WireBatch[] = [];

/** What one request of the last attempt came to: the file the server made for a currency, or its refusal in words (and the owners it lists, by id). */
interface Attempt {
  currency: string;
  /** The batch as the server answered it; `null` when the server refused. */
  batch: CreateBatchResponse | null;
  message: string;
  code: string | undefined;
  ownerIds: string[];
}

interface ReadResult {
  data: unknown;
  isPending: boolean;
  isError: boolean;
  error: unknown;
}

/**
 * Where a part of the page stands, from the reads it needs. A 404 is «not found» whatever the cache still holds (a failed read keeps the last answer); any other failure
 * with nothing to show is an error with a retry; a failure with the last answer in memory is the stale notice, decided by the caller.
 */
function readStateOf(...reads: ReadResult[]): 'loading' | 'notFound' | 'error' | 'ready' {
  if (reads.some((read) => read.isError && getHttpStatus(read.error) === 404)) return 'notFound';
  if (reads.some((read) => read.isError && !read.data)) return 'error';
  if (reads.some((read) => read.isPending)) return 'loading';
  return 'ready';
}

/**
 * «Bonifici proprietari» of the Amministrazione (ADR-017, E16/F02/US01/T01): the bank file («file per la banca», ISO 20022) that pays the owners from their CONFIRMED
 * PAYOUTS (the net after the withholding), one file per currency, and the list of the files with their steps. The backend gives it only to the owner and the administrators
 * of an org on the agency plan (`agency.wire.manage`), so the role and the plan are checked before anything is read (`AgencyFinanceGate`). CasaZen makes the file and
 * records what the administrator says; it does not move money and does not know whether the bank executed the transfers. The debit account is the one of the issuer profile
 * of the org (the «Fatturazione» setup): the page never asks for an account and never shows one in full.
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
  // The payouts that went into a file in this visit: the server has no read of «the payouts not yet in a batch», so the page keeps them off the choice (the server refuses
  // them anyway, `payouts_already_in_batch`, also for the ones another visit or person put in a file).
  const [batchedIds, setBatchedIds] = useState<ReadonlySet<string>>(new Set());
  const [executionDate, setExecutionDate] = useState(() => todayInRome());
  const [confirming, setConfirming] = useState(false);
  // What the person is asked to confirm, as it was when the confirmation opened: the files (one for each currency) and the payouts of each. What they confirm is what is sent,
  // whatever the list does meanwhile, and the dialog does not change under them while the files are made.
  const [planned, setPlanned] = useState<ReadonlyArray<readonly [string, readonly string[]]>>([]);
  const [running, setRunning] = useState(false);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  // A request is on its way: the state of the mutation says it a moment later than the click, so a second one in between is stopped here.
  const sending = useRef(false);

  const payoutsQuery = useWirePayouts();
  const ownersQuery = useWireOwners();
  const batchesQuery = useWireBatches();
  const createBatch = useCreateBatch();

  const owners = ownersQuery.data ?? NO_OWNERS;
  const batches = batchesQuery.data ?? NO_BATCHES;
  const rows = useMemo(() => payableRows(payoutsQuery.data ?? NO_PAYOUTS, owners, batchedIds), [payoutsQuery.data, owners, batchedIds]);
  const groups = useMemo(() => groupByCurrency(rows), [rows]);
  const ownerNames = useMemo(() => new Map(owners.map((owner) => [owner.id, owner.name] as const)), [owners]);
  const ownerName = (ownerId: string) => ownerNames.get(ownerId) || t('ownerAccounting.owner.unnamed', { id: shortId(ownerId) });

  // What is chosen, by currency: only what a file can pay, and only what is still on the list (a read that took a payout away drops it from the choice).
  const chosenByCurrency = useMemo(() => {
    const byCurrency = new Map<string, string[]>();
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
   * confirm) or the refusal in words, with the owners it lists. The payouts of a file the server made leave the choice and the list.
   */
  const create = async () => {
    if (sending.current || busy || planned.length === 0 || !dateOk) return;
    sending.current = true;
    setRunning(true);
    setAttempts([]);
    const results: Attempt[] = [];
    try {
      for (const [currency, ids] of planned) {
        try {
          const batch = await createBatch.mutateAsync({ payoutIds: [...ids], executionDate });
          results.push({ currency, batch, message: '', code: undefined, ownerIds: [] });
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
            ownerIds: ownerIdsOf(error),
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
  const reads = [payoutsQuery, ownersQuery, batchesQuery];

  // The server refuses a read (a 403 the reads accept, so that the app stays here): the access is not there, and nothing of the page is offered.
  if (payoutsQuery.data === null || ownersQuery.data === null || batchesQuery.data === null) {
    return (
      <div className="space-y-6" data-testid="wire-transfer-page">
        {header}
        <AgencyAccessRefused />
      </div>
    );
  }

  const composeState = readStateOf(payoutsQuery, ownersQuery);
  const batchesState = readStateOf(batchesQuery);
  const retryFailed = () => {
    for (const read of reads) if (read.isError) void read.refetch();
  };
  // A failed read with the last answer in memory (a 404 or nothing to show is told in its part): the figures may be out of date.
  const stale = reads.some((read) => read.isError && Boolean(read.data) && getHttpStatus(read.error) !== 404);

  const chosenSummary = [...chosenByCurrency.entries()].map(([currency, ids]) => t('wire.chosenCount', { count: ids.length, currency })).join(' · ');

  const composeBody = () => {
    if (composeState === 'loading') return <SkeletonCard lines={4} label={t('wire.loading')} />;
    if (composeState === 'notFound' || composeState === 'error') {
      const notFound = composeState === 'notFound';
      const failed = [payoutsQuery, ownersQuery].find((read) => read.isError);
      return (
        <ErrorState
          title={notFound ? t('wire.notFound') : t('wire.loadError')}
          error={notFound ? undefined : failed?.error}
          onRetry={() => {
            for (const read of [payoutsQuery, ownersQuery]) if (read.isError) void read.refetch();
          }}
        />
      );
    }
    if (rows.length === 0) {
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
        {groups.map(([currency, items]) => {
          const supported = isWireCurrency(currency);
          const payable = items.filter(isPayable);
          const allChosen = payable.length > 0 && payable.every((row) => selected.has(row.id));
          return (
            <div key={currency || 'none'} className="space-y-3" data-testid={`wire-group-${currency || 'none'}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-semibold">{currency ? t('wire.currencyGroup', { currency }) : t('wire.currencyGroupNone')}</h3>
                {payable.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => toggleGroup(items)} disabled={busy} data-testid={`wire-select-group-${currency}`}>
                    {allChosen ? t('wire.clearGroup') : t('wire.selectGroup')}
                  </Button>
                )}
              </div>
              {!supported && (
                <p className="text-sm text-muted-foreground">{currency ? t('wire.currencyNotSupported', { currency }) : t('wire.currencyMissingGroup')}</p>
              )}
              <ul role="list" className="space-y-2">
                {items.map((row) => {
                  const payableRow = isPayable(row);
                  const chosen = selected.has(row.id);
                  return (
                    <li
                      key={row.id}
                      data-testid={`wire-payout-${row.id}`}
                      className={`rounded-lg border p-3 transition-colors ${chosen ? 'border-primary bg-muted/40' : ''}`}
                    >
                      <label className={`flex items-start gap-3 ${payableRow && !busy ? 'cursor-pointer' : 'opacity-70'}`}>
                        <input
                          type="checkbox"
                          checked={chosen && payableRow}
                          disabled={busy || !payableRow}
                          onChange={() => toggle(row.id)}
                          className="mt-1 size-4"
                        />
                        <span className="grid min-w-0 flex-1 gap-1 sm:grid-cols-[1fr_auto] sm:gap-x-6">
                          <span className="min-w-0">
                            <span className="block break-words font-medium" data-testid="wire-payout-owner">
                              {ownerName(row.ownerId)}
                            </span>
                            <span className="block text-sm text-muted-foreground">
                              {t('wire.row.paidOn', { date: format.date(row.paidOn) })}
                              {row.reference ? ` · ${row.reference}` : ''}
                            </span>
                          </span>
                          <span className="min-w-0 sm:text-right">
                            <WireAmount amount={row.netAmount} currency={row.currency} className="block font-semibold" testId="wire-payout-amount" />
                            {row.ibanEnd && (
                              <span className="block text-sm text-muted-foreground" data-testid="wire-payout-iban">
                                {t('wire.row.iban', { end: row.ibanEnd })}
                              </span>
                            )}
                          </span>
                        </span>
                      </label>
                      {row.ibanEnd === null && (
                        <p className="mt-2 pl-7 text-sm" data-testid="wire-payout-iban-missing">
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
                  {attempt.ownerIds.length > 0 && (
                    <ul role="list" className="mt-2 space-y-1" data-testid="wire-owner-problems">
                      {attempt.ownerIds.map((ownerId) => (
                        <li key={ownerId} data-testid={`wire-owner-problem-${ownerId}`}>
                          <span className="font-medium">{ownerName(ownerId)}</span>{' '}
                          <Link to={ownerFinancialPath(ownerId)} className="underline">
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
