import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { propertyStatus } from '@/lib/status-dictionary';
import { useProperties } from '@/queries/use-properties';
import type { Property } from '@/types';
import { MARKETPLACE_PROPERTY_PARAM } from './marketplace-paths';

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
 * The properties of Affitti brevi and the one the marketplace is about (`?propertyId=`). The pages and the drawer of a supplier all
 * ask for it: the query is the same, so a shared address (`?propertyId=…&detail=marketplace-supplier:…`) opens on the right
 * property. `setProperty` writes the choice in the address, in place of the entry of the history.
 */
export function useMarketplaceProperty() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get(MARKETPLACE_PROPERTY_PARAM);
  const { data: properties, isLoading, isError, error, refetch } = useProperties({ mode: 'short' });
  const property = useMemo(() => pickMarketplaceProperty(properties, requested), [properties, requested]);

  const setProperty = useCallback(
    (id: string) =>
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          next.set(MARKETPLACE_PROPERTY_PARAM, id);
          return next;
        },
        { replace: true },
      ),
    [setSearchParams],
  );

  return { properties, property, isLoading, isError, error, refetch, setProperty };
}
