import { getHttpStatus, isTransientRequestError } from '@/lib/api-errors';
import type { DoorCheckInRequest } from '@/types/public-checkin.types';

export type DoorMode = 'code' | 'surname';

export interface DoorValues {
  code: string;
  surname: string;
  arrival: string;
}

export const DOOR_CODE_MAX_LENGTH = 64;
export const DOOR_SURNAME_MAX_LENGTH = 100;

export type DoorField = 'code' | 'surname' | 'arrival';
export type DoorErrors = Partial<Record<DoorField, 'required' | 'invalid'>>;

const ARRIVAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isCalendarDay(value: string): boolean {
  const match = ARRIVAL_PATTERN.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return year >= 2000 && date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

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

export function doorRequestOf(mode: DoorMode, values: DoorValues): DoorCheckInRequest {
  const arrivalDate = values.arrival.trim();
  return mode === 'code' ? { bookingCode: values.code.trim(), arrivalDate } : { surname: values.surname.trim(), arrivalDate };
}

export type DoorProblem = 'not_found' | 'too_many_requests' | 'network' | 'failed';

export function classifyDoorError(error: unknown): DoorProblem {
  const status = getHttpStatus(error);
  if (status === undefined) return isTransientRequestError(error) ? 'network' : 'failed';
  if (status === 404) return 'not_found';
  if (status === 429) return 'too_many_requests';
  return 'failed';
}

export const IDENTITY_STEP_PARAM = 'identity';

export function checkInAddressOf(token: string): string {
  return `/checkin/${encodeURIComponent(token)}?step=${IDENTITY_STEP_PARAM}`;
}
