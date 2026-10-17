import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { getServiceCategoryLabel } from '@/lib/i18n-labels';
import type { SupplierPicker } from '@/types/service-request';
import { responseLabel, supplierPriceLabel } from '../lib/supplier-labels';
import { VerifiedBadge } from './verified-badge';

interface SupplierCardProps {
  supplier: SupplierPicker;
  /** Opens the supplier in the drawer; `opener` is the button, which gets the focus back when the drawer closes. */
  onOpen: (supplier: SupplierPicker, opener: HTMLElement) => void;
}

/**
 * A supplier of the list: its name, the «Verificato» badge, the categories, the "from" price and, only if it is measured, how
 * fast it answers. The whole card is the button that opens the supplier in the drawer; no commission is shown (D3).
 */
export function SupplierCard({ supplier, onOpen }: SupplierCardProps) {
  const { t, i18n } = useTranslation();
  const price = supplierPriceLabel(supplier, t, i18n.language);
  const response = responseLabel(supplier, t);

  return (
    <button
      type="button"
      onClick={(event) => onOpen(supplier, event.currentTarget)}
      data-testid={`marketplace-supplier-${supplier.orgId}`}
      className="flex min-h-11 w-full min-w-0 flex-col gap-2 rounded-lg border p-4 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <span className="min-w-0 break-words font-medium">{supplier.legalName}</span>
        {supplier.verified ? <VerifiedBadge /> : null}
      </span>
      <span className="flex flex-wrap gap-1">
        {supplier.categories.map((category) => (
          <Badge key={category} variant="secondary" className="text-xs">
            {getServiceCategoryLabel(category, t)}
          </Badge>
        ))}
      </span>
      {price || response ? (
        <span className="block break-words text-sm text-foreground/80">{[price, response].filter(Boolean).join(' · ')}</span>
      ) : null}
      {supplier.bio ? <span className="line-clamp-2 break-words text-xs text-foreground/70">{supplier.bio}</span> : null}
    </button>
  );
}
