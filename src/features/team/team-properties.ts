import { useMemo } from 'react';
import { useProperties } from '@/queries/use-properties';
import type { Property } from '@/types/property.types';

/** The areas a person can be given to work in. The Amministrazione is not one of them: the role gives it. */
export const RENTAL_AREAS = ['short-rent', 'long-rent'] as const;

export type RentalArea = (typeof RENTAL_AREAS)[number];

export function isRentalArea(area: string): area is RentalArea {
  return (RENTAL_AREAS as readonly string[]).includes(area);
}

/** A property as the picker lists it: its name, its city and the area it is in (the mode it is let in). */
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

/**
 * The properties a person can be given, with their area. They are read again each time a screen that offers them opens: they
 * change on other pages, where this list is not watched. `properties` is `undefined` until they are there.
 */
export function usePickerProperties() {
  const query = useProperties(undefined, { fresh: true });
  // An answer that is not a list (the page of the app where an API answer should be) is a failed load, never "no properties".
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
