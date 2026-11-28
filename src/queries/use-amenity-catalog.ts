import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { amenityCatalogApi } from '@/api/listing-data.api';
import { humanizeAmenity } from '@/lib/public-amenities';
import type { AmenityCatalog, AmenityLabel } from '@/types';

const CATALOG_STALE_MS = 60 * 60 * 1000;

export function useAmenityCatalog() {
  return useQuery({
    queryKey: ['amenity-catalog'],
    queryFn: () => amenityCatalogApi.get(),
    staleTime: CATALOG_STALE_MS,
  });
}

export function labelLanguage(language: string | undefined): keyof AmenityLabel {
  return language?.toLowerCase().startsWith('en') ? 'en' : 'it';
}

export function amenityLabelOf(catalog: AmenityCatalog | undefined, name: string, language: keyof AmenityLabel): string {
  const entry = catalog?.amenities.find((amenity) => amenity.name === name);
  return entry?.label[language] || humanizeAmenity(name);
}

export function useAmenityLabels(): (name: string) => string {
  const { i18n } = useTranslation();
  const { data } = useAmenityCatalog();
  const language = labelLanguage(i18n.language);
  return useCallback((name: string) => amenityLabelOf(data, name, language), [data, language]);
}
