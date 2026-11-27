import { useMemo } from 'react';
import { useProperties } from '@/queries/use-properties';
import type { Property } from '@/types/property.types';

export const RENTAL_AREAS = ['short-rent', 'long-rent'] as const;

export type RentalArea = (typeof RENTAL_AREAS)[number];

export function isRentalArea(area: string): area is RentalArea {
  return (RENTAL_AREAS as readonly string[]).includes(area);
}

export interface PickerProperty {
  id: string;
  name: string;
  city: string;
  area: RentalArea;
}

/** A property is in the short-rent area unless it is let long-term (`rentalMode` is exclusive, PM-01). */
export function areaOfProperty(property: Pick<Property, 'rentalMode'>): RentalArea {
  return property.rentalMode === 'Long' ? 'long-rent' : 'short-rent';
}

export function usePickerProperties() {
  const query = useProperties(undefined, { fresh: true });
  const loaded = Array.isArray(query.data) ? query.data : undefined;
  const properties = useMemo<PickerProperty[] | undefined>(
    () => loaded?.map((property) => ({ id: property.id, name: property.name, city: property.city, area: areaOfProperty(property) })),
    [loaded],
  );
  return {
    properties,
    isError: !loaded && (query.isError || query.data !== undefined),
    refetch: () => void query.refetch(),
  };
}
