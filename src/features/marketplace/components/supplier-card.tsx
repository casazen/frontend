import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { AlignedCard } from '@/components/ui/card';
import { getServiceCategoryLabel } from '@/lib/i18n-labels';
import type { SupplierPicker } from '@/types/service-request';
import { supplierCardRowCount, supplierFacts, type SupplierCardRows } from '../lib/supplier-labels';
import { VerifiedBadge } from './verified-badge';

interface SupplierCardProps {
  supplier: SupplierPicker;
  /** The optional sections some card of the grid has: every card keeps the same rows. */
  rows: SupplierCardRows;
  /** Opens the supplier in the drawer; `opener` is the card, which gets the focus back when the drawer closes. */
  onOpen: (supplier: SupplierPicker, opener: HTMLElement) => void;
}

/**
 * A supplier of the list: its name, the «Verificato» badge, the categories, the "from" price and, only if it is measured, how
 * fast it answers. The whole card opens the supplier in the drawer (with the keyboard too); no commission is shown (D3). The cards
 * of a row line up section by section (`AlignedCard`): a section that this supplier lacks is an empty `<div />`.
 */
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
      className="min-w-0 cursor-pointer py-4 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-x-3">
        <span className="min-w-0 break-words font-medium">{supplier.legalName}</span>
        {supplier.verified ? <VerifiedBadge /> : null}
      </div>
      <div className="mt-1 flex flex-wrap content-start gap-1">
        {supplier.categories.map((category) => (
          <Badge key={category} variant="secondary" className="text-xs">
            {getServiceCategoryLabel(category, t)}
          </Badge>
        ))}
      </div>
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
