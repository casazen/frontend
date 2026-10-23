import { isAxiosError } from 'axios';
import { getProblemCode } from '@/lib/api-errors';

/** Why a property cannot be deleted yet: a stay (`bookings`) or a lease (`leases`) has not ended. */
export type PropertyDeleteBlock = 'bookings' | 'leases';

/**
 * The reason of the 409 of `DELETE /properties/{id}` (`property_has_upcoming_bookings`, `property_has_active_leases`), or `null` for
 * any other failure. A page that explains the refusal itself, with the way out, reads it from here.
 */
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
