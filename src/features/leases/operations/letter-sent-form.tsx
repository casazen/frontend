import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { isStayDate, parseStayDate, todayInRome } from '@/lib/stay-dates';
import { useMarkLetterSent } from '@/queries/use-lease-operations';
import { LEASE_LETTER_MEANS, type LeaseLetterKind, type LeaseLetterMeans, type LeaseLetterSent } from '@/types';
import { longDay } from '../lifecycle/lifecycle-format';

interface LetterSentFormProps {
  leaseId: string;
  startDate: string;
  kind: LeaseLetterKind;
  sent: LeaseLetterSent | null;
}

export function LetterSentForm({ leaseId, startDate, kind, sent }: LetterSentFormProps) {
  const { t, i18n } = useTranslation();
  const mark = useMarkLetterSent(leaseId);
  const today = todayInRome();
  const start = parseStayDate(startDate);
  const [sentOn, setSentOn] = useState(today);
  const [means, setMeans] = useState<LeaseLetterMeans>('RegisteredMail');

  const dateValid = isStayDate(sentOn) && sentOn <= today && (start === '' || sentOn >= start);

  async function submit(event: FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!dateValid || mark.isPending) return;
    try {
      await mark.mutateAsync({ kind, input: { sentOn, means } });
    } catch {
      return;
    }
    toast.success(t('leaseOperations.sent.saved'));
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="min-w-0 space-y-3" noValidate data-testid={`letter-sent-form-${kind}`}>
      <p className="break-words text-foreground/80">{t('leaseOperations.sent.hint')}</p>
      {sent ? (
        <p className="break-words font-medium" data-testid={`letter-sent-done-${kind}`}>
          {t('leaseOperations.sent.done', { date: longDay(sent.on, i18n.language), means: t(`leaseOperations.means.${sent.means}`) })}
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label={t('leaseOperations.sent.dateLabel')}
          error={sentOn !== '' && !dateValid ? t('leaseOperations.sent.dateInvalid') : undefined}
        >
          <Input
            type="date"
            value={sentOn}
            min={start || undefined}
            max={today}
            onChange={(event) => setSentOn(event.target.value)}
            className="pointer-coarse:h-11"
            data-testid={`letter-sent-date-${kind}`}
          />
        </Field>
        <Field label={t('leaseOperations.sent.meansLabel')}>
          <Select
            value={means}
            onChange={(event) => setMeans(event.target.value as LeaseLetterMeans)}
            className="pointer-coarse:h-11"
            data-testid={`letter-sent-means-${kind}`}
          >
            {LEASE_LETTER_MEANS.map((option) => (
              <option key={option} value={option}>
                {t(`leaseOperations.means.${option}`)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Button type="submit" variant="outline" className="min-h-11" loading={mark.isPending} disabled={!dateValid}>
        {sent ? t('leaseOperations.sent.again') : t('leaseOperations.sent.submit')}
      </Button>
    </form>
  );
}
