import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getServiceCategoryLabel } from '@/lib/i18n-labels';
import { formatRomeDateTime } from '@/lib/stay-dates';
import type { AdminInvite, AdminInviteState } from '@/types/admin-suppliers';

const STATE_VARIANT: Record<AdminInviteState, 'success' | 'secondary' | 'destructive' | 'warning'> = {
  Pending: 'warning',
  Used: 'success',
  Expired: 'secondary',
  Revoked: 'destructive',
};
const DATE_ONLY: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };

/**
 * The invites of one page. A pending or expired invite can be sent again (new link and expiry), a pending one revoked;
 * a used or revoked one has no action (SU-12).
 */
export function AdminInvitesTable({
  invites,
  busyInviteId,
  onResend,
  onRevoke,
}: {
  invites: AdminInvite[];
  busyInviteId?: string | null;
  onResend: (invite: AdminInvite) => void;
  onRevoke: (invite: AdminInvite) => void;
}) {
  const { t, i18n } = useTranslation();

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" data-testid="admin-invites-table">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="pb-2 pr-4 font-medium">{t('admin.suppliers.invites.email')}</th>
            <th className="pb-2 pr-4 font-medium">{t('admin.suppliers.invites.comune')}</th>
            <th className="pb-2 pr-4 font-medium">{t('admin.suppliers.invites.categories')}</th>
            <th className="pb-2 pr-4 font-medium">{t('admin.suppliers.invites.state')}</th>
            <th className="pb-2 pr-4 font-medium">{t('admin.suppliers.invites.expiresAt')}</th>
            <th className="pb-2 font-medium">{t('admin.suppliers.table.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {invites.map((invite) => {
            const busy = busyInviteId === invite.id;
            const canResend = invite.state === 'Pending' || invite.state === 'Expired';
            return (
              <tr key={invite.id} className="border-b align-top last:border-0" data-testid={`admin-invite-${invite.id}`}>
                <td className="py-3 pr-4">
                  <p className="font-medium">{invite.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('admin.suppliers.invites.sentOn', { date: formatRomeDateTime(invite.createdAt, i18n.language, DATE_ONLY) })}
                  </p>
                </td>
                <td className="py-3 pr-4 text-muted-foreground">{invite.comuneCode}</td>
                <td className="py-3 pr-4">
                  {invite.categories.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {invite.categories.map((category) => (
                        <Badge key={category} variant="outline">
                          {getServiceCategoryLabel(category, t)}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="py-3 pr-4">
                  <Badge variant={STATE_VARIANT[invite.state] ?? 'secondary'} data-testid={`admin-invite-state-${invite.id}`}>
                    {t(`admin.suppliers.invites.stateLabel.${invite.state}`)}
                  </Badge>
                </td>
                <td className="py-3 pr-4 text-muted-foreground">
                  {formatRomeDateTime(invite.expiresAt, i18n.language, DATE_ONLY)}
                </td>
                <td className="py-3">
                  <div className="flex flex-wrap gap-2">
                    {canResend && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => onResend(invite)}
                        data-testid={`admin-invite-resend-${invite.id}`}
                      >
                        {t('admin.suppliers.invites.resend')}
                      </Button>
                    )}
                    {invite.state === 'Pending' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => onRevoke(invite)}
                        data-testid={`admin-invite-revoke-${invite.id}`}
                      >
                        {t('admin.suppliers.invites.revoke')}
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
