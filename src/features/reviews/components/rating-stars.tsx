import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { REVIEW_MAX_RATING } from '@/types';

interface RatingStarsProps {
  /** The mark, 0 to 5. A fraction (an average) is rounded to the nearest whole star. */
  value: number;
  /** Size of one star. */
  className?: string;
}

/**
 * Five stars, filled up to the mark. Only a picture: it is hidden from a screen reader, which reads the words next to it ("4 su 5"),
 * and the shape (filled or only an outline) says the mark without the colour.
 */
export function RatingStars({ value, className }: RatingStarsProps) {
  const filled = Math.max(0, Math.min(REVIEW_MAX_RATING, Math.round(value)));

  return (
    <span aria-hidden="true" className="inline-flex shrink-0 items-center gap-0.5 text-[var(--cz-public-primary-text,var(--color-primary))]">
      {Array.from({ length: REVIEW_MAX_RATING }, (_, index) => (
        <Star key={index} className={cn('size-4', index < filled && 'fill-current', className)} strokeWidth={index < filled ? 1.5 : 2} />
      ))}
    </span>
  );
}
