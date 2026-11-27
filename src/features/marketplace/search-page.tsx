import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMarketplaceSuppliers } from '@/queries/use-service-requests';
import { MarketplaceFrame } from './components/marketplace-frame';
import { SupplierResults } from './components/supplier-results';
import { SupplierSearchBox } from './components/supplier-search-box';
import { MARKETPLACE_PATH, MARKETPLACE_QUERY_PARAM } from './lib/marketplace-paths';
import { useSupplierFilters } from './lib/use-supplier-filters';

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
      crumbs={[{ label: t('marketplace.title'), to: MARKETPLACE_PATH }, { label: t('marketplace.search.title') }]}
      toolbar={<SupplierSearchBox value={words} onSearch={setWords} live />}
    >
      <SearchResults words={words.trim()} onClear={() => setWords('')} />
    </MarketplaceFrame>
  );
}

function SearchResults({ words, onClear }: { words: string; onClear: () => void }) {
  const { t } = useTranslation();
  const filters = useSupplierFilters();
  const query = useMarketplaceSuppliers({ accountScope: true, q: words || undefined, sort: filters.sort });

  return (
    <div data-testid="marketplace-search-results">
      <SupplierResults query={query} filters={filters} emptyText={t('marketplace.categories.none')} onClearSearch={words ? onClear : undefined} />
    </div>
  );
}
