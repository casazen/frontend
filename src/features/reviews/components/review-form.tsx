import { useId } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { REVIEW_MAX_RATING, REVIEW_TEXT_MAX_LENGTH } from '@/types';
import { StarInput } from './star-input';

// The messages are i18n keys: the form translates them when it draws them.
const reviewSchema = z.object({
  rating: z.number().int().min(1, 'siteReviews.form.ratingRequired').max(REVIEW_MAX_RATING, 'siteReviews.form.ratingRequired'),
  text: z.string().max(REVIEW_TEXT_MAX_LENGTH, 'siteReviews.form.textTooLong'),
  showName: z.boolean(),
});

export type ReviewFormValues = z.infer<typeof reviewSchema>;

interface ReviewFormProps {
  onSubmit: (values: ReviewFormValues) => void;
  isPending: boolean;
  /** Why the last attempt failed, already translated; shown over the button. */
  errorMessage?: string;
}

/**
 * The guest's review (DB-12b): a mark from 1 to 5 stars chosen with the keyboard or a tap, a text that may stay empty, and whether the
 * first name is shown (otherwise «Ospite»). The text is never required. It is sent as it is: the page of the host shows it as text.
 */
export function ReviewForm({ onSubmit, isPending, errorMessage }: ReviewFormProps) {
  const { t } = useTranslation();
  const showNameId = useId();
  const {
    control,
    handleSubmit,
    register,
    formState: { errors },
  } = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewSchema),
    defaultValues: { rating: 0, text: '', showName: true },
  });
  const length = useWatch({ control, name: 'text' }).length;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6" data-testid="review-form">
      <Controller
        name="rating"
        control={control}
        render={({ field }) => (
          <StarInput
            value={field.value}
            onChange={field.onChange}
            legend={t('siteReviews.form.ratingLegend')}
            error={errors.rating?.message ? t(errors.rating.message) : undefined}
            disabled={isPending}
          />
        )}
      />

      <Field
        label={t('siteReviews.form.textLabel')}
        optional
        counter={t('siteReviews.form.counter', { length, max: REVIEW_TEXT_MAX_LENGTH })}
        error={errors.text}
      >
        <Textarea
          {...register('text')}
          rows={5}
          maxLength={REVIEW_TEXT_MAX_LENGTH}
          placeholder={t('siteReviews.form.textPlaceholder')}
          disabled={isPending}
          className="min-h-32"
        />
      </Field>

      <label htmlFor={showNameId} className="flex min-h-11 cursor-pointer items-start gap-3">
        <Controller
          name="showName"
          control={control}
          render={({ field }) => (
            <Checkbox
              id={showNameId}
              checked={field.value}
              onCheckedChange={(checked) => field.onChange(checked === true)}
              disabled={isPending}
              className="mt-0.5 size-5"
            />
          )}
        />
        <span className="text-sm leading-snug">{t('siteReviews.form.showName')}</span>
      </label>

      {errorMessage ? (
        <p role="alert" className="text-sm text-[color:var(--color-danger-foreground,#b4232a)]" data-testid="review-form-error">
          {errorMessage}
        </p>
      ) : null}

      <div className="space-y-2">
        <Button type="submit" className="min-h-11 w-full sm:w-auto" disabled={isPending} data-testid="review-form-submit">
          {isPending ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" /> : null}
          {isPending ? t('siteReviews.form.sending') : t('siteReviews.form.submit')}
        </Button>
        <p className="text-sm text-[var(--cz-public-muted)]">{t('siteReviews.form.howItWorks')}</p>
      </div>
    </form>
  );
}
