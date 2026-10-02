import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getServiceCategoryLabel, getSupplierStatusLabel } from '@/lib/i18n-labels';
import { formatRomeDateTime } from '@/lib/stay-dates';
import type { AdminSupplier, AdminSupplierStatus } from '@/types/admin-suppliers';

const STATUS_VARIANT: Record<AdminSupplierStatus, 'success' | 'secondary' | 'destructive'> = {
  Active: 'success',
  Pending: 'secondary',
  Suspended: 'destructive',
};
const DATE_ONLY: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };

/** The suppliers of one page, with the actions on each: suspend or reactivate, and its audit trail (SU-12). */
export function AdminSuppliersTable({
  suppliers,
  busyOrgId,
  onSuspend,
  onReactivate,
  onHistory,
}: {
  suppliers: AdminSupplier[];
  /** The supplier an action is running for: its buttons are disabled. */
  busyOrgId?: string | null;
  onSuspend: (supplier: AdminSupplier) => void;
  onReactivate: (supplier: AdminSupplier) => void;
  onHistory: (supplier: AdminSupplier) => void;
}) {
  const { t, i18n } = useTranslation();

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" data-testid="admin-suppliers-table">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="pb-2 pr-4 font-medium">{t('admin.suppliers.table.name')}</th>
            <th className="pb-2 pr-4 font-medium">{t('admin.suppliers.table.contact')}</th>
            <th className="pb-2 pr-4 font-medium">{t('admin.suppliers.table.categories')}</th>
            <th className="pb-2 pr-4 font-medium">{t('admin.suppliers.table.status')}</th>
            <th className="pb-2 pr-4 font-medium">{t('admin.suppliers.table.openRequests')}</th>
            <th className="pb-2 font-medium">{t('admin.suppliers.table.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {suppliers.map((supplier) => {
            const busy = busyOrgId === supplier.orgId;
            return (
              <tr key={supplier.orgId} className="border-b align-top last:border-0" data-testid={`admin-supplier-${supplier.orgId}`}>
                <td className="py-3 pr-4">
                  <p className="font-medium">{supplier.legalName}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('admin.suppliers.table.registeredOn', { date: formatRomeDateTime(supplier.createdAt, i18n.language, DATE_ONLY) })}
                  </p>
                </td>
                <td className="py-3 pr-4 text-muted-foreground">
                  <p>{supplier.email || '—'}</p>
                  <p className="text-xs">{supplier.phone || '—'}</p>
                </td>
                <td className="py-3 pr-4">
                  {supplier.categories.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {supplier.categories.map((category) => (
                        <Badge key={category} variant="outline">
                          {getServiceCategoryLabel(category, t)}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                  {supplier.comuni.length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">{supplier.comuni.join(', ')}</p>
                  )}
                </td>
                <td className="py-3 pr-4">
                  <Badge variant={STATUS_VARIANT[supplier.status] ?? 'secondary'} data-testid={`admin-supplier-status-${supplier.orgId}`}>
                    {getSupplierStatusLabel(supplier.status, t)}
                  </Badge>
                  {supplier.status === 'Suspended' && (
                    <div className="mt-1 text-xs text-muted-foreground" data-testid={`admin-supplier-suspension-${supplier.orgId}`}>
                      {supplier.suspendedAt && (
                        <p>{t('admin.suppliers.table.suspendedOn', { date: formatRomeDateTime(supplier.suspendedAt, i18n.language, DATE_ONLY) })}</p>
                      )}
                      {supplier.suspensionReason && <p>{supplier.suspensionReason}</p>}
                    </div>
                  )}
                </td>
                <td className="py-3 pr-4">{supplier.openRequests}</td>
                <td className="py-3">
                  <div className="flex flex-wrap gap-2">
                    {supplier.status === 'Suspended' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => onReactivate(supplier)}
                        data-testid={`admin-supplier-reactivate-${supplier.orgId}`}
                      >
                        {t('admin.suppliers.reactivate')}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => onSuspend(supplier)}
                        data-testid={`admin-supplier-suspend-${supplier.orgId}`}
                      >
                        {t('admin.suppliers.suspend')}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onHistory(supplier)}
                      data-testid={`admin-supplier-history-${supplier.orgId}`}
                    >
                      {t('admin.suppliers.history')}
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
