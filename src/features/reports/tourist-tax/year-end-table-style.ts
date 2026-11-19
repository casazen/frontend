import type { BadgeProps } from '@/components/ui/badge';
import type { TouristTaxSummaryStatus } from '@/types';

// The cells of the tables of the figures of the year, written as the summary by comune writes its own (`comune-summary-table.tsx`): the first column stays in sight while a table scrolls sideways on a phone, so every figure
// keeps the name of its row.
export const STICKY = 'sticky left-0 z-10 bg-background';
export const HEAD = 'px-3 py-2 font-medium';
export const FIGURE = 'px-3 py-2 text-right align-top tabular-nums';

/** The state of a comune is always said in words in its badge; the tone only helps the eye (what is still to pay is the one that asks). The tones of the summary by comune. */
export const STATUS_TONES: Record<TouristTaxSummaryStatus, NonNullable<BadgeProps['variant']>> = {
  NothingOwed: 'outline',
  ToPay: 'warning',
  Paid: 'success',
  Overpaid: 'secondary',
};
