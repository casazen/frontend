import type { TFunction } from 'i18next';
import { GUEST_LOCALE_OPTIONS } from '@/features/checkin/lib/guest-locale';

/**
 * The booking sources a guest can have booked on (backend `BookingSource`), with the key of the name of each. The filter of the list
 * offers these, and the lists, the chips and the history name them. The keys are written out, so that the i18n test finds a missing
 * translation.
 */
export const CRM_CHANNELS: ReadonlyArray<{ channel: string; labelKey: string }> = [
  { channel: 'Direct', labelKey: 'crm.channels.Direct' },
  { channel: 'Airbnb', labelKey: 'crm.channels.Airbnb' },
  { channel: 'BookingCom', labelKey: 'crm.channels.BookingCom' },
  { channel: 'Expedia', labelKey: 'crm.channels.Expedia' },
  { channel: 'Vrbo', labelKey: 'crm.channels.Vrbo' },
  { channel: 'TripAdvisor', labelKey: 'crm.channels.TripAdvisor' },
  { channel: 'Agoda', labelKey: 'crm.channels.Agoda' },
  { channel: 'Manual', labelKey: 'crm.channels.Manual' },
  { channel: 'OtherChannel', labelKey: 'crm.channels.OtherChannel' },
  { channel: 'Local', labelKey: 'crm.channels.Local' },
];

/**
 * The name of a channel. `portal` is the name a channel manager gave a portal that has no value of its own (`OtherChannel`): it is the
 * most exact name there is. A channel the app does not know yet (the server is newer) is shown as it came.
 */
export function channelLabel(t: TFunction, channel: string, portal?: string | null): string {
  if (channel === 'OtherChannel' && portal?.trim()) return portal.trim();
  const known = CRM_CHANNELS.find((entry) => entry.channel === channel);
  return known ? t(known.labelKey) : channel;
}

/** The name of a language, written in the language of the app, for a language the product has texts for; the code otherwise. */
export function languageLabel(t: TFunction, language: string): string {
  const code = language.trim().toLowerCase();
  const known = GUEST_LOCALE_OPTIONS.find((option) => option.locale === code);
  return known ? t(known.nameKey) : code.toUpperCase();
}
