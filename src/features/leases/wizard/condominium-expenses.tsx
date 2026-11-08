import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { getProblemMessage } from '@/lib/api-errors';
import { formatCurrency } from '@/lib/utils';
import type { ProposeTenantExpense } from '@/types/condominium-proposal.types';
import {
  useCondominiumExpenseProbe,
  useProposeCondominiumExpense,
  useRememberCondominiumExpense,
} from '@/queries/use-condominium-proposal';

/**
 * Condominium expenses on «Condizioni economiche».
 * A fiscal year already on the property proposes the monthly amount. That first read is not repeated
 * once a choice is kept: an empty body would come back as a budget and drop settle-at-consuntivo.
 * With nothing loaded, the totals of the previous consuntivo and the new preventivo, or a hand-typed
 * amount, are sent. Paying, and the prior-year balance, are not done here.
 */
export function CondominiumExpenses({ propertyId, leaseId }: { propertyId: string; leaseId: string }) {
  const { t } = useTranslation();
  const ready = propertyId.trim() !== '' && leaseId.trim() !== '';
  const probe = useCondominiumExpenseProbe(leaseId, ready);
  const save = useProposeCondominiumExpense(leaseId);
  const remember = useRememberCondominiumExpense(leaseId);
  const [consuntivo, setConsuntivo] = useState('');
  const [preventivo, setPreventivo] = useState('');
  const [manual, setManual] = useState('');

  if (!ready) return null;

  const pending = save.isPending;
  const saved = probe.data?.saved ?? null;
  const shown = saved?.proposal ?? probe.data?.proposal ?? null;
  const empty = probe.isSuccess && probe.data?.proposal === null && saved === null;

  async function propose(request: ProposeTenantExpense) {
    await save.mutateAsync(request);
  }

  function acceptShown() {
    if (!shown || saved) return;
    // The fiscal-year amount is already on screen. Keeping it must not POST {} again.
    remember(shown, {});
  }

  const consuntivoAmount = parseEuroAmount(consuntivo);
  const preventivoAmount = parseEuroAmount(preventivo);
  const manualAmount = parseEuroAmount(manual);
  const statementsValid = consuntivoAmount !== null && consuntivoAmount >= 0 && preventivoAmount !== null && preventivoAmount > 0;
  const manualValid = manualAmount !== null && manualAmount > 0;

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
          {saved ? (
            <p className="text-sm" role="status" data-testid="lease-condominium-saved">
              {t('leaseWizard.condominium.saved', { amount: formatCurrency(shown.installmentAmount, 'EUR') })}
            </p>
          ) : (
            <Button type="button" loading={pending} onClick={acceptShown} data-testid="lease-condominium-accept">
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
                previousConsuntivo: consuntivoAmount ?? 0,
                preventivo: preventivoAmount ?? 0,
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
            onClick={() => void propose(manualRequest(manualAmount ?? 0))}
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

/**
 * An amount typed in Italian: `95,50`, `1.234,50`, or a plain `95.50`.
 * Dots are thousands separators when a comma is the decimal mark, or when every group after the first has three digits.
 */
function parseEuroAmount(raw: string): number | null {
  const text = raw.trim().replace(/[\s\u00a0']/g, '');
  if (text === '') return null;
  let normalized = text;
  if (text.includes(',')) {
    if (!/^(?:\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)$/.test(text)) return null;
    normalized = text.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(text)) {
    normalized = text.replace(/\./g, '');
  } else if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    return null;
  }
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}
