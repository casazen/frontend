import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { amenityCatalogApi } from '@/api/listing-data.api';
import { humanizeAmenity } from '@/lib/public-amenities';
import type { AmenityCatalog, AmenityLabel } from '@/types';

/** The catalog is static for a release and the server lets it be cached for an hour: it is read once and kept. */
const CATALOG_STALE_MS = 60 * 60 * 1000;

/**
 * The reference data of the amenities (NF-33): the one source of their labels and groups, in Italian and English. The wizard, the lists
 * and the property sheet read the labels from here, so an amenity is named once.
 */
export function useAmenityCatalog() {
  return useQuery({
    queryKey: ['amenity-catalog'],
    queryFn: () => amenityCatalogApi.get(),
    staleTime: CATALOG_STALE_MS,
  });
}

/** The language of a label: English for an English interface, Italian for anything else. */
export function labelLanguage(language: string | undefined): keyof AmenityLabel {
  return language?.toLowerCase().startsWith('en') ? 'en' : 'it';
}

/** The label of an amenity in a language; a name the catalog does not have (an older or newer backend) reads as a plain phrase, never as a key. */
export function amenityLabelOf(catalog: AmenityCatalog | undefined, name: string, language: keyof AmenityLabel): string {
  const entry = catalog?.amenities.find((amenity) => amenity.name === name);
  return entry?.label[language] || humanizeAmenity(name);
}

/** `name -> label` in the language of the page, from the catalog. While the catalog is loading a name reads as a plain phrase. */
export function useAmenityLabels(): (name: string) => string {
  const { i18n } = useTranslation();
  const { data } = useAmenityCatalog();
  const language = labelLanguage(i18n.language);
  return useCallback((name: string) => amenityLabelOf(data, name, language), [data, language]);
}
