import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMarketplaceSuppliers } from '@/queries/use-service-requests';
import { MarketplaceFrame } from './components/marketplace-frame';
import { SupplierResults } from './components/supplier-results';
import { SupplierSearchBox } from './components/supplier-search-box';
import { MARKETPLACE_PATH, MARKETPLACE_QUERY_PARAM } from './lib/marketplace-paths';
import { useSupplierFilters } from './lib/use-supplier-filters';

/**
 * Cerca (MKT): the suppliers around the property that match the words of the search, found by the name of the supplier, by what it
 * offers (the name of a service) and by the category, in Italian or English, without minding capitals or accents (SR-09a-FU2). The
 * words are in the address (`?q=`), so a search can be shared; with none, every supplier around the property is listed.
 */
export function MarketplaceSearchPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const words = searchParams.get(MARKETPLACE_QUERY_PARAM) ?? '';

  const setWords = (next: string) =>
    setSearchParams(
      (previous) => {
        const params = new URLSearchParams(previous);
        if (next) params.set(MARKETPLACE_QUERY_PARAM, next);
        else params.delete(MARKETPLACE_QUERY_PARAM);
        return params;
      },
      { replace: true },
    );

  return (
    <MarketplaceFrame
      section="discover"
      title={t('marketplace.search.title')}
      description={t('marketplace.search.description')}
      trail={[{ label: t('marketplace.title'), path: MARKETPLACE_PATH }, { label: t('marketplace.search.title') }]}
      toolbar={<SupplierSearchBox value={words} onSearch={setWords} live />}
    >
      {({ property }) => <SearchResults propertyId={property.id} words={words.trim()} onClear={() => setWords('')} />}
    </MarketplaceFrame>
  );
}

function SearchResults({ propertyId, words, onClear }: { propertyId: string; words: string; onClear: () => void }) {
  const { t } = useTranslation();
  const filters = useSupplierFilters();
  const query = useMarketplaceSuppliers({ propertyId, q: words || undefined, sort: filters.sort });

  return (
    <div data-testid="marketplace-search-results">
      <SupplierResults query={query} filters={filters} emptyText={t('marketplace.noNetwork')} onClearSearch={words ? onClear : undefined} />
    </div>
  );
}
