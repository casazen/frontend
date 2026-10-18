import type { PublicPropertyDto } from '@/types';

/** A positive finite count, or null: a missing or malformed number is left out, never shown as "NaN" or "0". */
export function positiveCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

/** "Roma (00153)": the city and the postal code of a property, whichever it has; empty when it has neither. */
export function propertyPlace(property: Pick<PublicPropertyDto, 'city' | 'postalCode'>): string {
  return [property.city?.trim(), property.postalCode?.trim() ? `(${property.postalCode.trim()})` : null]
    .filter(Boolean)
    .join(' ');
}

/**
 * The parts of a property card that a property may not have. The image, the name and the price line are always there, so they
 * are not listed.
 */
export interface PropertyCardSections {
  place: boolean;
  /** The CIN code, shown to guests only when it is valid. */
  cin: boolean;
  description: boolean;
  /** The guests, bedrooms and bathrooms line. */
  facts: boolean;
}

/** The parts that one property has. */
export function sectionsOfProperty(property: PublicPropertyDto): PropertyCardSections {
  return {
    place: propertyPlace(property) !== '',
    cin: property.cinStatus === 'Valid' && Boolean(property.cinCode),
    description: Boolean(property.description),
    facts: [property.maxGuests, property.bedrooms, property.bathrooms].some((count) => positiveCount(count) !== null),
  };
}

/**
 * The parts that at least one property of the list has: the cards of a grid take a row for each of them (`PublicPropertyCard`),
 * so that the name, the description, the facts and the price of the cards of a row start at the same height. A part that no
 * card has is left out of all of them, instead of leaving an empty row in every card.
 */
export function propertyCardSections(properties: readonly PublicPropertyDto[]): PropertyCardSections {
  const sections: PropertyCardSections = { place: false, cin: false, description: false, facts: false };
  for (const property of properties) {
    const own = sectionsOfProperty(property);
    sections.place ||= own.place;
    sections.cin ||= own.cin;
    sections.description ||= own.description;
    sections.facts ||= own.facts;
  }
  return sections;
}
