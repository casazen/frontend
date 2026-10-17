import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { propertyStatus } from '@/lib/status-dictionary';
import { useProperties } from '@/queries/use-properties';
import type { Property } from '@/types';

/** The parameter of the address that holds the property the marketplace is about. */
export const MARKETPLACE_PROPERTY_PARAM = 'propertyId';

/** The parameter of the address that holds the category the list is narrowed to (the drawer starts a request from it). */
export const MARKETPLACE_CATEGORY_PARAM = 'category';

/**
 * The property the marketplace is about: the one the address asks for if it is one of the host's, else the first active one,
 * else the first. Nothing when the host has none.
 */
export function pickMarketplaceProperty(
  properties: readonly Property[] | undefined,
  requestedId: string | null,
): Property | undefined {
  if (!properties || properties.length === 0) return undefined;
  return (
    properties.find((property) => property.id === requestedId) ??
    properties.find((property) => propertyStatus(property) === 'Active') ??
    properties[0]
  );
}

/**
 * The properties of Affitti brevi and the one the marketplace is about (`?propertyId=`). The page and its drawer both ask for
 * it: the query is the same, so a shared address (`?propertyId=…&detail=marketplace-supplier:…`) opens on the right property.
 */
export function useMarketplaceProperty() {
  const [searchParams] = useSearchParams();
  const requested = searchParams.get(MARKETPLACE_PROPERTY_PARAM);
  const { data: properties, isLoading, isError, error, refetch } = useProperties({ mode: 'short' });
  const property = useMemo(() => pickMarketplaceProperty(properties, requested), [properties, requested]);

  return { properties, property, isLoading, isError, error, refetch };
}
