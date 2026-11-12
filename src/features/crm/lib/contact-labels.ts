import type { TFunction } from 'i18next';
import type { CrmContact } from '@/types/crm.types';

/**
 * The words of the contacts of a profile (NF-89): where a contact came from, what it may be used for, whether the guest confirmed it, and
 * why it is or is not marketable. The keys are written out, so that the i18n test finds a missing translation; a value the app does not
 * know yet (the server is newer) is shown as it came.
 */
const ORIGINS: ReadonlyArray<{ origin: string; labelKey: string }> = [
  { origin: 'OtaForward', labelKey: 'crm.contacts.origin.OtaForward' },
  { origin: 'CheckIn', labelKey: 'crm.contacts.origin.CheckIn' },
  { origin: 'DirectBooking', labelKey: 'crm.contacts.origin.DirectBooking' },
  { origin: 'Manual', labelKey: 'crm.contacts.origin.Manual' },
  { origin: 'OctorateContactInfo', labelKey: 'crm.contacts.origin.OctorateContactInfo' },
  { origin: 'WelcomePage', labelKey: 'crm.contacts.origin.WelcomePage' },
  { origin: 'GuestPage', labelKey: 'crm.contacts.origin.GuestPage' },
];

const BASES: ReadonlyArray<{ basis: string; labelKey: string }> = [
  { basis: 'Consent', labelKey: 'crm.contacts.basis.Consent' },
  { basis: 'SoftOptIn', labelKey: 'crm.contacts.basis.SoftOptIn' },
  { basis: 'ServiceOnly', labelKey: 'crm.contacts.basis.ServiceOnly' },
  { basis: 'None', labelKey: 'crm.contacts.basis.None' },
];

const CONFIRMATIONS: ReadonlyArray<{ confirmation: string; labelKey: string }> = [
  { confirmation: 'Confirmed', labelKey: 'crm.contacts.confirmation.Confirmed' },
  { confirmation: 'Pending', labelKey: 'crm.contacts.confirmation.Pending' },
  { confirmation: 'Unconfirmed', labelKey: 'crm.contacts.confirmation.Unconfirmed' },
];

const CHANNELS: ReadonlyArray<{ channel: string; labelKey: string }> = [
  { channel: 'Email', labelKey: 'crm.contacts.channel.Email' },
  { channel: 'Phone', labelKey: 'crm.contacts.channel.Phone' },
  { channel: 'WhatsApp', labelKey: 'crm.contacts.channel.WhatsApp' },
];

/** The codes of `reachabilityReason` and the sentence of each: why the contact cannot be written to for marketing. */
const REASONS: ReadonlyArray<{ reason: string; sentenceKey: string }> = [
  { reason: 'suppressed', sentenceKey: 'crm.contacts.reachability.suppressed' },
  { reason: 'ota_forward', sentenceKey: 'crm.contacts.reachability.otaForward' },
  { reason: 'not_confirmed', sentenceKey: 'crm.contacts.reachability.notConfirmed' },
  { reason: 'no_basis', sentenceKey: 'crm.contacts.reachability.noBasis' },
  { reason: 'channel_not_available', sentenceKey: 'crm.contacts.reachability.channelNotAvailable' },
];

/** Where a contact came from, in words ("Online check-in", "Forward address of a booking channel"). */
export function originLabel(t: TFunction, origin: string): string {
  const known = ORIGINS.find((entry) => entry.origin === origin);
  return known ? t(known.labelKey) : origin;
}

/** What a contact may be used for, in words ("Consent", "Service only"). */
export function basisLabel(t: TFunction, basis: string): string {
  const known = BASES.find((entry) => entry.basis === basis);
  return known ? t(known.labelKey) : basis;
}

/** Whether the guest confirmed the address, in words. */
export function confirmationLabel(t: TFunction, confirmation: string): string {
  const known = CONFIRMATIONS.find((entry) => entry.confirmation === confirmation);
  return known ? t(known.labelKey) : confirmation;
}

/** The name of the channel of a contact ("E-mail", "Phone", "WhatsApp"). */
export function contactChannelLabel(t: TFunction, channel: string): string {
  const known = CHANNELS.find((entry) => entry.channel === channel);
  return known ? t(known.labelKey) : channel;
}

/**
 * Whether the contact may be written to for marketing, as one sentence: that it may, or why it may not. A reason the app does not know
 * yet still gets a sentence that says it may not.
 */
export function reachabilitySentence(t: TFunction, contact: Pick<CrmContact, 'marketable' | 'reachabilityReason'>): string {
  if (contact.marketable) return t('crm.contacts.reachability.marketable');
  const known = REASONS.find((entry) => entry.reason === contact.reachabilityReason);
  return t(known ? known.sentenceKey : 'crm.contacts.reachability.unknown');
}
