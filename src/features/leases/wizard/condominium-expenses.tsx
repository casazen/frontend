import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { getProblemMessage } from '@/lib/api-errors';
import { formatCurrency } from '@/lib/utils';
import {
  useCalculateCondominiumProposal,
  useCondominiumProposal,
  useSaveCondominiumProposal,
} from '@/queries/use-condominium-proposal';

const AMOUNT = /^\d+(\.\d{1,2})?$/;

/**
 * Condominium expenses on «Condizioni economiche». A fiscal year already on the property proposes the monthly
 * amount. With nothing loaded, the previous-year consuntivo and the new-year preventivo calculate it, or the
 * amount is typed by hand and settled at consuntivo. Paying it is not done here.
 */
export function CondominiumExpenses({ propertyId, leaseId }: { propertyId: string; leaseId: string }) {
  const { t } = useTranslation();
  const proposal = useCondominiumProposal(propertyId);
  const save = useSaveCondominiumProposal(propertyId);
  const calculate = useCalculateCondominiumProposal(propertyId);
  const [consuntivo, setConsuntivo] = useState<File | null>(null);
  const [preventivo, setPreventivo] = useState<File | null>(null);
  const [manual, setManual] = useState('');
  const [savedAmount, setSavedAmount] = useState<number | null>(null);

  if (propertyId.trim() === '') return null;

  const pending = save.isPending || calculate.isPending;
  const error = save.error ?? calculate.error;
  const shown = proposal.data;
  const ready = shown?.state === 'ready' && shown.amount !== null;

  async function acceptProposed(amount: number) {
    const saved = await save.mutateAsync({ mode: 'proposed', leaseId, amount });
    setSavedAmount(saved.amount);
  }

  async function acceptManual() {
    const amount = Number(manual.trim());
    const saved = await save.mutateAsync({ mode: 'manual', leaseId, amount, settleAtConsuntivo: true });
    setSavedAmount(saved.amount);
  }

  async function calculateFromFiles() {
    if (!consuntivo || !preventivo) return;
    const saved = await calculate.mutateAsync({ leaseId, consuntivo, preventivo });
    setSavedAmount(saved.amount);
  }

  const manualAmount = Number(manual.trim());
  const manualValid = AMOUNT.test(manual.trim()) && manualAmount > 0;

  return (
    <section className="space-y-4" aria-labelledby="lw-condo-title" data-testid="lease-condominium-expenses">
      <div className="space-y-1">
        <h3 id="lw-condo-title" className="text-sm font-semibold">
          {t('leaseWizard.condominium.title')}
        </h3>
        <p className="text-sm text-muted-foreground">{t('leaseWizard.condominium.intro')}</p>
      </div>

      {proposal.isLoading ? <p className="text-sm text-muted-foreground">{t('leaseWizard.condominium.loading')}</p> : null}
      {proposal.isError ? (
        <p className="text-sm text-destructive" role="alert" data-testid="lease-condominium-error">
          {getProblemMessage(proposal.error, t) ?? t('leaseWizard.condominium.loadError')}{' '}
          <button type="button" className="font-medium underline underline-offset-2" onClick={() => void proposal.refetch()}>
            {t('leaseWizard.condominium.retry')}
          </button>
        </p>
      ) : null}

      {ready ? (
        <div className="space-y-3" data-testid="lease-condominium-proposed">
          <p>
            {shown.fiscalYearLabel
              ? t('leaseWizard.condominium.proposedYear', {
                  year: shown.fiscalYearLabel,
                  amount: formatCurrency(shown.amount ?? 0, 'EUR'),
                })
              : t('leaseWizard.condominium.proposed', { amount: formatCurrency(shown.amount ?? 0, 'EUR') })}
          </p>
          <Button
            type="button"
            loading={save.isPending}
            onClick={() => void acceptProposed(shown.amount ?? 0)}
            data-testid="lease-condominium-accept"
          >
            {t('leaseWizard.condominium.accept')}
          </Button>
        </div>
      ) : null}

      {shown?.state === 'empty' ? (
        <div className="space-y-4" data-testid="lease-condominium-empty">
          <p className="text-sm text-muted-foreground">{t('leaseWizard.condominium.empty')}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('leaseWizard.condominium.consuntivo')}>
              <Input
                id="lw-condo-consuntivo"
                type="file"
                accept="application/pdf,.pdf,text/plain,.txt"
                onChange={(event) => setConsuntivo(event.target.files?.[0] ?? null)}
              />
            </Field>
            <Field label={t('leaseWizard.condominium.preventivo')}>
              <Input
                id="lw-condo-preventivo"
                type="file"
                accept="application/pdf,.pdf,text/plain,.txt"
                onChange={(event) => setPreventivo(event.target.files?.[0] ?? null)}
              />
            </Field>
          </div>
          <Button
            type="button"
            variant="outline"
            loading={calculate.isPending}
            disabled={!consuntivo || !preventivo || pending}
            onClick={() => void calculateFromFiles()}
            data-testid="lease-condominium-calculate"
          >
            {t('leaseWizard.condominium.calculate')}
          </Button>

          <Field label={t('leaseWizard.condominium.manual')} hint={t('leaseWizard.condominium.manualHint')}>
            <Input
              id="lw-condo-manual"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={manual}
              onChange={(event) => setManual(event.target.value)}
            />
          </Field>
          <Button
            type="button"
            variant="outline"
            loading={save.isPending}
            disabled={!manualValid || pending}
            onClick={() => void acceptManual()}
            data-testid="lease-condominium-manual"
          >
            {t('leaseWizard.condominium.useManual')}
          </Button>
        </div>
      ) : null}

      {savedAmount !== null ? (
        <p className="text-sm" role="status" data-testid="lease-condominium-saved">
          {t('leaseWizard.condominium.saved', { amount: formatCurrency(savedAmount, 'EUR') })}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert" data-testid="lease-condominium-save-error">
          {getProblemMessage(error, t) ?? t('leaseWizard.condominium.saveError')}
        </p>
      ) : null}
    </section>
  );
}
