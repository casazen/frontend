import type { ReactNode } from 'react';
import { CreditCard, Network, PenLine, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { STATUS_TONE_CLASSES } from '@/components/shared/status/status-view';
import { getBookingSourceLabel } from '@/lib/i18n-labels';
import { cn } from '@/lib/utils';
import { BOOKING_AMOUNT_SOURCES, type BookingAmountSource } from '@/types';
import { CHANNEL_ICONS, channelOf } from '../lib/ota-stay';

/** How a link looks inside a fact: the accent of the area, underlined, and a 44 px row to tap on a phone. */
export const FACT_LINK = 'inline-flex min-h-11 items-center break-all font-medium text-primary-text underline underline-offset-4 hover:no-underline md:min-h-0';

/**
 * Things a booking says, one per row, without a box around them: the name above its value on a phone, side by side from `sm`.
 * A long value (an e-mail, a name with no space) wraps instead of pushing the page sideways.
 */
export function Facts({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn('min-w-0 space-y-3', className)}>{children}</dl>;
}

export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid min-w-0 gap-0.5 sm:grid-cols-[minmax(7rem,11rem)_minmax(0,1fr)] sm:gap-x-6">
      <dt className="text-sm text-foreground/70 sm:pt-0.5">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

/**
 * "OTA" (ADR-033-R9): the booking came through a channel and the channel manager brought it in. A word on a soft background, so it is
 * never told by color alone.
 */
export function OtaBadge() {
  const { t } = useTranslation();
  return (
    <span
      data-testid="booking-ota-badge"
      className={cn('inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset', STATUS_TONE_CLASSES.info)}
    >
      {t('booking.list.otaBadge')}
    </span>
  );
}

/** Where the booking came from, as the facts say it: the icon of its channel, its name and, for a channel booking, the "OTA" badge. */
export function BookingSourceValue({ source, ota }: { source: string; ota: boolean }) {
  const { t } = useTranslation();
  const Icon = CHANNEL_ICONS[channelOf(source)];
  return (
    <span className="inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1">
      <Icon className="size-4 shrink-0 text-foreground/70" aria-hidden="true" />
      <span data-testid="booking-detail-source">{getBookingSourceLabel(source, t)}</span>
      {ota ? <OtaBadge /> : null}
    </span>
  );
}

const AMOUNT_SOURCE_ICONS: Record<BookingAmountSource, LucideIcon> = { Stripe: CreditCard, ChannelManager: Network, Manual: PenLine };

const isAmountSource = (source: string | null | undefined): source is BookingAmountSource =>
  !!source && (BOOKING_AMOUNT_SOURCES as readonly string[]).includes(source);

/**
 * Where a figure comes from (AC-NF77-4, AC-NF77-5): Stripe, the channel manager or the host's own entry, as an icon and a word and
 * never as a color. A source this client does not know draws nothing: a figure with no tag is better than a wrong one.
 */
export function AmountSourceTag({ source }: { source: string | null | undefined }) {
  const { t } = useTranslation();
  if (!isAmountSource(source)) return null;
  const Icon = AMOUNT_SOURCE_ICONS[source];
  return (
    <span
      data-testid="booking-amount-source"
      data-source={source}
      className={cn('inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', STATUS_TONE_CLASSES.neutral)}
    >
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      <span className="sr-only">{t('booking.detailPage.source')}: </span>
      <span className="min-w-0 break-words">{t(`booking.amountSource.${source}`)}</span>
    </span>
  );
}

/** The tag of a source on a line of its own, at the right, under the figure it belongs to; nothing for a source that is not ours. */
export function AmountSourceLine({ source, className }: { source: string | null | undefined; className?: string }) {
  if (!isAmountSource(source)) return null;
  return (
    <span className={cn('flex justify-end', className)}>
      <AmountSourceTag source={source} />
    </span>
  );
}

/**
 * A figure of a booking: its name on the left and its value on the right, with the tag of its source under the value when the API
 * says where the figure comes from. The name wraps; the value, and the tag under it, do not push it away.
 */
export function Amount({
  label,
  labelTestId,
  source,
  children,
}: {
  label: string;
  labelTestId?: string;
  source?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-4">
      <dt className="min-w-0 break-words text-sm text-foreground/70" data-testid={labelTestId}>
        {label}
      </dt>
      <dd className="shrink-0 text-right tabular-nums">
        {children}
        <AmountSourceLine source={source} className="mt-0.5" />
      </dd>
    </div>
  );
}
