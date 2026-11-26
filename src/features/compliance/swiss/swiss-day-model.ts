import { todayInZurich } from '@/lib/stay-dates';
import {
  GUEST_REGISTRATION_CERTAINTIES,
  GUEST_REGISTRATION_CHANNELS,
  GUEST_REGISTRATION_DEADLINE_KINDS,
  type GuestRegistrationCertainty,
} from '@/types/guest-registration.types';
import type { SwissDocumentKind, SwissNotificationDay, SwissNotificationGuest } from '@/types/swissCompliance.types';

/**
 * The pure part of the layer of the assisted notification of the cantons other than Ticino (E31/F02/US02/T02, NF-131, casazen/backend#979): the steps, how they stand, the guests as
 * fields to copy and the words that are chosen by what the server says. Nothing here is kept: every state comes from the day the server sends, so the layer can be left and come back to.
 */

/** The steps of the layer, in the order the host does them: copy the guests, open the portal of the canton, say it was done. */
export type SwissStepId = 'guests' | 'portal' | 'declare';

export const SWISS_STEPS: readonly SwissStepId[] = ['guests', 'portal', 'declare'];

/** How a step stands, from what the server says: `done`, `attention` (the guests step while a guest misses data or nobody is listed) or `todo`. */
export type SwissStepState = 'done' | 'attention' | 'todo';

/** Which of the three states a day is in, which is what the line under the title says: no arrival, declared as notified, or still to notify. */
export type SwissDayState = 'none' | 'declared' | 'open';

export function dayStateOf(day: Pick<SwissNotificationDay, 'stayCount' | 'alreadyDeclared'>): SwissDayState {
  if (day.alreadyDeclared) return 'declared';
  return day.stayCount === 0 ? 'none' : 'open';
}

/**
 * A day that has not started in Switzerland yet cannot be declared notified: the declaration would silence the alerts of an arrival that has not happened
 * (`swiss_declaration_day_in_future` of the API). An address typed or shared can open one.
 */
export function isFutureDay(day: Pick<SwissNotificationDay, 'day'>, now: Date = new Date()): boolean {
  return day.day > todayInZurich(now);
}

/** The step the layer opens on when the person has not chosen one (so it can be left and come back to): the declaration of a closed day, else the guests to copy. */
export function firstStepOf(day: Pick<SwissNotificationDay, 'alreadyDeclared'>): SwissStepId {
  return day.alreadyDeclared ? 'declare' : 'guests';
}

export function stepStateOf(step: SwissStepId, day: Pick<SwissNotificationDay, 'alreadyDeclared' | 'guests' | 'issues'>): SwissStepState {
  if (day.alreadyDeclared) return 'done';
  if (step === 'guests') return day.guests.length > 0 && day.issues.length === 0 ? 'done' : 'attention';
  return 'todo';
}

/** The codes of what a guest misses that the layer has words for (`swissNotification.issues.missing.<code>`; `TicinoMissing` of the backend). */
const KNOWN_MISSING_CODES: readonly string[] = ['firstName', 'lastName', 'birthDate', 'nationality', 'documentType', 'guests'];

/** What the list of a guest's missing data says, as keys of the locale files; a code this version has no words for is left out, never shown as it came. */
export function missingKeysOf(codes: readonly string[]): string[] {
  return codes.filter((code) => KNOWN_MISSING_CODES.includes(code)).map((code) => `swissNotification.issues.missing.${code}`);
}

/** The portal is a page on https: whatever else an answer says is not offered as a link. `host` is how the link is told apart. */
export function portalLinkOf(day: Pick<SwissNotificationDay, 'portalUrl'>): { href: string; host: string } | null {
  const url = day.portalUrl?.trim();
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' ? { href: parsed.href, host: parsed.host } : null;
  } catch {
    return null;
  }
}

/** How sure the source of the regime is: a certainty this version does not know reads as the most prudent one, never as the raw value. */
export function certaintyOf(day: Pick<SwissNotificationDay, 'certainty'>): GuestRegistrationCertainty {
  return GUEST_REGISTRATION_CERTAINTIES.includes(day.certainty) ? day.certainty : 'Unverified';
}

/** The key of the sentence of an enum of the regime (`guestRegistration.channel.PortalForm`); a member this version does not know reads as «to check with the municipality or the police». */
export function regimeTextKey(group: 'channel' | 'deadline', value: unknown): string {
  const known: readonly string[] = group === 'channel' ? GUEST_REGISTRATION_CHANNELS : GUEST_REGISTRATION_DEADLINE_KINDS;
  return typeof value === 'string' && known.includes(value) ? `guestRegistration.${group}.${value}` : 'guestRegistration.toVerify';
}

/** The fields of a guest the host copies, in the order the portals ask them. */
export const SWISS_GUEST_FIELDS = [
  'lastName',
  'firstName',
  'birthDate',
  'placeOfBirth',
  'nationality',
  'nationalityCode',
  'documentType',
  'documentNumber',
  'street',
  'postalCode',
  'city',
  'residenceCountryCode',
  'plate',
  'arrival',
  'departure',
] as const;

export type SwissGuestFieldId = (typeof SWISS_GUEST_FIELDS)[number];

/** One field of a guest, ready to show and to copy: what it is and its value as the host pastes it. */
export interface SwissGuestField {
  id: SwissGuestFieldId;
  value: string;
}

/** `2026-11-19` as the Swiss write it, `19.11.2026` (the form of the Ticino file, of the group sheet and of the register); what is not a day is given back as it came. */
export function swissDateOf(day: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(day);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : day;
}

const DOCUMENT_KINDS: readonly SwissDocumentKind[] = ['passport', 'identityCard', 'other'];

/** The kind of document the day sends; one this version does not know is «other», never the raw value. */
export function documentKindOf(value: string | null): SwissDocumentKind | null {
  if (value === null || value.trim() === '') return null;
  return (DOCUMENT_KINDS as readonly string[]).includes(value) ? (value as SwissDocumentKind) : 'other';
}

const textOrNull = (value: string | null): string | null => {
  const text = value?.trim();
  return text ? text : null;
};

/**
 * The fields a guest has, in order, as the host pastes them onto the portal: a field the check-in did not record is left out (what it misses is in the issues of the day). Dates are
 * `dd.MM.yyyy`; the document is the word of its kind (`documentWord`), never a code; the rest is as it was recorded.
 */
export function fieldsOf(guest: SwissNotificationGuest, documentWord: (kind: SwissDocumentKind) => string): SwissGuestField[] {
  const kind = documentKindOf(guest.documentType);
  const values: Record<SwissGuestFieldId, string | null> = {
    lastName: textOrNull(guest.lastName),
    firstName: textOrNull(guest.firstName),
    birthDate: guest.birthDate ? swissDateOf(guest.birthDate) : null,
    placeOfBirth: textOrNull(guest.placeOfBirth),
    nationality: textOrNull(guest.nationality),
    nationalityCode: textOrNull(guest.nationalityCode),
    documentType: kind ? documentWord(kind) : null,
    documentNumber: textOrNull(guest.documentNumber),
    street: textOrNull(guest.street),
    postalCode: textOrNull(guest.postalCode),
    city: textOrNull(guest.city),
    residenceCountryCode: textOrNull(guest.residenceCountryCode),
    plate: textOrNull(guest.plate),
    arrival: guest.arrival ? swissDateOf(guest.arrival) : null,
    departure: guest.departure ? swissDateOf(guest.departure) : null,
  };
  return SWISS_GUEST_FIELDS.flatMap((id) => {
    const value = values[id];
    return value === null ? [] : [{ id, value }];
  });
}

/** The name of a guest as the block is titled («Mario Rossi»); `fallback` when the check-in has neither name. */
export function guestNameOf(guest: Pick<SwissNotificationGuest, 'firstName' | 'lastName'>, fallback: string): string {
  const name = [textOrNull(guest.firstName), textOrNull(guest.lastName)].filter(Boolean).join(' ');
  return name || fallback;
}

/** All the fields of a guest as lines of text, `label: value`, for «Copia tutto». */
export function copyAllTextOf(fields: readonly SwissGuestField[], labelOf: (id: SwissGuestFieldId) => string): string {
  return fields.map((field) => `${labelOf(field.id)}: ${field.value}`).join('\n');
}
