import type { Property } from '@/types';

export function formatPropertyLocation(
  property: Pick<Property, 'address' | 'postalCode' | 'city'> & { unit?: string | null },
): string {
  const town = [property.postalCode, property.city].filter(Boolean).join(' ');
  return [property.address, property.unit?.trim(), town].filter(Boolean).join(', ');
}
