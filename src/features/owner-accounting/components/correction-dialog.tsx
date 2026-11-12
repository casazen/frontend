import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { parseEuroAmount } from '@/lib/euro-amount';
import { todayInRome } from '@/lib/stay-dates';
import { usePostCorrection } from '@/queries/use-owner-accounting';
import { failureText } from '../owner-accounting-model';
import { FormDialog } from './form-dialog';

interface CorrectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ownerId: string;
  ownerName: string;
  /** The currency of the statements of the owner (a correction is made in it); asked when the page does not know it. */
  currency: string | undefined;
}

/**
 * A manual correction of the owner's ledger (resolves `late_source_after_close`, or fixes a figure by hand): a signed line with its reason, never
 * an edit of a line already posted (a posted line is only ever answered by another one). The month is the one of the date: a closed month takes
 * no line, so a correction of what came after a close is dated in a month that is open.
 */
export function CorrectionDialog({ open, onOpenChange, ownerId, ownerName, currency: known }: CorrectionDialogProps) {
  const { t, i18n } = useTranslation();
  const post = usePostCorrection();
  const [direction, setDirection] = useState<'toOwner' | 'fromOwner'>('toOwner');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => todayInRome());
  const [description, setDescription] = useState('');
  const [attachment, setAttachment] = useState('');
  const [typedCurrency, setTypedCurrency] = useState('');
  const currency = (known ?? typedCurrency).trim().toUpperCase();
  const [error, setError] = useState<string | null>(null);

  const parsed = parseEuroAmount(amount);
  const valid = /^[A-Z]{3}$/.test(currency) && parsed !== null && parsed > 0 && /^\d{4}-\d{2}-\d{2}$/.test(date) && description.trim().length > 0 && description.trim().length <= 300;

  const onSubmit = async () => {
    if (!valid || parsed === null) return;
    setError(null);
    try {
      await post.mutateAsync({
        ownerId,
        amount: direction === 'toOwner' ? parsed : -parsed,
        currency,
        date,
        description: description.trim(),
        attachmentReference: attachment.trim() || undefined,
      });
      toast.success(t('ownerAccounting.correction.done', { owner: ownerName }));
      onOpenChange(false);
    } catch (failure) {
      setError(failureText(failure, t, i18n.exists));
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('ownerAccounting.correction.title')}
      description={t('ownerAccounting.correction.description', { owner: ownerName })}
      submitLabel={t('ownerAccounting.correction.submit')}
      pending={post.isPending}
      submitDisabled={!valid}
      error={error}
      onSubmit={onSubmit}
      testId="correction-dialog"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('ownerAccounting.correction.direction')}>
          <Select value={direction} onChange={(event) => setDirection(event.target.value as typeof direction)} data-testid="correction-direction">
            <option value="toOwner">{t('ownerAccounting.correction.toOwner')}</option>
            <option value="fromOwner">{t('ownerAccounting.correction.fromOwner')}</option>
          </Select>
        </Field>
        <Field label={t('ownerAccounting.correction.amount', { currency: currency || '…' })}>
          <Input inputMode="decimal" value={amount} autoComplete="off" onChange={(event) => setAmount(event.target.value)} data-testid="correction-amount" />
        </Field>
      </div>
      {known ? null : (
        <Field label={t('ownerAccounting.correction.currency')} hint={t('ownerAccounting.correction.currencyHint')}>
          <Input value={typedCurrency} maxLength={3} autoCapitalize="characters" autoComplete="off" onChange={(event) => setTypedCurrency(event.target.value)} data-testid="correction-currency" />
        </Field>
      )}
      <Field label={t('ownerAccounting.correction.date')} hint={t('ownerAccounting.correction.dateHint')}>
        <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} data-testid="correction-date" />
      </Field>
      <Field label={t('ownerAccounting.correction.reason')} hint={t('ownerAccounting.correction.reasonHint')} counter={`${description.trim().length}/300`}>
        <Textarea value={description} maxLength={300} rows={3} onChange={(event) => setDescription(event.target.value)} data-testid="correction-reason" />
      </Field>
      <Field label={t('ownerAccounting.correction.attachment')} optional hint={t('ownerAccounting.correction.attachmentHint')}>
        <Input value={attachment} maxLength={500} autoComplete="off" onChange={(event) => setAttachment(event.target.value)} data-testid="correction-attachment" />
      </Field>
    </FormDialog>
  );
}
