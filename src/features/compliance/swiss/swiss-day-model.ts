import { todayInZurich } from '@/lib/stay-dates';
import {
  GUEST_REGISTRATION_CERTAINTIES,
  GUEST_REGISTRATION_CHANNELS,
  GUEST_REGISTRATION_DEADLINE_KINDS,
  type GuestRegistrationCertainty,
} from '@/types/guest-registration.types';
import type { SwissDocumentKind, SwissNotificationDay, SwissNotificationGuest } from '@/types/swissCompliance.types';

export type SwissStepId = 'guests' | 'portal' | 'declare';

export const SWISS_STEPS: readonly SwissStepId[] = ['guests', 'portal', 'declare'];

export type SwissStepState = 'done' | 'attention' | 'todo';

export type SwissDayState = 'none' | 'declared' | 'open';

export function dayStateOf(day: Pick<SwissNotificationDay, 'stayCount' | 'alreadyDeclared'>): SwissDayState {
  if (day.alreadyDeclared) return 'declared';
  return day.stayCount === 0 ? 'none' : 'open';
}

export function isFutureDay(day: Pick<SwissNotificationDay, 'day'>, now: Date = new Date()): boolean {
  return day.day > todayInZurich(now);
}

export function firstStepOf(day: Pick<SwissNotificationDay, 'alreadyDeclared'>): SwissStepId {
  return day.alreadyDeclared ? 'declare' : 'guests';
}

export function stepStateOf(step: SwissStepId, day: Pick<SwissNotificationDay, 'alreadyDeclared' | 'guests' | 'issues'>): SwissStepState {
  if (day.alreadyDeclared) return 'done';
  if (step === 'guests') return day.guests.length > 0 && day.issues.length === 0 ? 'done' : 'attention';
  return 'todo';
}

const KNOWN_MISSING_CODES: readonly string[] = ['firstName', 'lastName', 'birthDate', 'nationality', 'documentType', 'guests'];

export function missingKeysOf(codes: readonly string[]): string[] {
  return codes.filter((code) => KNOWN_MISSING_CODES.includes(code)).map((code) => `swissNotification.issues.missing.${code}`);
}

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

export function certaintyOf(day: Pick<SwissNotificationDay, 'certainty'>): GuestRegistrationCertainty {
  return GUEST_REGISTRATION_CERTAINTIES.includes(day.certainty) ? day.certainty : 'Unverified';
}

export function regimeTextKey(group: 'channel' | 'deadline', value: unknown): string {
  const known: readonly string[] = group === 'channel' ? GUEST_REGISTRATION_CHANNELS : GUEST_REGISTRATION_DEADLINE_KINDS;
  return typeof value === 'string' && known.includes(value) ? `guestRegistration.${group}.${value}` : 'guestRegistration.toVerify';
}

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

export interface SwissGuestField {
  id: SwissGuestFieldId;
  value: string;
}

export function swissDateOf(day: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(day);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : day;
}

const DOCUMENT_KINDS: readonly SwissDocumentKind[] = ['passport', 'identityCard', 'other'];

export function documentKindOf(value: string | null): SwissDocumentKind | null {
  if (value === null || value.trim() === '') return null;
  return (DOCUMENT_KINDS as readonly string[]).includes(value) ? (value as SwissDocumentKind) : 'other';
}

const textOrNull = (value: string | null): string | null => {
  const text = value?.trim();
  return text ? text : null;
};

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

export function guestNameOf(guest: Pick<SwissNotificationGuest, 'firstName' | 'lastName'>, fallback: string): string {
  const name = [textOrNull(guest.firstName), textOrNull(guest.lastName)].filter(Boolean).join(' ');
  return name || fallback;
}

export function copyAllTextOf(fields: readonly SwissGuestField[], labelOf: (id: SwissGuestFieldId) => string): string {
  return fields.map((field) => `${labelOf(field.id)}: ${field.value}`).join('\n');
}
