import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import type { SupplierListResponse } from '@/types/service-request';
import type { SupplierFilters } from '../lib/use-supplier-filters';
import { SupplierFiltersBar } from './supplier-filters';
import { SupplierGrid } from './supplier-grid';
import { SuppliersError, SuppliersLoading } from './suppliers-state';

/** The part of a query of the suppliers that a list needs. */
interface SuppliersQuery {
  data: SupplierListResponse | undefined;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => unknown;
}

interface SupplierResultsProps {
  query: SuppliersQuery;
  filters: SupplierFilters;
  /** What is said when there is no supplier at all and nothing narrowed the list: for a category, that the network is not there yet. */
  emptyText: string;
  /** The list is narrowed by words (the search): with none left to show, they can be taken away. */
  onClearSearch?: () => void;
}

/**
 * A list of suppliers with its order and «Solo verificati» (MKT), for a category and for a search: loading, failed with «Riprova»,
 * nothing there (and why: no network around the property, or the words or the filter left none), then the cards.
 */
export function SupplierResults({ query, filters, emptyText, onClearSearch }: SupplierResultsProps) {
  const { t } = useTranslation();

  if (query.isLoading) return <SuppliersLoading />;
  if (query.isError && !query.data) return <SuppliersError error={query.error} onRetry={() => void query.refetch()} />;

  const all = query.data?.items ?? [];
  const items = all.filter((supplier) => !filters.verifiedOnly || supplier.verified === true);

  return (
    <div className="space-y-4" aria-busy={query.isFetching}>
      {all.length > 0 ? <SupplierFiltersBar filters={filters} count={items.length} /> : null}

      {items.length > 0 ? (
        <SupplierGrid suppliers={items} />
      ) : all.length > 0 ? (
        <div className="space-y-2 py-4" role="status" data-testid="marketplace-no-match">
          <p className="text-sm text-muted-foreground">{t('marketplace.noVerified')}</p>
          <Button type="button" size="sm" variant="outline" onClick={() => filters.setVerifiedOnly(false)}>
            {t('marketplace.clearFilters')}
          </Button>
        </div>
      ) : onClearSearch ? (
        <div className="space-y-2 py-4" role="status" data-testid="marketplace-no-match">
          <p className="text-sm text-muted-foreground">{t('marketplace.noMatch')}</p>
          <Button type="button" size="sm" variant="outline" onClick={onClearSearch}>
            {t('marketplace.clearSearch')}
          </Button>
        </div>
      ) : (
        <p className="py-4 text-sm text-muted-foreground" role="status" data-testid="marketplace-no-network">
          {emptyText}
        </p>
      )}
    </div>
  );
}
