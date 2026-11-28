import { useTranslation } from 'react-i18next';
import { AlignedCard } from '@/components/ui/card';
import { getServiceCategoryLabel } from '@/lib/i18n-labels';
import { CARD_LIFT } from '@/lib/motion';
import { cn } from '@/lib/utils';
import type { SupplierPicker } from '@/types/service-request';
import { supplierCardRowCount, supplierFacts, type SupplierCardRows } from '../lib/supplier-labels';
import { RecommendedBadge } from './recommended-badge';
import { VerifiedBadge } from './verified-badge';

interface SupplierCardProps {
  supplier: SupplierPicker;
  rows: SupplierCardRows;
  onOpen: (supplier: SupplierPicker, opener: HTMLElement) => void;
}

export function SupplierCard({ supplier, rows, onOpen }: SupplierCardProps) {
  const { t, i18n } = useTranslation();
  const facts = supplierFacts(supplier, t, i18n.language);

  return (
    <AlignedCard
      rows={supplierCardRowCount(rows)}
      from="md"
      role="button"
      tabIndex={0}
      onClick={(event) => onOpen(supplier, event.currentTarget)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return;
        event.preventDefault();
        onOpen(supplier, event.currentTarget);
      }}
      data-testid={`marketplace-supplier-${supplier.orgId}`}
      className={cn('min-w-0 cursor-pointer py-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring', CARD_LIFT)}
    >
      <div className="flex items-start justify-between gap-x-3">
        <span data-testid="supplier-name" className="min-w-0 break-words text-lg font-semibold leading-snug">{supplier.legalName}</span>
        {supplier.recommended || supplier.verified ? (
          <span className="flex min-w-0 flex-wrap justify-end gap-1">
            {supplier.recommended ? <RecommendedBadge /> : null}
            {supplier.verified ? <VerifiedBadge /> : null}
          </span>
        ) : null}
      </div>
      <p className="mt-1 break-words text-sm text-foreground/75" data-testid="marketplace-supplier-categories">
        {supplier.categories.map((category) => getServiceCategoryLabel(category, t)).join(' · ')}
      </p>
      {rows.facts ? (
        facts ? (
          <p className="mt-1 break-words text-sm text-foreground/80" data-testid="marketplace-supplier-facts">
            {facts}
          </p>
        ) : (
          <div />
        )
      ) : null}
      {rows.bio ? (
        supplier.bio ? (
          <p className="mt-1 line-clamp-2 break-words text-xs text-foreground/70">{supplier.bio}</p>
        ) : (
          <div />
        )
      ) : null}
    </AlignedCard>
  );
}
