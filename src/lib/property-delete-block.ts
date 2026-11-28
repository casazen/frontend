import { isAxiosError } from 'axios';
import { getProblemCode } from '@/lib/api-errors';

export type PropertyDeleteBlock = 'bookings' | 'leases';

export function propertyDeleteBlock(error: unknown): PropertyDeleteBlock | null {
  if (!isAxiosError(error) || error.response?.status !== 409) return null;

  switch (getProblemCode(error.response.data)) {
    case 'property_has_upcoming_bookings':
      return 'bookings';
    case 'property_has_active_leases':
      return 'leases';
    default:
      return null;
  }
}
