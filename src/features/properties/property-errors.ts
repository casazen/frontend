import { isAxiosError } from 'axios';
import { getProblemCode } from '@/lib/api-errors';

export const DUPLICATE_ADDRESS_CODE = 'duplicate_property_address';

export function isDuplicateAddressError(error: unknown): boolean {
  return isAxiosError(error) && getProblemCode(error.response?.data) === DUPLICATE_ADDRESS_CODE;
}
