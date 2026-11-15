import { getHttpStatus, isTransientRequestError } from '@/lib/api-errors';
import type { DoorCheckInRequest } from '@/types/public-checkin.types';

/**
 * The guest at the door of a property (E22/F02/US01/T01): how the stay is found. The booking code is in the confirmation e-mail; a guest of a portal has none that CasaZen sent, so the
 * surname of the main guest does the same. Exactly one of them is sent with the arrival date.
 */
export type DoorMode = 'code' | 'surname';

/** What the guest typed at the door. It lives in the state of the page for the time the page is open: never in the address, a storage, a cache or a log. */
export interface DoorValues {
  code: string;
  surname: string;
  /** The day the stay begins, as the date field gives it (`yyyy-MM-dd`, or empty). */
  arrival: string;
}

/** Longest value the page lets through: the API looks the stay up, it does not store what is typed, but a text of any length is no code and no surname. */
export const DOOR_CODE_MAX_LENGTH = 64;
export const DOOR_SURNAME_MAX_LENGTH = 100;

export type DoorField = 'code' | 'surname' | 'arrival';
export type DoorErrors = Partial<Record<DoorField, 'required' | 'invalid'>>;

const ARRIVAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A day that exists on the calendar, written `yyyy-MM-dd`. */
export function isCalendarDay(value: string): boolean {
  const match = ARRIVAL_PATTERN.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return year >= 2000 && date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** What is missing or not right before anything is sent. The server decides again, and tells nothing of which part was wrong. */
export function validateDoor(mode: DoorMode, values: DoorValues): DoorErrors {
  const errors: DoorErrors = {};
  if (mode === 'code') {
    const code = values.code.trim();
    if (code === '') errors.code = 'required';
    else if (code.length > DOOR_CODE_MAX_LENGTH) errors.code = 'invalid';
  } else {
    const surname = values.surname.trim();
    if (surname === '') errors.surname = 'required';
    else if (surname.length > DOOR_SURNAME_MAX_LENGTH) errors.surname = 'invalid';
  }
  if (values.arrival.trim() === '') errors.arrival = 'required';
  else if (!isCalendarDay(values.arrival.trim())) errors.arrival = 'invalid';
  return errors;
}

/** The body of the call: the code or the surname (never both) and the arrival date. */
export function doorRequestOf(mode: DoorMode, values: DoorValues): DoorCheckInRequest {
  const arrivalDate = values.arrival.trim();
  return mode === 'code' ? { bookingCode: values.code.trim(), arrivalDate } : { surname: values.surname.trim(), arrivalDate };
}

/** Why the door did not open, in the terms the page has words for. */
export type DoorProblem = 'not_found' | 'too_many_requests' | 'network' | 'failed';

/**
 * A failure of the door reduced to what the guest is told. A 404 is the one answer for everything that does not open (a wrong code, surname or date, another property's stay, a made-up
 * address of the door, a check-in already done, the feature switched off): the page never says which part was wrong, and neither does it guess from anything it still has in memory.
 */
export function classifyDoorError(error: unknown): DoorProblem {
  const status = getHttpStatus(error);
  if (status === undefined) return isTransientRequestError(error) ? 'network' : 'failed';
  if (status === 404) return 'not_found';
  if (status === 429) return 'too_many_requests';
  return 'failed';
}

/** The value of `?step=` that opens the check-in page at its identity step. */
export const IDENTITY_STEP_PARAM = 'identity';

/** The address of the check-in page of the stay the door opened, at the identity step: the guest came to be verified. The token is the only thing in it. */
export function checkInAddressOf(token: string): string {
  return `/checkin/${encodeURIComponent(token)}?step=${IDENTITY_STEP_PARAM}`;
}
