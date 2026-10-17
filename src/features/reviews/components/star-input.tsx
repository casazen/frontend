import { useId, useState } from 'react';
import { Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { REVIEW_MAX_RATING } from '@/types';

interface StarInputProps {
  /** The mark chosen, 1 to 5; 0 while there is none. */
  value: number;
  onChange: (value: number) => void;
  /** What the mark is about, for the group ("Com'è andato il soggiorno?"). */
  legend: string;
  /** Why the mark is missing, when it is: told to a screen reader at once. */
  error?: string;
  disabled?: boolean;
}

/**
 * The mark of a review as five stars, a group of radio buttons: Tab enters it, the arrows choose a star (and say "4 stelle su 5"),
 * a click or a tap chooses it. Real radio buttons under the pictures, so the keyboard and the screen reader get the behaviour of the
 * browser and not a copy of it. Every star is a 44 px target; the filled shape, not the colour alone, shows the mark.
 */
export function StarInput({ value, onChange, legend, error, disabled }: StarInputProps) {
  const { t } = useTranslation();
  const name = useId();
  const errorId = useId();
  const [hover, setHover] = useState(0);
  const shown = hover || value;

  return (
    <fieldset className="min-w-0 space-y-2" disabled={disabled} aria-describedby={error ? errorId : undefined}>
      <legend className="text-sm font-semibold">{legend}</legend>
      <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
        {Array.from({ length: REVIEW_MAX_RATING }, (_, index) => {
          const star = index + 1;
          return (
            <label
              key={star}
              className={cn(
                'relative inline-flex size-11 cursor-pointer items-center justify-center rounded-md text-[var(--cz-public-primary-text,var(--color-primary))]',
                'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2',
                disabled && 'cursor-not-allowed opacity-60',
              )}
              onMouseEnter={() => setHover(star)}
            >
              <input
                type="radio"
                name={name}
                value={star}
                checked={value === star}
                onChange={() => onChange(star)}
                className="sr-only"
                aria-label={t('siteReviews.form.starsOf', { count: star, max: REVIEW_MAX_RATING })}
                aria-invalid={error ? true : undefined}
              />
              <Star aria-hidden="true" className={cn('size-8', star <= shown && 'fill-current')} strokeWidth={star <= shown ? 1.5 : 2} />
            </label>
          );
        })}
        <span aria-hidden="true" className="ml-2 text-sm text-[var(--cz-public-muted,var(--color-muted-foreground))]">
          {value > 0 ? t('siteReviews.form.chosen', { value, max: REVIEW_MAX_RATING }) : ''}
        </span>
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-[color:var(--color-danger-foreground,#b4232a)]">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
