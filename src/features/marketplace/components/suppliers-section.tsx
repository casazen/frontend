import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { PlainSection } from '@/components/shared/calm';
import { useDetailDrawer } from '@/components/shared/detail-drawer/use-detail-drawer';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { ServiceCategorySelect } from '@/features/service-requests/components/service-category-picker';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { getProblemMessage } from '@/lib/api-errors';
import { useMarketplaceSuppliers } from '@/queries/use-service-requests';
import type { SupplierPicker, SupplierPickerSort } from '@/types/service-request';
import { MARKETPLACE_SUPPLIER_DRAWER_KIND } from '../marketplace-supplier-drawer';
import { MARKETPLACE_CATEGORY_PARAM } from '../lib/marketplace-property';
import { supplierCardRows } from '../lib/supplier-labels';
import { SupplierCard } from './supplier-card';

const SORTS: readonly SupplierPickerSort[] = ['name', 'price', 'response'];

/** How long the words of the search rest before the list is asked for them. */
const SEARCH_DELAY_MS = 300;

/**
 * «Fornitori CasaZen» (spec #466, AC12): the suppliers that work in the comune of the property, narrowed by the words of the
 * search, the category, "solo verificati" and put in the order chosen (name, price, answer time). Each one opens in the drawer,
 * where «Richiedi fornitore» starts the request. The page puts other sections of the marketplace under this one.
 */
export function SuppliersSection({ propertyId }: { propertyId: string }) {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const drawer = useDetailDrawer();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SupplierPickerSort>('name');
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  const category = searchParams.get(MARKETPLACE_CATEGORY_PARAM) ?? '';
  const words = useDebouncedValue(search.trim(), SEARCH_DELAY_MS);
  const query = useMarketplaceSuppliers({
    propertyId,
    category: category || undefined,
    q: words || undefined,
    sort,
  });

  const setCategory = (code: string) =>
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (code) next.set(MARKETPLACE_CATEGORY_PARAM, code);
        else next.delete(MARKETPLACE_CATEGORY_PARAM);
        return next;
      },
      { replace: true },
    );

  const items = (query.data?.items ?? []).filter((supplier) => !verifiedOnly || supplier.verified === true);
  const rows = supplierCardRows(items, t, i18n.language);
  const narrowedByWords = search.trim() !== '' || verifiedOnly;

  const open = (supplier: SupplierPicker, opener: HTMLElement) => {
    drawer.open(MARKETPLACE_SUPPLIER_DRAWER_KIND, supplier.orgId, { opener });
  };

  const clearFilters = () => {
    setSearch('');
    setVerifiedOnly(false);
  };

  return (
    <PlainSection title={t('marketplace.casazenSuppliers')} data-testid="marketplace-suppliers-section">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor="marketplace-search">{t('marketplace.searchLabel')}</Label>
          <Input
            id="marketplace-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('marketplace.searchPlaceholder')}
            data-testid="marketplace-search"
          />
        </div>
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor="marketplace-category">{t('marketplace.categoryLabel')}</Label>
          <ServiceCategorySelect
            id="marketplace-category"
            value={category}
            onChange={setCategory}
            emptyOptionLabel={t('marketplace.allCategories')}
            data-testid="marketplace-category-filter"
          />
        </div>
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor="marketplace-sort">{t('marketplace.sortLabel')}</Label>
          <Select
            id="marketplace-sort"
            value={sort}
            onChange={(event) => setSort(event.target.value as SupplierPickerSort)}
            data-testid="marketplace-sort"
          >
            {SORTS.map((value) => (
              <option key={value} value={value}>
                {t(`marketplace.sort.${value}`)}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex min-h-11 items-center gap-2">
          <Checkbox
            id="marketplace-verified-only"
            checked={verifiedOnly}
            onCheckedChange={(checked) => setVerifiedOnly(checked === true)}
            data-testid="marketplace-verified-only"
          />
          <Label htmlFor="marketplace-verified-only" className="cursor-pointer">
            {t('marketplace.verifiedOnly')}
          </Label>
        </div>
      </div>

      <div aria-busy={query.isFetching} className="pt-2">
        {query.isLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground" role="status">
            <Loader2 aria-hidden="true" className="size-5 animate-spin" />
            {t('marketplace.loading')}
          </div>
        ) : query.isError && !query.data ? (
          <div className="space-y-2 py-4" role="alert" data-testid="marketplace-suppliers-error">
            <p className="text-sm text-destructive">
              {getProblemMessage(query.error, t) ?? t('marketplace.suppliersLoadError')}
            </p>
            <Button type="button" size="sm" variant="outline" onClick={() => void query.refetch()}>
              {t('serviceRequest.retry')}
            </Button>
          </div>
        ) : items.length === 0 ? (
          narrowedByWords ? (
            <div className="space-y-2 py-4" role="status" data-testid="marketplace-no-match">
              <p className="text-sm text-muted-foreground">{t('marketplace.noMatch')}</p>
              <Button type="button" size="sm" variant="outline" onClick={clearFilters}>
                {t('marketplace.clearFilters')}
              </Button>
            </div>
          ) : (
            <p className="py-4 text-sm text-muted-foreground" role="status" data-testid="marketplace-no-network">
              {t('marketplace.noNetwork')}
            </p>
          )
        ) : (
          // The cards are the rows of one grid (`AlignedCard`): the name, the categories, the facts and the description of the cards
          // of a line start at the same height.
          <div className="grid gap-3 md:grid-cols-2" data-testid="marketplace-supplier-grid">
            {items.map((supplier) => (
              <SupplierCard key={supplier.orgId} supplier={supplier} rows={rows} onOpen={open} />
            ))}
          </div>
        )}
      </div>
    </PlainSection>
  );
}
