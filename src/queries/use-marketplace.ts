import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getMarketplaceActive, getMarketplaceCatalog, getMarketplaceEntry } from '@/api/marketplace.api';
import { useWorkspace } from '@/hooks/use-workspace';
import type { MarketplaceCatalogEntry, MarketplaceCatalogResponse, MarketplaceLanguage } from '@/types';

/** Prefix of every marketplace query: a wizard that changes what the page shows can read them again with `invalidateQueries`. */
const MARKETPLACE_KEY = 'marketplace';

/** `it` or `en`, from the language of the interface: the backend answers in Italian where a text is missing in the other one. */
export function marketplaceLanguage(language: string | undefined): MarketplaceLanguage {
  return language?.toLowerCase().startsWith('en') ? 'en' : 'it';
}

function useMarketplaceLanguage(): MarketplaceLanguage {
  const { i18n } = useTranslation();
  return marketplaceLanguage(i18n.resolvedLanguage ?? i18n.language);
}

/** The partners of a catalog, in the order the backend sent them. */
function partnersOf(catalog: MarketplaceCatalogResponse | undefined): MarketplaceCatalogEntry[] {
  return catalog?.groups.find((group) => group.id === 'partners')?.entries ?? [];
}

/**
 * The catalog of the Scopri page for a property (all the properties of the caller's scope without one), in the language of the
 * interface. Other screens (the activation wizards) change what it says, so it is stale at once and read again every time a page
 * that shows it opens (the app does not read again on mount what it read in the last 5 minutes: `query-client.ts`).
 */
export function useMarketplaceCatalog(propertyId: string | undefined) {
  const language = useMarketplaceLanguage();

  return useQuery({
    queryKey: [MARKETPLACE_KEY, 'catalog', propertyId ?? null, language],
    queryFn: () => getMarketplaceCatalog(propertyId, language),
    staleTime: 0,
    refetchOnMount: true,
  });
}

/** The detail card of an entry. It asks nothing until the address names a kind and a code. */
export function useMarketplaceEntry(kind: string | undefined, code: string | undefined, propertyId: string | undefined) {
  const language = useMarketplaceLanguage();

  return useQuery({
    queryKey: [MARKETPLACE_KEY, 'entry', kind ?? null, code ?? null, propertyId ?? null, language],
    queryFn: () => getMarketplaceEntry(kind ?? '', code ?? '', propertyId, language),
    enabled: !!kind && !!code,
    staleTime: 0,
    refetchOnMount: true,
  });
}

/** The integrations that are on and the suppliers already used (the Active tab). Read again every time the page opens. */
export function useMarketplaceActive(propertyId: string | undefined) {
  return useQuery({
    queryKey: [MARKETPLACE_KEY, 'active', propertyId ?? null],
    queryFn: () => getMarketplaceActive(propertyId),
    staleTime: 0,
    refetchOnMount: true,
  });
}

/**
 * The external partners of the catalog, by the service they work for (the guided request of home services offers them when the host goes
 * outside CasaZen). It reads the catalog without a property: a partner does not depend on one. Nothing is offered while the catalog
 * loads, when it fails, and when the person may not read it (a read they may not make would send them to the page of no access, out of
 * the request they are making): the guided request then behaves as when no partner covers the service.
 */
export function usePartnersByServiceCategory() {
  const language = useMarketplaceLanguage();
  const { hasPermission } = useWorkspace();
  const canRead = hasPermission('short-rent', 'booking.read');

  const catalog = useQuery({
    queryKey: [MARKETPLACE_KEY, 'catalog', null, language],
    queryFn: () => getMarketplaceCatalog(undefined, language),
    enabled: canRead,
  });

  const partners = useMemo(() => partnersOf(catalog.data), [catalog.data]);
  const partnersFor = useCallback(
    (serviceCategory: string): MarketplaceCatalogEntry[] => partners.filter((partner) => partner.serviceCategories?.includes(serviceCategory)),
    [partners],
  );

  return { partnersFor, hasPartners: partners.length > 0, isLoading: canRead && catalog.isPending };
}
