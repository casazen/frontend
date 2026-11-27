import { useId, useState } from 'react';
import { Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { REVIEW_MAX_RATING } from '@/types';

interface StarInputProps {
  value: number;
  onChange: (value: number) => void;
  legend: string;
  error?: string;
  disabled?: boolean;
}

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
