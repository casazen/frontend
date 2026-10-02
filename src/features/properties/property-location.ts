import type { Property } from '@/types';

/** "Via Roma 1, int. 5, 00100 Roma": the parts the property has, never "undefined" (A2-27). */
export function formatPropertyLocation(
  property: Pick<Property, 'address' | 'postalCode' | 'city'> & { unit?: string | null },
): string {
  const town = [property.postalCode, property.city].filter(Boolean).join(' ');
  return [property.address, property.unit?.trim(), town].filter(Boolean).join(', ');
}
