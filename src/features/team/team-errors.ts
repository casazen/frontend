import { isAxiosError } from 'axios';
import { getProblemCode } from '@/lib/api-errors';

/** 409: the plan has no free seat for another person (a new invitation, or the reactivation of somebody). */
export const SEAT_LIMIT_CODE = 'org_seat_limit_reached';

/** The stable `code` the backend gave to a refused request, or `undefined` for an error that is not an answer of the API. */
export function problemCodeOf(error: unknown): string | undefined {
  return isAxiosError(error) ? getProblemCode(error.response?.data) : undefined;
}
