import { Ban } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSupplierSuspended } from '@/queries/use-supplier';

/**
 * Shown on every page of the supplier console while an admin has suspended the supplier (SU-12): no new requests, and no
 * action on the existing ones. The reason of the suspension is an internal note and is not shown.
 */
export function SupplierSuspendedBanner() {
  const { t } = useTranslation();
  if (!useSupplierSuspended()) return null;

  return (
    <div
      className="mb-4 flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4"
      role="alert"
      data-testid="supplier-suspended-banner"
    >
      <Ban className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
      <div className="space-y-1">
        <p className="font-medium text-destructive">{t('supplier.suspended.title')}</p>
        <p className="text-sm text-destructive">{t('supplier.suspended.description')}</p>
      </div>
    </div>
  );
}
