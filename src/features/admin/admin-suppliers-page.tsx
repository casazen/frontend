import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { getProblemMessage } from '@/lib/api-errors';
import { getSupplierStatusLabel } from '@/lib/i18n-labels';
import {
  useAdminInvites,
  useAdminSuppliers,
  useReactivateSupplier,
  useResendSupplierInvite,
  useRevokeSupplierInvite,
  useSuspendSupplier,
} from '@/queries/use-supplier';
import {
  ADMIN_INVITE_STATES,
  ADMIN_SUPPLIER_STATUSES,
  type AdminInvite,
  type AdminInviteState,
  type AdminSupplier,
  type AdminSupplierStatus,
} from '@/types/admin-suppliers';
import { AdminInvitesTable } from './components/admin-invites-table';
import { AdminSuppliersTable } from './components/admin-suppliers-table';
import { ConfirmAdminActionDialog } from './components/confirm-admin-action-dialog';
import { SupplierAuditDialog } from './components/supplier-audit-dialog';
import { SuspendSupplierDialog } from './components/suspend-supplier-dialog';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

type Tab = 'suppliers' | 'invites';
const TABS: { value: Tab; labelKey: string }[] = [
  { value: 'suppliers', labelKey: 'admin.suppliers.tabSuppliers' },
  { value: 'invites', labelKey: 'admin.suppliers.tabInvites' },
];

/**
 * Search box that updates its filter 300 ms after the last keystroke, not on every one (A1-26), and goes back to the
 * first page of the list when it does.
 */
function useDebouncedSearch(setPage: (page: number) => void) {
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const handle = window.setTimeout(() => {
      setSearch(input.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [input, setPage]);
  return { input, setInput, search };
}

function Pager({
  page,
  pageSize,
  totalCount,
  onPage,
}: {
  page: number;
  pageSize: number;
  totalCount: number;
  onPage: (page: number) => void;
}) {
  const { t } = useTranslation();
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground" data-testid="admin-suppliers-pagination">
      <span>{t('admin.suppliers.pagination', { page, totalPages, totalCount })}</span>
      {totalPages > 1 && (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)} data-testid="admin-suppliers-prev">
            {t('admin.suppliers.previous')}
          </Button>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)} data-testid="admin-suppliers-next">
            {t('admin.suppliers.next')}
          </Button>
        </div>
      )}
    </div>
  );
}

function LoadingRows() {
  const { t } = useTranslation();
  return (
    <div className="space-y-2" data-testid="admin-suppliers-loading" aria-busy="true" aria-label={t('admin.suppliers.loading')}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

function ErrorRow({ error, message, onRetry }: { error: unknown; message: string; onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-3 py-6" role="alert" data-testid="admin-suppliers-error">
      <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
      <p className="flex-1 text-sm text-destructive">{getProblemMessage(error, t) ?? message}</p>
      <Button size="sm" variant="outline" onClick={onRetry}>
        {t('admin.suppliers.retry')}
      </Button>
    </div>
  );
}

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

function InvitesTab() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [state, setState] = useState<AdminInviteState | ''>('');
  const { input, setInput, search } = useDebouncedSearch(setPage);
  const [resending, setResending] = useState<AdminInvite | null>(null);
  const [revoking, setRevoking] = useState<AdminInvite | null>(null);
  const resend = useResendSupplierInvite();
  const revoke = useRevokeSupplierInvite();

  const { data, isLoading, isError, error, refetch } = useAdminInvites({
    search: search || undefined,
    state: state || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const onActionError = (err: unknown) => toast.error(getProblemMessage(err, t) ?? t('admin.suppliers.toast.error'));
  const busyInviteId = resend.isPending ? resend.variables : revoke.isPending ? revoke.variables : null;
  const filtered = search !== '' || state !== '';

  let content;
  if (isLoading) {
    content = <LoadingRows />;
  } else if (isError || !data) {
    content = <ErrorRow error={error} message={t('admin.suppliers.invites.loadError')} onRetry={() => void refetch()} />;
  } else if (data.items.length === 0) {
    content = (
      <p className="py-8 text-center text-muted-foreground" data-testid="admin-invites-empty">
        {filtered ? t('admin.suppliers.invites.emptyFiltered') : t('admin.suppliers.invites.empty')}
      </p>
    );
  } else {
    content = (
      <>
        <AdminInvitesTable invites={data.items} busyInviteId={busyInviteId} onResend={setResending} onRevoke={setRevoking} />
        <Pager page={data.page || page} pageSize={data.pageSize || PAGE_SIZE} totalCount={data.totalCount} onPage={setPage} />
      </>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder={t('admin.suppliers.invites.searchPlaceholder')}
          aria-label={t('admin.suppliers.invites.searchPlaceholder')}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="max-w-xs"
          data-testid="admin-invites-search"
        />
        <select
          className="rounded-md border bg-background px-3 py-2 text-sm"
          aria-label={t('admin.suppliers.invites.state')}
          value={state}
          onChange={(e) => {
            setState(e.target.value as AdminInviteState | '');
            setPage(1);
          }}
          data-testid="admin-invites-state"
        >
          <option value="">{t('admin.suppliers.filter.allInviteStates')}</option>
          {ADMIN_INVITE_STATES.map((value) => (
            <option key={value} value={value}>
              {t(`admin.suppliers.invites.stateLabel.${value}`)}
            </option>
          ))}
        </select>
      </div>

      <Card>
        <CardContent className="pt-6">{content}</CardContent>
      </Card>

      {resending && (
        <ConfirmAdminActionDialog
          title={t('admin.suppliers.invites.resendDialog.title')}
          description={t('admin.suppliers.invites.resendDialog.description', { email: resending.email })}
          confirmLabel={t('admin.suppliers.invites.resend')}
          isPending={resend.isPending}
          onCancel={() => setResending(null)}
          onConfirm={() =>
            resend.mutate(resending.id, {
              onSuccess: () => {
                toast.success(t('admin.suppliers.toast.inviteResent', { email: resending.email }));
                setResending(null);
              },
              onError: onActionError,
            })
          }
        />
      )}
      {revoking && (
        <ConfirmAdminActionDialog
          title={t('admin.suppliers.invites.revokeDialog.title')}
          description={t('admin.suppliers.invites.revokeDialog.description', { email: revoking.email })}
          confirmLabel={t('admin.suppliers.invites.revoke')}
          destructive
          isPending={revoke.isPending}
          onCancel={() => setRevoking(null)}
          onConfirm={() =>
            revoke.mutate(revoking.id, {
              onSuccess: () => {
                toast.success(t('admin.suppliers.toast.inviteRevoked', { email: revoking.email }));
                setRevoking(null);
              },
              onError: onActionError,
            })
          }
        />
      )}
    </div>
  );
}

/**
 * Platform admin's view of the suppliers (SU-12, A4-29): the list with status, suspension and reactivation (reason
 * required, audit trail), and the invites with resend and revoke. Both lists are filtered and paginated by the server.
 */
export function AdminSuppliersPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('suppliers');

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

      <div className="inline-flex rounded-lg bg-muted p-1" role="tablist" aria-label={t('admin.suppliers.tabsLabel')}>
        {TABS.map(({ value, labelKey }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              tab === value ? 'bg-background shadow' : 'text-muted-foreground hover:text-foreground'
            }`}
            data-testid={`admin-suppliers-tab-${value}`}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>

      {tab === 'suppliers' ? <SuppliersTab /> : <InvitesTab />}
    </div>
  );
}
