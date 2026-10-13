import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { ErrorRow, LoadingRows, Pager } from '@/features/admin/components/admin-list-parts';
import { useDebouncedSearch } from '@/hooks/use-debounced-search';
import { getProblemMessage } from '@/lib/api-errors';
import { useHostInvites, useResendHostInvite, useRevokeHostInvite } from '@/queries/use-host-invites';
import type { HostInviteScope } from '@/api/host-invites.api';
import { HOST_INVITE_STATES, type HostInvite, type HostInviteState } from '@/types/host-invites';
import { HostInvitesTable } from './host-invites-table';

const PAGE_SIZE = 20;

/**
 * Host invites with state filter and search, resend and revoke (each asks for confirmation), filtered and paginated by
 * the server. Full width, like the other lists. The admin sees all the invites and who sent them, a host only their own.
 */
export function HostInvitesList({ scope }: { scope: HostInviteScope }) {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [state, setState] = useState<HostInviteState | ''>('');
  const { input, setInput, search } = useDebouncedSearch(setPage);
  const [resending, setResending] = useState<HostInvite | null>(null);
  const [revoking, setRevoking] = useState<HostInvite | null>(null);
  const resend = useResendHostInvite(scope);
  const revoke = useRevokeHostInvite(scope);

  const { data, isLoading, isError, error, refetch } = useHostInvites(scope, {
    search: search || undefined,
    state: state || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const busyInviteId = resend.isPending ? resend.variables : revoke.isPending ? revoke.variables : null;
  const filtered = search !== '' || state !== '';
  const onActionError = (err: unknown) => toast.error(getProblemMessage(err, t) ?? t('hostInvites.toast.error'));

  const confirmResend = async () => {
    if (!resending) return;
    try {
      await resend.mutateAsync(resending.id);
      toast.success(t('hostInvites.toast.resent', { email: resending.email }));
    } catch (err) {
      onActionError(err);
    }
  };

  const confirmRevoke = async () => {
    if (!revoking) return;
    try {
      await revoke.mutateAsync(revoking.id);
      toast.success(t('hostInvites.toast.revoked', { email: revoking.email }));
    } catch (err) {
      onActionError(err);
    }
  };

  let content;
  if (isLoading) {
    content = <LoadingRows />;
  } else if (isError || !data?.items) {
    content = <ErrorRow error={error} message={t('hostInvites.list.loadError')} onRetry={() => void refetch()} />;
  } else if (data.items.length === 0) {
    content = (
      <p className="py-8 text-center text-muted-foreground" data-testid="host-invites-empty">
        {filtered ? t('hostInvites.list.emptyFiltered') : t('hostInvites.list.empty')}
      </p>
    );
  } else {
    content = (
      <>
        <HostInvitesTable
          invites={data.items}
          showInviter={scope === 'admin'}
          busyInviteId={busyInviteId}
          onResend={setResending}
          onRevoke={setRevoking}
        />
        <Pager page={data.page || page} pageSize={data.pageSize || PAGE_SIZE} totalCount={data.totalCount} onPage={setPage} />
      </>
    );
  }

  return (
    <div className="space-y-4" data-testid="host-invites-list">
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder={t('hostInvites.list.searchPlaceholder')}
          aria-label={t('hostInvites.list.searchPlaceholder')}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="max-w-xs"
          data-testid="host-invites-search"
        />
        <select
          className="rounded-md border bg-background px-3 py-2 text-sm"
          aria-label={t('hostInvites.list.state')}
          value={state}
          onChange={(e) => {
            setState(e.target.value as HostInviteState | '');
            setPage(1);
          }}
          data-testid="host-invites-state"
        >
          <option value="">{t('hostInvites.list.allStates')}</option>
          {HOST_INVITE_STATES.map((value) => (
            <option key={value} value={value}>
              {t(`hostInvites.stateLabel.${value}`)}
            </option>
          ))}
        </select>
      </div>

      <Card>
        <CardContent className="pt-6">{content}</CardContent>
      </Card>

      <ConfirmationDialog
        open={resending !== null}
        onOpenChange={(open) => !open && setResending(null)}
        title={t('hostInvites.resendDialog.title')}
        description={t('hostInvites.resendDialog.description', { email: resending?.email ?? '' })}
        confirmLabel={t('hostInvites.list.resend')}
        isLoading={resend.isPending}
        onConfirm={confirmResend}
      />
      <ConfirmationDialog
        open={revoking !== null}
        onOpenChange={(open) => !open && setRevoking(null)}
        title={t('hostInvites.revokeDialog.title')}
        description={t('hostInvites.revokeDialog.description', { email: revoking?.email ?? '' })}
        confirmLabel={t('hostInvites.list.revoke')}
        variant="destructive"
        isLoading={revoke.isPending}
        onConfirm={confirmRevoke}
      />
    </div>
  );
}
