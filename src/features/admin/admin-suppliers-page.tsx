import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getProblemMessage } from '@/lib/api-errors';
import { getSupplierStatusLabel } from '@/lib/i18n-labels';
import { useAdminSuppliers, useReactivateSupplier, useSuspendSupplier } from '@/queries/supplier/use-admin';
import { ADMIN_SUPPLIER_STATUSES, type AdminSupplier, type AdminSupplierStatus } from '@/types/admin-suppliers';
import { AdminSuppliersTable } from './components/admin-suppliers-table';
import { ConfirmAdminActionDialog } from './components/confirm-admin-action-dialog';
import { useDebouncedSearch } from '@/hooks/use-debounced-search';
import { ErrorRow, LoadingRows, Pager } from './components/admin-list-parts';
import { SupplierAuditDialog } from './components/supplier-audit-dialog';
import { SuspendSupplierDialog } from './components/suspend-supplier-dialog';

const PAGE_SIZE = 20;

function SuppliersTab() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<AdminSupplierStatus | ''>('');
  const { input, setInput, search } = useDebouncedSearch(setPage);
  const [suspending, setSuspending] = useState<AdminSupplier | null>(null);
  const [reactivating, setReactivating] = useState<AdminSupplier | null>(null);
  const [history, setHistory] = useState<AdminSupplier | null>(null);
  const suspend = useSuspendSupplier();
  const reactivate = useReactivateSupplier();

  const { data, isLoading, isError, error, refetch } = useAdminSuppliers({
    search: search || undefined,
    status: status || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const onActionError = (err: unknown) => toast.error(getProblemMessage(err, t) ?? t('admin.suppliers.toast.error'));
  const busyOrgId = suspend.isPending ? suspend.variables?.orgId : reactivate.isPending ? reactivate.variables : null;
  const filtered = search !== '' || status !== '';

  let content;
  if (isLoading) {
    content = <LoadingRows />;
  } else if (isError || !data) {
    content = <ErrorRow error={error} message={t('admin.suppliers.loadError')} onRetry={() => void refetch()} />;
  } else if (data.items.length === 0) {
    content = (
      <p className="py-8 text-center text-muted-foreground" data-testid="admin-suppliers-empty">
        {filtered ? t('admin.suppliers.emptyFiltered') : t('admin.suppliers.empty')}
      </p>
    );
  } else {
    content = (
      <>
        <AdminSuppliersTable
          suppliers={data.items}
          busyOrgId={busyOrgId}
          onSuspend={setSuspending}
          onReactivate={setReactivating}
          onHistory={setHistory}
        />
        <Pager page={data.page || page} pageSize={data.pageSize || PAGE_SIZE} totalCount={data.totalCount} onPage={setPage} />
      </>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder={t('admin.suppliers.searchPlaceholder')}
          aria-label={t('admin.suppliers.searchPlaceholder')}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="max-w-xs"
          data-testid="admin-suppliers-search"
        />
        <select
          className="rounded-md border bg-background px-3 py-2 text-sm"
          aria-label={t('admin.suppliers.filter.status')}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as AdminSupplierStatus | '');
            setPage(1);
          }}
          data-testid="admin-suppliers-status"
        >
          <option value="">{t('admin.suppliers.filter.allStatuses')}</option>
          {ADMIN_SUPPLIER_STATUSES.map((value) => (
            <option key={value} value={value}>
              {getSupplierStatusLabel(value, t)}
            </option>
          ))}
        </select>
      </div>

      <Card>
        <CardContent className="pt-6">{content}</CardContent>
      </Card>

      {suspending && (
        <SuspendSupplierDialog
          supplier={suspending}
          isPending={suspend.isPending}
          onCancel={() => setSuspending(null)}
          onConfirm={(reason) =>
            suspend.mutate(
              { orgId: suspending.orgId, reason },
              {
                onSuccess: () => {
                  toast.success(t('admin.suppliers.toast.suspended', { name: suspending.legalName }));
                  setSuspending(null);
                },
                onError: onActionError,
              },
            )
          }
        />
      )}
      {reactivating && (
        <ConfirmAdminActionDialog
          title={t('admin.suppliers.reactivateDialog.title', { name: reactivating.legalName })}
          description={t('admin.suppliers.reactivateDialog.description')}
          confirmLabel={t('admin.suppliers.reactivate')}
          isPending={reactivate.isPending}
          onCancel={() => setReactivating(null)}
          onConfirm={() =>
            reactivate.mutate(reactivating.orgId, {
              onSuccess: () => {
                toast.success(t('admin.suppliers.toast.reactivated', { name: reactivating.legalName }));
                setReactivating(null);
              },
              onError: onActionError,
            })
          }
        />
      )}
      {history && <SupplierAuditDialog supplier={history} onClose={() => setHistory(null)} />}
    </div>
  );
}

/**
 * Platform admin's view of the suppliers (SU-12, A4-29): the list with status, suspension and reactivation (reason
 * required, audit trail), filtered and paginated by the server. The invites (suppliers and hosts) have their own section.
 */
export function AdminSuppliersPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6" data-testid="admin-suppliers-page">
      <PageHeader
        title={t('admin.suppliers.title')}
        description={t('admin.suppliers.description')}
        action={
          <Button asChild data-testid="admin-suppliers-invite">
            <Link to="/app/admin/suppliers/invite">{t('admin.suppliers.inviteNew')}</Link>
          </Button>
        }
      />
      <SuppliersTab />
    </div>
  );
}
