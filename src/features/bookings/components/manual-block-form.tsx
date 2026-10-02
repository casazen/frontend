import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getProblemMessage } from '@/lib/api-errors';
import { addDays, isStayDate, nightsBetween, todayInRome } from '@/lib/stay-dates';
import { useCreateManualBlock } from '@/queries/use-manual-blocks';
import {
  MANUAL_BLOCK_MAX_NIGHTS,
  MANUAL_BLOCK_NOTE_MAX_LENGTH,
  MANUAL_BLOCK_REASONS,
  type CreateManualBlockDto,
  type ManualBlockReason,
} from '@/types/calendar.types';

interface ManualBlockFormProps {
  propertyId: string;
  /** First night to close (`YYYY-MM-DD`), e.g. the first day selected on the calendar. */
  initialStart?: string;
  /** First free day after the block (`YYYY-MM-DD`). */
  initialEnd?: string;
  onCreated: () => void;
  onCancel: () => void;
}

type Field = 'startDate' | 'endDate' | 'reason' | 'note';
type FieldErrors = Partial<Record<Field, string>>;

/**
 * "Blocca date" (PC-09, A2-25): the host closes nights by hand, with a reason (owner stay, maintenance, other) and an
 * optional note seen by the host only. The dates are stay dates: the block closes the nights from the first day to the
 * day before "free from", like a stay from arrival to departure. API errors (a booking or another block on those nights)
 * stay in the form.
 */
export function ManualBlockForm({ propertyId, initialStart, initialEnd, onCreated, onCancel }: ManualBlockFormProps) {
  const { t } = useTranslation();
  const createBlock = useCreateManualBlock();
  const today = todayInRome();
  const firstNight = initialStart && initialStart >= today ? initialStart : today;
  const [startDate, setStartDate] = useState(firstNight);
  const [endDate, setEndDate] = useState(initialEnd && initialEnd > firstNight ? initialEnd : addDays(firstNight, 1));
  const [reason, setReason] = useState<ManualBlockReason | ''>('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});

  // A new attempt hides the error of the previous one.
  const edit = (field: Field, update: () => void) => {
    if (createBlock.isError) createBlock.reset();
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
    update();
  };

  const validate = (): { data?: CreateManualBlockDto; errors: FieldErrors } => {
    const found: FieldErrors = {};
    if (!isStayDate(startDate)) found.startDate = t('booking.calendar.manualBlock.validation.startRequired');
    else if (startDate < today) found.startDate = t('booking.calendar.manualBlock.validation.startInPast');
    if (!isStayDate(endDate)) found.endDate = t('booking.calendar.manualBlock.validation.endRequired');
    else if (isStayDate(startDate) && endDate <= startDate)
      found.endDate = t('booking.calendar.manualBlock.validation.endAfterStart');
    else if (isStayDate(startDate) && nightsBetween(startDate, endDate) > MANUAL_BLOCK_MAX_NIGHTS)
      found.endDate = t('booking.calendar.manualBlock.validation.tooLong', { max: MANUAL_BLOCK_MAX_NIGHTS });
    if (!reason) found.reason = t('booking.calendar.manualBlock.validation.reasonRequired');
    const text = note.trim();
    if (text.length > MANUAL_BLOCK_NOTE_MAX_LENGTH)
      found.note = t('booking.calendar.manualBlock.validation.noteTooLong', { max: MANUAL_BLOCK_NOTE_MAX_LENGTH });

    if (Object.keys(found).length > 0 || !reason) return { errors: found };
    return { errors: found, data: { startDate, endDate, reason, ...(text ? { note: text } : {}) } };
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const result = validate();
    setErrors(result.errors);
    if (!result.data) return;
    createBlock.mutate({ propertyId, data: result.data }, { onSuccess: () => onCreated() });
  };

  // Error text of a field and the attributes that tie it to its input.
  const fieldState = (field: Field) => {
    const message = errors[field];
    const id = `manual-block-${field}-error`;
    return {
      aria: message ? { 'aria-invalid': true as const, 'aria-describedby': id } : {},
      error: message ? (
        <p id={id} className="text-sm text-destructive" role="alert">
          {message}
        </p>
      ) : null,
    };
  };
  const startField = fieldState('startDate');
  const endField = fieldState('endDate');
  const reasonField = fieldState('reason');
  const noteField = fieldState('note');
  const nights = isStayDate(startDate) && isStayDate(endDate) && endDate > startDate ? nightsBetween(startDate, endDate) : 0;

  return (
    <form className="space-y-4" onSubmit={handleSubmit} noValidate data-testid="manual-block-form">
      <p className="text-sm text-muted-foreground">{t('booking.calendar.manualBlock.formHint')}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="manual-block-start">{t('booking.calendar.manualBlock.startDate')}</Label>
          <Input
            id="manual-block-start"
            type="date"
            min={today}
            value={startDate}
            onChange={(e) => edit('startDate', () => setStartDate(e.target.value))}
            {...startField.aria}
          />
          {startField.error}
        </div>
        <div className="space-y-2">
          <Label htmlFor="manual-block-end">{t('booking.calendar.manualBlock.endDate')}</Label>
          <Input
            id="manual-block-end"
            type="date"
            min={isStayDate(startDate) ? addDays(startDate, 1) : today}
            value={endDate}
            onChange={(e) => edit('endDate', () => setEndDate(e.target.value))}
            {...endField.aria}
          />
          <p className="text-xs text-muted-foreground">{t('booking.calendar.manualBlock.endDateHint')}</p>
          {endField.error}
        </div>
      </div>
      {nights > 0 && (
        <p className="text-sm" data-testid="manual-block-nights">
          {t('booking.calendar.manualBlock.nights', { count: nights })}
        </p>
      )}
      <div className="space-y-2">
        <Label htmlFor="manual-block-reason">{t('booking.calendar.manualBlock.reason')}</Label>
        <select
          id="manual-block-reason"
          value={reason}
          onChange={(e) => edit('reason', () => setReason(e.target.value as ManualBlockReason | ''))}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          {...reasonField.aria}
        >
          <option value="">{t('booking.calendar.manualBlock.reasonPlaceholder')}</option>
          {MANUAL_BLOCK_REASONS.map((value) => (
            <option key={value} value={value}>
              {t(`booking.calendar.manualBlock.reasons.${value}`)}
            </option>
          ))}
        </select>
        {reasonField.error}
      </div>
      <div className="space-y-2">
        <Label htmlFor="manual-block-note">{t('booking.calendar.manualBlock.note')}</Label>
        <Textarea
          id="manual-block-note"
          rows={2}
          maxLength={MANUAL_BLOCK_NOTE_MAX_LENGTH}
          value={note}
          onChange={(e) => edit('note', () => setNote(e.target.value))}
          {...noteField.aria}
        />
        <p className="text-xs text-muted-foreground">{t('booking.calendar.manualBlock.noteHint')}</p>
        {noteField.error}
      </div>

      {createBlock.isError && (
        <p className="text-sm text-destructive" role="alert" data-testid="manual-block-error">
          {getProblemMessage(createBlock.error, t) ?? t('booking.calendar.manualBlock.createFailed')}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={createBlock.isPending}>
          {t('booking.calendar.manualBlock.cancel')}
        </Button>
        <Button type="submit" disabled={createBlock.isPending}>
          {createBlock.isPending ? t('booking.calendar.manualBlock.submitting') : t('booking.calendar.manualBlock.submit')}
        </Button>
      </div>
    </form>
  );
}
