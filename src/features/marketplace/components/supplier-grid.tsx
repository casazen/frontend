import { useTranslation } from 'react-i18next';
import { useDetailDrawer } from '@/components/shared/detail-drawer/use-detail-drawer';
import type { SupplierPicker } from '@/types/service-request';
import { MARKETPLACE_SUPPLIER_DRAWER_KIND } from '../marketplace-supplier-drawer';
import { supplierCardRows } from '../lib/supplier-labels';
import { SupplierCard } from './supplier-card';

export function SupplierGrid({ suppliers, testId = 'marketplace-supplier-grid' }: { suppliers: readonly SupplierPicker[]; testId?: string }) {
  const { t, i18n } = useTranslation();
  const drawer = useDetailDrawer();
  const rows = supplierCardRows(suppliers, t, i18n.language);

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid={testId}>
      {suppliers.map((supplier) => (
        <SupplierCard
          key={supplier.orgId}
          supplier={supplier}
          rows={rows}
          onOpen={(opened, opener) => drawer.open(MARKETPLACE_SUPPLIER_DRAWER_KIND, opened.orgId, { opener })}
        />
      ))}
    </div>
  );
}
