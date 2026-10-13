import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatRomeDateTime } from '@/lib/stay-dates';
import type { HostInvite, HostInviteState } from '@/types/host-invites';

const STATE_VARIANT: Record<HostInviteState, 'success' | 'secondary' | 'destructive' | 'warning'> = {
  Pending: 'warning',
  Used: 'success',
  Expired: 'secondary',
  Revoked: 'destructive',
};
const DATE_ONLY: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };

/**
 * The host invites of one page. A pending or expired invite can be sent again (new link and expiry), a pending one
 * revoked; a used or revoked one has no action. The admin also sees who invited.
 */
export function HostInvitesTable({
  invites,
  showInviter,
  busyInviteId,
  onResend,
  onRevoke,
}: {
  invites: HostInvite[];
  showInviter: boolean;
  busyInviteId?: string | null;
  onResend: (invite: HostInvite) => void;
  onRevoke: (invite: HostInvite) => void;
}) {
  const { t, i18n } = useTranslation();

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" data-testid="host-invites-table">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="pb-2 pr-4 font-medium">{t('hostInvites.list.email')}</th>
            {showInviter && <th className="pb-2 pr-4 font-medium">{t('hostInvites.list.invitedBy')}</th>}
            <th className="pb-2 pr-4 font-medium">{t('hostInvites.list.state')}</th>
            <th className="pb-2 pr-4 font-medium">{t('hostInvites.list.expiresAt')}</th>
            <th className="pb-2 font-medium">{t('hostInvites.list.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {invites.map((invite) => {
            const busy = busyInviteId === invite.id;
            const canResend = invite.state === 'Pending' || invite.state === 'Expired';
            return (
              <tr key={invite.id} className="border-b align-top last:border-0" data-testid={`host-invite-${invite.id}`}>
                <td className="py-3 pr-4">
                  <p className="font-medium">{invite.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('hostInvites.list.sentOn', { date: formatRomeDateTime(invite.createdAt, i18n.language, DATE_ONLY) })}
                  </p>
                </td>
                {showInviter && (
                  <td className="py-3 pr-4 text-muted-foreground" data-testid={`host-invite-inviter-${invite.id}`}>
                    {invite.invitedBy
                      ? t('hostInvites.list.inviter', { name: invite.invitedBy.name, org: invite.invitedBy.orgName })
                      : t('hostInvites.list.noInviter')}
                  </td>
                )}
                <td className="py-3 pr-4">
                  <Badge variant={STATE_VARIANT[invite.state] ?? 'secondary'} data-testid={`host-invite-state-${invite.id}`}>
                    {t(`hostInvites.stateLabel.${invite.state}`)}
                  </Badge>
                  {invite.state === 'Used' && invite.usedAt && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t('hostInvites.list.usedOn', { date: formatRomeDateTime(invite.usedAt, i18n.language, DATE_ONLY) })}
                    </p>
                  )}
                </td>
                <td className="py-3 pr-4 text-muted-foreground">{formatRomeDateTime(invite.expiresAt, i18n.language, DATE_ONLY)}</td>
                <td className="py-3">
                  <div className="flex flex-wrap gap-2">
                    {canResend && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => onResend(invite)}
                        data-testid={`host-invite-resend-${invite.id}`}
                      >
                        {t('hostInvites.list.resend')}
                      </Button>
                    )}
                    {invite.state === 'Pending' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => onRevoke(invite)}
                        data-testid={`host-invite-revoke-${invite.id}`}
                      >
                        {t('hostInvites.list.revoke')}
                      </Button>
                    )}
                    {!canResend && invite.state !== 'Pending' && <span className="text-muted-foreground">—</span>}
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
