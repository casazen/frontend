import { useId } from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { getServiceCategoryLabel } from '@/lib/i18n-labels';
import type { SupplierPicker } from '@/types/service-request';
import { CATEGORY_ROW_LIMIT } from '../lib/category-groups';
import { marketplaceCategoryPath, marketplaceHref } from '../lib/marketplace-paths';
import { SupplierGrid } from './supplier-grid';

interface CategoryRowProps {
  category: string;
  /** Every supplier of the category around the property: the row shows the first few. */
  suppliers: readonly SupplierPicker[];
  propertyId: string;
}

/** A row of Scopri (MKT): the category, how many suppliers it has around the property, the first few and «Vedi tutti». */
export function CategoryRow({ category, suppliers, propertyId }: CategoryRowProps) {
  const { t } = useTranslation();
  const headingId = useId();
  const label = getServiceCategoryLabel(category, t);

  return (
    <section aria-labelledby={headingId} className="min-w-0 space-y-2" data-testid={`marketplace-category-row-${category}`}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h3 id={headingId} className="min-w-0 break-words text-base font-semibold">
          {label} <span className="text-sm font-semibold tabular-nums text-foreground/70">{suppliers.length}</span>
        </h3>
        <Button
          asChild
          variant="ghost"
          size="sm"
          iconRight={<ArrowRight />}
          className="min-h-11 px-2 text-primary-text hover:text-primary-text"
        >
          <Link
            to={marketplaceHref(marketplaceCategoryPath(category), propertyId)}
            aria-label={t('marketplace.seeAllOf', { category: label })}
            data-testid={`marketplace-see-all-${category}`}
          >
            {t('marketplace.seeAll')}
          </Link>
        </Button>
      </div>
      <SupplierGrid suppliers={suppliers.slice(0, CATEGORY_ROW_LIMIT)} testId={`marketplace-category-grid-${category}`} />
    </section>
  );
}
