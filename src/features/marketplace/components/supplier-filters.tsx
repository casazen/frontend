import { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { PHONE_QUERY, useMediaQuery } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';
import type { SupplierPickerSort } from '@/types/service-request';
import { SUPPLIER_SORTS, type SupplierFilters } from '../lib/use-supplier-filters';

/** The two controls of a list of suppliers: the order and «Solo verificati». */
function FilterControls({ filters, idPrefix, inRow }: { filters: SupplierFilters; idPrefix: string; inRow: boolean }) {
  const { t } = useTranslation();

  return (
    <>
      <div className={cn('min-w-0 space-y-1.5', inRow && 'w-52 max-w-full')}>
        <Label htmlFor={`${idPrefix}-sort`}>{t('marketplace.sortLabel')}</Label>
        <Select
          id={`${idPrefix}-sort`}
          value={filters.sort}
          onChange={(event) => filters.setSort(event.target.value as SupplierPickerSort)}
          data-testid="marketplace-sort"
        >
          {SUPPLIER_SORTS.map((value) => (
            <option key={value} value={value}>
              {t(`marketplace.sort.${value}`)}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex min-h-11 items-center gap-2">
        <Checkbox
          id={`${idPrefix}-verified`}
          checked={filters.verifiedOnly}
          onCheckedChange={(checked) => filters.setVerifiedOnly(checked === true)}
          data-testid="marketplace-verified-only"
        />
        <Label htmlFor={`${idPrefix}-verified`} className="cursor-pointer">
          {t('marketplace.verifiedOnly')}
        </Label>
      </div>
    </>
  );
}

/**
 * The order and «Solo verificati» of a list of suppliers, and how many there are (MKT). On a computer they are in a row above the
 * list; on a phone they would take the screen, so there is one button, «Filtri», that opens them in a sheet from the bottom.
 */
export function SupplierFiltersBar({ filters, count }: { filters: SupplierFilters; count: number }) {
  const { t } = useTranslation();
  const isPhone = useMediaQuery(PHONE_QUERY);
  const [open, setOpen] = useState(false);

  const total = (
    <p className="text-sm text-foreground/70" role="status" data-testid="marketplace-result-count">
      {t('marketplace.results.count', { count })}
    </p>
  );

  if (!isPhone) {
    return (
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3" data-testid="marketplace-filters">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-1">
          <FilterControls filters={filters} idPrefix="marketplace" inRow />
        </div>
        {total}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3" data-testid="marketplace-filters">
      <Button type="button" variant="outline" className="min-h-11" onClick={() => setOpen(true)} data-testid="marketplace-filters-open">
        <SlidersHorizontal aria-hidden="true" className="size-4" />
        {t('marketplace.filters.open')}
        {filters.active > 0 ? <span className="tabular-nums text-primary-text">{filters.active}</span> : null}
      </Button>
      {total}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="marketplace-filters-sheet">
          <DialogHeader>
            <DialogTitle>{t('marketplace.filters.title')}</DialogTitle>
            <DialogDescription>{t('marketplace.filters.description')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <FilterControls filters={filters} idPrefix="marketplace-sheet" inRow={false} />
          </div>
          <DialogFooter>
            <Button type="button" className="min-h-11" onClick={() => setOpen(false)}>
              {t('marketplace.filters.done', { count })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
