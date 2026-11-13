import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useAddFxRate } from '@/queries/use-owner-accounting';
import { failureText, parseRate } from '../owner-accounting-model';
import { FormDialog } from './form-dialog';

interface FxRateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The day the rate is for: the last day of the month being closed, by default. */
  defaultDate: string;
}

const CURRENCY = /^[A-Za-z]{3}$/;

/**
 * Adds an exchange rate of the agency (resolves `fx_missing`): CasaZen fetches none and guesses none, so the line that needs one stays out of the
 * statement until the agency has entered the rate with its source. One unit of the first currency is the rate in the second, on the day
 * given and the seven days after it.
 */
export function FxRateDialog({ open, onOpenChange, defaultDate }: FxRateDialogProps) {
  const { t, i18n } = useTranslation();
  const add = useAddFxRate();
  const [base, setBase] = useState('');
  const [quote, setQuote] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [rate, setRate] = useState('');
  const [source, setSource] = useState('');
  const [error, setError] = useState<string | null>(null);

  const parsed = parseRate(rate);
  const valid = CURRENCY.test(base) && CURRENCY.test(quote) && base.toUpperCase() !== quote.toUpperCase() && /^\d{4}-\d{2}-\d{2}$/.test(date) && parsed !== null && source.trim().length > 0;

  const onSubmit = async () => {
    if (!valid || parsed === null) return;
    setError(null);
    try {
      await add.mutateAsync({ baseCurrency: base.trim().toUpperCase(), quoteCurrency: quote.trim().toUpperCase(), rateDate: date, rate: parsed, source: source.trim() });
      toast.success(t('ownerAccounting.fx.done'));
      onOpenChange(false);
    } catch (failure) {
      setError(failureText(failure, t, i18n.exists));
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('ownerAccounting.fx.title')}
      description={t('ownerAccounting.fx.description')}
      submitLabel={t('ownerAccounting.fx.submit')}
      pending={add.isPending}
      submitDisabled={!valid}
      error={error}
      onSubmit={onSubmit}
      testId="fx-dialog"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('ownerAccounting.fx.base')} hint={t('ownerAccounting.fx.baseHint')}>
          <Input value={base} maxLength={3} autoCapitalize="characters" autoComplete="off" onChange={(event) => setBase(event.target.value)} data-testid="fx-base" />
        </Field>
        <Field label={t('ownerAccounting.fx.quote')} hint={t('ownerAccounting.fx.quoteHint')}>
          <Input value={quote} maxLength={3} autoCapitalize="characters" autoComplete="off" onChange={(event) => setQuote(event.target.value)} data-testid="fx-quote" />
        </Field>
        <Field label={t('ownerAccounting.fx.date')}>
          <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} data-testid="fx-date" />
        </Field>
        <Field label={t('ownerAccounting.fx.rate')} error={rate.trim() !== '' && parsed === null ? 'ownerAccounting.fx.rateInvalid' : undefined}>
          <Input inputMode="decimal" value={rate} autoComplete="off" onChange={(event) => setRate(event.target.value)} data-testid="fx-rate" />
        </Field>
      </div>
      <Field label={t('ownerAccounting.fx.source')} hint={t('ownerAccounting.fx.sourceHint')}>
        <Input value={source} maxLength={100} autoComplete="off" onChange={(event) => setSource(event.target.value)} data-testid="fx-source" />
      </Field>
    </FormDialog>
  );
}
