import { useTranslation } from 'react-i18next';
import { useMemo, useRef, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { AgencyAccessRefused, AgencyFinanceGate } from '@/components/finance/agency-finance-gate';
import { StaleReadNotice } from '@/components/finance/stale-read-notice';
import { WireBatchCard, type CreatedBatch } from '@/components/finance/WireBatchCard';
import { PlainSection } from '@/components/shared/calm';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { ErrorState } from '@/components/shared/error-state';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SkeletonCard } from '@/components/ui/skeleton';
import { useExactMoney } from '@/hooks/use-exact-money';
import { useLeaveGuard } from '@/hooks/use-leave-guard';
import { failureMessage, problemCodeOf } from '@/lib/agency-finance';
import { getHttpStatus } from '@/lib/api-errors';
import { maskIban } from '@/lib/iban';
import { useStatements } from '@/queries/statements';
import { useCreateBatch } from '@/queries/wireTransfer';
import type { OwnerStatement } from '@/types';

/** The currencies a wire file exists for: SEPA for the euro, the Swiss file for the franc. The server refuses any other (`wire_currency_not_supported`). */
const WIRE_CURRENCIES = ['EUR', 'CHF'];

/** The server compares currencies without the case or the spaces of the stored code, and so does the page. */
const currencyOf = (statement: OwnerStatement) => statement.currency.trim().toUpperCase();

/**
 * «Bonifici proprietari» of the Amministrazione (ADR-017, E06/F05/US01/T02): the wire file that pays the owners' published statements, one currency per file. The
 * backend gives it only to the owner and the administrators of an org on the agency plan (`agency.wire.manage`), so the role and the plan are checked before
 * anything is read (`AgencyFinanceGate`). CasaZen makes the file and records what the administrator says; it does not move money and does not know whether the bank
 * executed the transfers.
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
  const money = useExactMoney();
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  // The statements that went into a file in this visit: the list has no «already in a file» field, so the page keeps them off the choice (the server refuses them
  // anyway, `statements_already_in_batch`, also for the ones another visit or person put in a file).
  const [batchedIds, setBatchedIds] = useState<ReadonlySet<string>>(new Set());
  const [debitAccount, setDebitAccount] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [batches, setBatches] = useState<CreatedBatch[]>([]);
  // The files made in this visit that are not paid yet: the page does not keep them, so leaving it with one of them open loses it (and its statements stay locked).
  const [unpaid, setUnpaid] = useState<ReadonlySet<string>>(new Set());
  const leaving = useLeaveGuard(unpaid.size > 0);
  const [failure, setFailure] = useState<string | null>(null);
  const [schemaUnavailable, setSchemaUnavailable] = useState(false);
  // A request is on its way: the state of the mutation says it a moment later than the click, so a second one in between is stopped here.
  const sending = useRef(false);

  const { data: statements, isPending, isError, error, refetch } = useStatements();
  const createBatch = useCreateBatch();

  // Only a published statement goes into a file (the server refuses the others: `statements_not_published`).
  const published = useMemo(() => (statements ?? []).filter((statement) => statement.status === 'Published'), [statements]);
  const byId = useMemo(() => new Map(published.map((statement) => [statement.id, statement])), [published]);
  // One currency per file: the first statement chosen decides it, and the statements of another currency wait until the choice is cleared.
  const chosenCurrency = useMemo(() => {
    const first = [...selected].map((id) => byId.get(id)).find((statement): statement is OwnerStatement => statement !== undefined);
    return first ? currencyOf(first) : null;
  }, [selected, byId]);
  const groups = useMemo(() => {
    const byCurrency = new Map<string, OwnerStatement[]>();
    for (const statement of published) {
      const currency = currencyOf(statement);
      byCurrency.set(currency, [...(byCurrency.get(currency) ?? []), statement]);
    }
    return [...byCurrency.entries()].sort(([a], [b]) => {
      const rank = (currency: string) => (WIRE_CURRENCIES.includes(currency) ? WIRE_CURRENCIES.indexOf(currency) : WIRE_CURRENCIES.length);
      return rank(a) - rank(b) || a.localeCompare(b);
    });
  }, [published]);

  const pending = createBatch.isPending;
  const chosen = [...selected].filter((id) => byId.has(id));
  const canCreate = chosen.length > 0 && debitAccount.trim() !== '' && !pending;

  const toggle = (id: string) => {
    if (pending) return;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /**
   * The file is made once the person has confirmed it. The debit account is sent and forgotten: whatever the answer is (the file, a refusal of the server or a lost
   * connection) the field is emptied, and the person types the account again to try once more (the page says so). The account lives only in this component's state
   * and in the field, so leaving the page drops it too. A refusal is told here, never as a success (`wire_batch_schema_unavailable`: no file exists, say so plainly).
   */
  const onCreate = async () => {
    if (sending.current || pending || chosen.length === 0 || debitAccount.trim() === '') return;
    sending.current = true;
    setFailure(null);
    const ids = chosen;
    const maskedAccount = maskIban(debitAccount);
    try {
      const batch = await createBatch.mutateAsync({ statementIds: ids, debitAccount: debitAccount.trim() });
      setBatches((current) => [{ ...batch, debitMasked: maskedAccount }, ...current]);
      setUnpaid((current) => new Set([...current, batch.batchId]));
      setBatchedIds((current) => new Set([...current, ...ids]));
      setSelected(new Set());
      setSchemaUnavailable(false);
    } catch (createError) {
      if (problemCodeOf(createError) === 'wire_batch_schema_unavailable') {
        setSchemaUnavailable(true);
      } else {
        setSchemaUnavailable(false);
        setFailure(failureMessage(createError, t, t('wire.batch.createError'), t('wire.batch.notFound')));
      }
    } finally {
      sending.current = false;
      createBatch.reset();
      // Whatever the answer: the account is forgotten.
      setDebitAccount('');
    }
  };

  const markPaid = (batchId: string) =>
    setUnpaid((current) => {
      const next = new Set(current);
      next.delete(batchId);
      return next;
    });

  const dismissConfirmation = (open: boolean) => {
    // The request is on its way: the dialog stays until the server has answered.
    if (!open && !pending && !sending.current) setConfirming(false);
  };

  const header = <PageHeader title={t('wire.title')} description={t('wire.description')} crumbs="auto" />;

  if (isPending) {
    return (
      <div className="space-y-6" data-testid="wire-transfer-page">
        {header}
        <SkeletonCard lines={4} label={t('wire.loading')} />
      </div>
    );
  }

  // A 404 is «not found» whatever the cache still holds; any other failure with nothing to show is told with a retry.
  if (isError && (!statements || getHttpStatus(error) === 404)) {
    return (
      <div className="space-y-6" data-testid="wire-transfer-page">
        {header}
        <ErrorState
          title={getHttpStatus(error) === 404 ? t('wire.notFound') : t('wire.loadError')}
          error={getHttpStatus(error) === 404 ? undefined : error}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  // The server refuses the list (a 403 the read accepts, so that the app stays here): the access is not there, and nothing of the page is offered.
  if (statements === null) {
    return (
      <div className="space-y-6" data-testid="wire-transfer-page">
        {header}
        <AgencyAccessRefused />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="wire-transfer-page">
      {header}
      {/* Here a failed read has the last answer in memory (a 404 or nothing to show is told before): the list may be out of date. */}
      {isError && <StaleReadNotice onRetry={() => void refetch()} />}

      {schemaUnavailable && (
        <Alert variant="warning" title={t('wire.unavailable.title')} data-testid="wire-unavailable">
          {t('wire.unavailable.body')}
        </Alert>
      )}
      {failure && (
        <Alert variant="danger" data-testid="wire-failure">
          {failure}
        </Alert>
      )}
      {(schemaUnavailable || failure) && (
        <p className="text-sm text-muted-foreground" data-testid="wire-account-cleared">
          {t('wire.accountCleared')}
        </p>
      )}

      <PlainSection title={t('wire.selectStatements')} data-testid="wire-compose">
        {published.length === 0 ? (
          <Alert variant="info" title={t('wire.noPublishedStatements')} icon={AlertCircle}>
            {t('wire.noPublishedStatementsDescription')}
          </Alert>
        ) : (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">{t('wire.oneCurrencyHint')}</p>
            {groups.map(([currency, items]) => {
              const supported = WIRE_CURRENCIES.includes(currency);
              return (
                <div key={currency} className="space-y-3" data-testid={`wire-group-${currency}`}>
                  <h3 className="text-lg font-semibold">{t('wire.currencyGroup', { currency })}</h3>
                  {!supported && (
                    <p className="text-sm text-muted-foreground">{t('wire.currencyNotSupported', { currency })}</p>
                  )}
                  {items.map((statement) => {
                    const inBatch = batchedIds.has(statement.id);
                    const otherCurrency = chosenCurrency !== null && chosenCurrency !== currency;
                    const disabled = pending || inBatch || !supported || otherCurrency;
                    return (
                      <label
                        key={statement.id}
                        data-testid={`wire-statement-${statement.id}`}
                        className={`flex items-start gap-3 border rounded-lg p-4 transition-colors ${
                          selected.has(statement.id) ? 'bg-blue-50 border-blue-300' : disabled ? 'opacity-60' : 'cursor-pointer hover:bg-muted/50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(statement.id)}
                          disabled={disabled}
                          onChange={() => toggle(statement.id)}
                          className="mt-1 size-4"
                        />
                        <span className="flex-1">
                          <span className="flex flex-wrap items-center gap-3 mb-1">
                            <span className="text-lg font-semibold">{statement.propertyName}</span>
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                              {t('statement.status.published')}
                            </span>
                          </span>
                          <span className="block text-sm text-muted-foreground mb-2">{statement.ownerName}</span>
                          <span className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                            <span>
                              <span className="text-muted-foreground">{t('statement.period')}:</span>{' '}
                              <span className="font-medium">
                                {statement.month}/{statement.year}
                              </span>
                            </span>
                            <span>
                              <span className="text-muted-foreground">{t('statement.netPayable')}:</span>{' '}
                              <span className="font-medium">{money(statement.netPayable, statement.currency)}</span>
                            </span>
                          </span>
                          {inBatch && <span className="block mt-2 text-xs text-muted-foreground">{t('wire.alreadyInFile')}</span>}
                        </span>
                      </label>
                    );
                  })}
                </div>
              );
            })}

            <div className="space-y-4 border-t pt-6">
              <div>
                <Label htmlFor="debit-account">{t('wire.debitAccount')}</Label>
                <Input
                  id="debit-account"
                  type="text"
                  value={debitAccount}
                  onChange={(e) => setDebitAccount(e.target.value)}
                  placeholder={t('wire.debitAccountPlaceholder')}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  disabled={pending}
                  className="mt-1"
                />
                <p className="mt-1 text-xs text-muted-foreground">{t('wire.debitAccountHint')}</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={() => setConfirming(true)} disabled={!canCreate} data-testid="wire-create">
                  {t('wire.batch.create')}
                </Button>
                {chosen.length > 0 && chosenCurrency && (
                  <span className="text-sm text-muted-foreground" data-testid="wire-selection">
                    {t('wire.chosenCount', { count: chosen.length, currency: chosenCurrency })}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </PlainSection>

      {batches.length > 0 && (
        <PlainSection title={t('wire.batch.sessionTitle')} data-testid="wire-batches">
          <div className="space-y-4">
            {batches.map((batch) => (
              <WireBatchCard key={batch.batchId} batch={batch} onPaid={markPaid} />
            ))}
          </div>
        </PlainSection>
      )}

      <ConfirmationDialog
        open={confirming}
        onOpenChange={dismissConfirmation}
        title={t('wire.batch.confirmCreateTitle')}
        description={t('wire.batch.confirmCreateDescription', {
          count: chosen.length,
          currency: chosenCurrency ?? '',
          account: maskIban(debitAccount),
        })}
        consequences={[t('wire.batch.consequenceLocked'), t('wire.batch.consequenceNoExecution')]}
        confirmLabel={t('wire.batch.create')}
        isLoading={pending}
        onConfirm={onCreate}
      />

      {/* A link of the app to another page while a file is not paid: the file would not be found again here. */}
      <ConfirmationDialog
        open={leaving.state === 'blocked'}
        onOpenChange={(open) => {
          if (!open && leaving.state === 'blocked') leaving.reset();
        }}
        title={t('wire.leave.title')}
        description={t('wire.leave.description')}
        consequences={[t('wire.leave.consequenceLocked'), t('wire.leave.consequenceNeedsPage')]}
        confirmLabel={t('wire.leave.confirm')}
        cancelLabel={t('wire.leave.stay')}
        onConfirm={() => {
          if (leaving.state === 'blocked') leaving.proceed();
        }}
      />
    </div>
  );
}
