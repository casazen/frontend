import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getProblemMessage } from '@/lib/api-errors';
import { useAdminInvites, useResendSupplierInvite, useRevokeSupplierInvite } from '@/queries/use-supplier';
import { ADMIN_INVITE_STATES, type AdminInvite, type AdminInviteState } from '@/types/admin-suppliers';
import { AdminInvitesTable } from './admin-invites-table';
import { ConfirmAdminActionDialog } from './confirm-admin-action-dialog';
import { useDebouncedSearch } from '@/hooks/use-debounced-search';
import { ErrorRow, LoadingRows, Pager } from './admin-list-parts';

const PAGE_SIZE = 20;

/** The supplier invites with state filter, resend and revoke (SU-12), filtered and paginated by the server. */
export function SupplierInvitesList() {
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
