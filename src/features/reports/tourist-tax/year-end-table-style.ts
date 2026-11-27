import type { BadgeProps } from '@/components/ui/badge';
import type { TouristTaxSummaryStatus } from '@/types';

export const STICKY = 'sticky left-0 z-10 bg-background';
export const HEAD = 'px-3 py-2 font-medium';
export const FIGURE = 'px-3 py-2 text-right align-top tabular-nums';

export const STATUS_TONES: Record<TouristTaxSummaryStatus, NonNullable<BadgeProps['variant']>> = {
  NothingOwed: 'outline',
  ToPay: 'warning',
  Paid: 'success',
  Overpaid: 'secondary',
};
