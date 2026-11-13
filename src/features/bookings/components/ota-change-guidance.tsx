import { useTranslation } from 'react-i18next';
import { getBookingSourceLabel } from '@/lib/i18n-labels';
import { cn } from '@/lib/utils';
import type { ChannelAction } from '../lib/booking-change';

/** The sentence of each action: Booking.com has the way its guests do it, the channels that have a name of their own say it, the others say it without. */
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

/** The channels the sentence names (`booking.source.*`): any other portal is "the channel the guest booked through". */
const NAMED_CHANNELS: readonly string[] = ['Airbnb', 'Expedia', 'Vrbo', 'TripAdvisor', 'Agoda'];

interface OtaChangeGuidanceProps {
  /** `modify` to change the dates and the guests, `cancel` to cancel the booking. */
  action: ChannelAction;
  /** The channel as the API names it (`changeOptions.channel`: `BookingCom`, `Airbnb`...). */
  channel: string | null | undefined;
  className?: string;
}

/**
 * The one sentence that says how to ask the guest or the channel for a change or a cancellation (E08/F03/US02, NF-75, NF-76): a booking that came from a channel
 * through the channel manager is changed and cancelled on its channel, where the channel does not let the host do it from CasaZen, and there is no form and no button
 * for it. The words are this client's (the API sends only the key of its own sentence, which says the same); the screen that offers the action decides when to show it
 * (`channelGuidanceOf`).
 */
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
