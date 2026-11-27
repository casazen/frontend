import { useTranslation } from 'react-i18next';
import { getBookingSourceLabel } from '@/lib/i18n-labels';
import { cn } from '@/lib/utils';
import type { ChannelAction } from '../lib/booking-change';

const GUIDANCE_KEYS = {
  modify: {
    bookingCom: 'booking.changeGuidance.modify.bookingCom',
    channel: 'booking.changeGuidance.modify.channel',
    default: 'booking.changeGuidance.modify.default',
  },
  cancel: {
    bookingCom: 'booking.changeGuidance.cancel.bookingCom',
    channel: 'booking.changeGuidance.cancel.channel',
    default: 'booking.changeGuidance.cancel.default',
  },
} as const;

const NAMED_CHANNELS: readonly string[] = ['Airbnb', 'Expedia', 'Vrbo', 'TripAdvisor', 'Agoda'];

interface OtaChangeGuidanceProps {
  action: ChannelAction;
  channel: string | null | undefined;
  className?: string;
}

export function OtaChangeGuidance({ action, channel, className }: OtaChangeGuidanceProps) {
  const { t } = useTranslation();
  const keys = GUIDANCE_KEYS[action];

  const text =
    channel === 'BookingCom'
      ? t(keys.bookingCom)
      : channel && NAMED_CHANNELS.includes(channel)
        ? t(keys.channel, { channel: getBookingSourceLabel(channel, t) })
        : t(keys.default);

  return (
    <p
      className={cn('max-w-prose text-sm text-foreground/70', className)}
      data-testid="ota-change-guidance"
      data-action={action}
      data-channel={channel ?? undefined}
    >
      {text}
    </p>
  );
}
