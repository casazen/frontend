import { isAxiosError } from 'axios';
import { getProblemCode } from '@/lib/api-errors';

export const SEAT_LIMIT_CODE = 'org_seat_limit_reached';

export function problemCodeOf(error: unknown): string | undefined {
  return isAxiosError(error) ? getProblemCode(error.response?.data) : undefined;
}
