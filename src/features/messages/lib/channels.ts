import type { TFunction } from 'i18next';
import { Globe, Repeat, type LucideIcon } from 'lucide-react';
import type { MessageHubChannel } from '@/types';

// The keys are written out (`*Key:` properties) so that the i18n test finds a missing translation.
const CHANNELS: Record<MessageHubChannel, { labelKey: string; icon: LucideIcon }> = {
  Direct: { labelKey: 'messages.channel.direct', icon: Globe },
  Airbnb: { labelKey: 'messages.channel.airbnb', icon: Repeat },
  Booking: { labelKey: 'messages.channel.booking', icon: Repeat },
  Vrbo: { labelKey: 'messages.channel.vrbo', icon: Repeat },
  Expedia: { labelKey: 'messages.channel.expedia', icon: Repeat },
};

/** The name of a channel, one word: «Diretto», «Airbnb», «Booking.com», «Vrbo», «Expedia». A channel a newer server adds is shown as it is. */
export function channelLabel(channel: MessageHubChannel, t: TFunction): string {
  const known = CHANNELS[channel] as { labelKey: string } | undefined;
  return known ? t(known.labelKey) : channel;
}

/** The icon beside the name of a channel: the globe for the site of the host, the arrows for the channels. */
export function channelIcon(channel: MessageHubChannel): LucideIcon {
  return (CHANNELS[channel] as { icon: LucideIcon } | undefined)?.icon ?? Repeat;
}
