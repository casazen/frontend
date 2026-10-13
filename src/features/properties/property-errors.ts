import { isAxiosError } from 'axios';
import { getProblemCode } from '@/lib/api-errors';

/** Stable `code` of the 409 when another active property of the org has the same address and unit (PC-06, A2-19). */
export const DUPLICATE_ADDRESS_CODE = 'duplicate_property_address';

/** True for the 409 `duplicate_property_address` of a create or update of a property. */
export function isDuplicateAddressError(error: unknown): boolean {
  return isAxiosError(error) && getProblemCode(error.response?.data) === DUPLICATE_ADDRESS_CODE;
}
