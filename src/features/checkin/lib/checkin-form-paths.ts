import type { FieldErrors, FieldPath } from 'react-hook-form';
import {
  guestFormPathOf,
  stayGuestDefaults,
  type DocumentLevel,
  type PublicCheckInFormValues,
  type StatisticalGuestField,
  type StayGuestFormValues,
} from '../schemas/checkin.schema';
import { STEP_DOCUMENT, STEP_GUESTS } from './checkin-steps';

export type FormPath = FieldPath<PublicCheckInFormValues>;

/** Fields of each guest checked before leaving the first step (personal data). */
const PERSONAL_FIELDS = [
  'type',
  'firstName',
  'lastName',
  'gender',
  'dateOfBirth',
  'bornInItaly',
  'birthComuneName',
  'birthProvince',
  'birthCountryName',
  'citizenshipName',
  'residenceInItaly',
  'residenceComuneName',
  'residenceProvince',
  'residenceCountryName',
  'residenceStreet',
  'residencePostalCode',
  'residenceCityName',
] as const satisfies readonly (keyof StayGuestFormValues)[];

/** Fields of a single guest or head checked before leaving the second step (document). */
const DOCUMENT_FIELDS = [
  'documentType',
  'documentNumber',
  'documentIssuePlaceName',
  'documentIssuedOn',
  'documentExpiresOn',
] as const satisfies readonly (keyof StayGuestFormValues)[];

/** What a guest of a Swiss stay the police file notifies (not a head) gives of the document: the kind and the number. */
const BASIC_DOCUMENT_FIELDS = ['documentType', 'documentNumber'] as const satisfies readonly (keyof StayGuestFormValues)[];

export function personalPaths(guests: readonly StayGuestFormValues[], statistical: readonly StatisticalGuestField[]): FormPath[] {
  return guests.flatMap((_, index) =>
    [...PERSONAL_FIELDS, ...statistical].map((field) => `guests.${index}.${field}` as FormPath),
  );
}

export function documentPaths(levels: readonly (DocumentLevel | null)[]): FormPath[] {
  return levels.flatMap((level, index) =>
    level === null ? [] : (level === 'full' ? DOCUMENT_FIELDS : BASIC_DOCUMENT_FIELDS).map((field) => `guests.${index}.${field}` as FormPath),
  );
}

/** Server error path → the form path that shows it, or null when the form has no such field. */
export function toFormPath(path: string, guestCount: number): FormPath | null {
  if (path === 'marketingConsentEmail') return 'marketingConsentEmail';
  if (path === 'marketingConsentWhatsApp') return 'marketingConsentWhatsApp';
  if (path === 'marketingEmail') return 'marketingEmail';
  if (path === 'vehiclePlate') return 'vehiclePlate';
  return guestFormPathOf(path, guestCount);
}

/** How many fields are in error, for the announcement that follows a failed attempt (the form keeps the errors in a tree). */
export function countFieldErrors(errors: FieldErrors | undefined): number {
  if (!errors) return 0;
  let count = 0;
  for (const [key, value] of Object.entries(errors)) {
    if (!value || typeof value !== 'object' || ['ref', 'type', 'types', 'root'].includes(key)) continue;
    const entry = value as { message?: unknown } & FieldErrors;
    if (typeof entry.message === 'string' && entry.message) count += 1;
    count += countFieldErrors(entry);
  }
  return count;
}

/**
 * The first step of the page that holds a field the form found invalid when the guest sent it, or `null` when none of the fields of the steps is (the invoice step counts). The guest who
 * came in at the identity step (through the door of the property) may never have typed the data of the first ones: the send takes them there instead of leaving them at a button that
 * seems to do nothing.
 */
export function firstStepWithProblems(errors: FieldErrors<PublicCheckInFormValues>, statistical: readonly StatisticalGuestField[]): number | null {
  const guestErrors: unknown = errors.guests;
  const entries = Array.isArray(guestErrors) ? (guestErrors as Array<Record<string, unknown> | undefined>) : [];
  const fieldsInError = new Set(entries.flatMap((entry) => (entry ? Object.keys(entry) : [])));
  if ([...PERSONAL_FIELDS, ...statistical].some((field) => fieldsInError.has(field))) return STEP_GUESTS;
  // The plate of the car is asked with the guests.
  if (errors.vehiclePlate) return STEP_GUESTS;
  if (DOCUMENT_FIELDS.some((field) => fieldsInError.has(field))) return STEP_DOCUMENT;
  return null;
}

export function emptyForm(): PublicCheckInFormValues {
  return {
    guests: [stayGuestDefaults('SingleGuest')],
    marketingConsentEmail: false,
    marketingConsentWhatsApp: false,
    marketingEmail: '',
  };
}
