import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { getProblemMessage } from '@/lib/api-errors';
import { formatCurrency } from '@/lib/utils';
import type { ProposeTenantExpense, TenantExpenseProposal } from '@/types/condominium-proposal.types';
import { useCondominiumExpenseProbe, useProposeCondominiumExpense } from '@/queries/use-condominium-proposal';

const AMOUNT = /^\d+(\.\d{1,2})?$/;

interface AcceptedExpense {
  proposal: TenantExpenseProposal;
  /** The body that produced this proposal. A later click sends this again, never a different mode. */
  request: ProposeTenantExpense;
}

/**
 * Condominium expenses on «Condizioni economiche».
 * A fiscal year already on the property proposes the monthly amount.
 * With nothing loaded, the totals of the previous consuntivo and the new preventivo, or a hand-typed
 * amount, are sent. A hand-typed amount and the two statements are settled at consuntivo: the button
 * that follows sends that same request again. Paying, and the prior-year balance, are not done here.
 */
export function CondominiumExpenses({ propertyId, leaseId }: { propertyId: string; leaseId: string }) {
  const { t } = useTranslation();
  const ready = propertyId.trim() !== '' && leaseId.trim() !== '';
  const probe = useCondominiumExpenseProbe(leaseId, ready);
  const save = useProposeCondominiumExpense(leaseId);
  const [consuntivo, setConsuntivo] = useState('');
  const [preventivo, setPreventivo] = useState('');
  const [manual, setManual] = useState('');
  const [accepted, setAccepted] = useState<AcceptedExpense | null>(null);

  if (!ready) return null;

  const pending = save.isPending;
  const shown = accepted?.proposal ?? (probe.data === undefined ? null : probe.data);
  const empty = probe.isSuccess && probe.data === null && accepted === null;

  async function propose(request: ProposeTenantExpense) {
    const proposal = await save.mutateAsync(request);
    setAccepted({ proposal, request });
  }

  async function acceptShown() {
    if (!shown || accepted) return;
    // A settled proposal must be repeated with the same numbers. An empty body would drop settleAtConsuntivo.
    if (shown.settledAtConsuntivo && shown.source === 'Manual') {
      await propose(manualRequest(shown.installmentAmount));
      return;
    }
    if (shown.settledAtConsuntivo && shown.previousConsuntivo !== null && shown.preventivo !== null) {
      await propose({
        cadence: 'Monthly',
        previousConsuntivo: shown.previousConsuntivo,
        preventivo: shown.preventivo,
      });
      return;
    }
    setAccepted({ proposal: shown, request: {} });
  }

  const consuntivoAmount = Number(consuntivo.trim());
  const preventivoAmount = Number(preventivo.trim());
  const manualAmount = Number(manual.trim());
  const statementsValid = AMOUNT.test(consuntivo.trim()) && consuntivoAmount >= 0 && AMOUNT.test(preventivo.trim()) && preventivoAmount > 0;
  const manualValid = AMOUNT.test(manual.trim()) && manualAmount > 0;

  return (
    <section className="space-y-4 rounded-lg border border-border p-4" aria-labelledby="lw-condo-title" data-testid="lease-condominium-expenses">
      <div className="space-y-1">
        <h3 id="lw-condo-title" className="text-base font-semibold">
          {t('leaseWizard.condominium.title')}
        </h3>
        <p className="text-sm text-muted-foreground">{t('leaseWizard.condominium.intro')}</p>
      </div>

      {probe.isLoading ? <p className="text-sm text-muted-foreground">{t('leaseWizard.condominium.loading')}</p> : null}
      {probe.isError ? (
        <p className="text-sm text-destructive" role="alert" data-testid="lease-condominium-error">
          {getProblemMessage(probe.error, t) ?? t('leaseWizard.condominium.loadError')}{' '}
          <button type="button" className="font-medium underline underline-offset-2" onClick={() => void probe.refetch()}>
            {t('leaseWizard.condominium.retry')}
          </button>
        </p>
      ) : null}

      {shown ? (
        <div className="space-y-3 rounded-md bg-muted/50 p-3" data-testid="lease-condominium-proposed">
          <p className="text-base font-semibold">
            {shown.periodLabel
              ? t('leaseWizard.condominium.proposedYear', {
                  year: shown.periodLabel,
                  amount: formatCurrency(shown.installmentAmount, 'EUR'),
                })
              : t('leaseWizard.condominium.proposed', { amount: formatCurrency(shown.installmentAmount, 'EUR') })}
          </p>
          {shown.lastInstallmentAmount !== shown.installmentAmount ? (
            <p className="text-sm text-muted-foreground">
              {t('leaseWizard.condominium.lastInstallment', { amount: formatCurrency(shown.lastInstallmentAmount, 'EUR') })}
            </p>
          ) : null}
          <p className="text-sm text-muted-foreground">
            {shown.settledAtConsuntivo ? t('leaseWizard.condominium.settled') : t('leaseWizard.condominium.notPayment')}
          </p>
          {accepted ? (
            <p className="text-sm" role="status" data-testid="lease-condominium-saved">
              {t('leaseWizard.condominium.saved', { amount: formatCurrency(shown.installmentAmount, 'EUR') })}
            </p>
          ) : (
            <Button type="button" loading={pending} onClick={() => void acceptShown()} data-testid="lease-condominium-accept">
              {t('leaseWizard.condominium.accept')}
            </Button>
          )}
        </div>
      ) : null}

      {empty ? (
        <div className="space-y-4" data-testid="lease-condominium-empty">
          <p className="text-sm">{t('leaseWizard.condominium.empty')}</p>
          <p className="text-sm text-muted-foreground" data-testid="lease-condominium-limits">
            {t('leaseWizard.condominium.limits')}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('leaseWizard.condominium.consuntivo')}>
              <Input
                id="lw-condo-consuntivo"
                inputMode="decimal"
                value={consuntivo}
                onChange={(event) => setConsuntivo(event.target.value)}
              />
            </Field>
            <Field label={t('leaseWizard.condominium.preventivo')}>
              <Input
                id="lw-condo-preventivo"
                inputMode="decimal"
                value={preventivo}
                onChange={(event) => setPreventivo(event.target.value)}
              />
            </Field>
          </div>
          <Button
            type="button"
            variant="outline"
            loading={pending}
            disabled={!statementsValid || pending}
            onClick={() =>
              void propose({
                cadence: 'Monthly',
                previousConsuntivo: consuntivoAmount,
                preventivo: preventivoAmount,
              })
            }
            data-testid="lease-condominium-calculate"
          >
            {t('leaseWizard.condominium.calculate')}
          </Button>

          <p className="text-sm font-medium">{t('leaseWizard.condominium.or')}</p>
          <Field label={t('leaseWizard.condominium.manual')} hint={t('leaseWizard.condominium.manualHint')}>
            <Input
              id="lw-condo-manual"
              inputMode="decimal"
              value={manual}
              onChange={(event) => setManual(event.target.value)}
            />
          </Field>
          <Button
            type="button"
            variant="outline"
            loading={pending}
            disabled={!manualValid || pending}
            onClick={() => void propose(manualRequest(manualAmount))}
            data-testid="lease-condominium-manual"
          >
            {t('leaseWizard.condominium.useManual')}
          </Button>
        </div>
      ) : null}

      {save.isError ? (
        <p className="text-sm text-destructive" role="alert" data-testid="lease-condominium-save-error">
          {getProblemMessage(save.error, t) ?? t('leaseWizard.condominium.saveError')}
        </p>
      ) : null}
    </section>
  );
}

function manualRequest(amount: number): ProposeTenantExpense {
  return { cadence: 'Monthly', manualAmount: amount };
}
