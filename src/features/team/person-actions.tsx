import { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Copy, Mail, RotateCcw, UserCog, UserRoundCheck, UserRoundX, Users } from 'lucide-react';
import { toast } from 'sonner';
import { PlainSection } from '@/components/shared/calm';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { Button } from '@/components/ui/button';
import { WorkspaceContext } from '@/contexts/workspace-context';
import { getProblemMessage } from '@/lib/api-errors';
import { ACCOUNT_BILLING_PATH } from '@/lib/billing-routes';
import { toastUndo } from '@/lib/toast-undo';
import { useInvitationsCache, useOrgMembers, useOrgTeamActions } from '@/queries/use-org-team';
import type { OrgRole } from '@/types/org-team.types';
import { ChangeRoleDialog } from './change-role-dialog';
import { MemberAccessDialog } from './member-access-dialog';
import { personActions } from './person-actions-model';
import type { PersonRow } from './people-rows';
import { dayOf, daysSince } from './team-dates';
import { problemCodeOf, SEAT_LIMIT_CODE } from './team-errors';
import { useCopyInvitationLink } from './use-copy-invitation-link';

/** The permission of the owner and the administrators over the people of the org (the page is behind it too). */
const MANAGE_PEOPLE = 'org.members.manage';

type OpenDialog = 'role' | 'access' | 'deactivate';

/**
 * «Cosa puoi fare» in the drawer of a person (AM-04b-FU1): change the role, choose areas and properties, switch the access off and on,
 * send an invitation again, copy its link, withdraw it. One main button for what the state of the person asks (an invitation that
 * waits: send it again; an access that is off: switch it on; a person that is in: change the role), the others quiet. What cannot be
 * taken back asks first (the access off: the word DISATTIVA) or waits six seconds (withdrawing an invitation); the rest has an
 * «Annulla» in its toast that does the opposite for real. Only for who holds `org.members.manage`, and only what the backend will
 * accept (`personActions`): the owner is never touched, an administrator is in the hands of the owner alone.
 */
export function PersonActions({ row, callerRole, close }: { row: PersonRow; callerRole: OrgRole | null; close: () => void }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const workspace = useContext(WorkspaceContext);
  const actions = useOrgTeamActions();
  const invitations = useInvitationsCache();
  const { copyLink, copying } = useCopyInvitationLink();
  const members = useOrgMembers(true);
  const [dialog, setDialog] = useState<OpenDialog | null>(null);
  const [busy, setBusy] = useState<'resend' | 'reactivate' | null>(null);

  const may = personActions(row, callerRole);
  const allowed = workspace?.hasPermission('account', MANAGE_PEOPLE) ?? false;
  if (!allowed) return null;

  const failed = (error: unknown) => {
    // A refusal for the last seat has its way out one click away: the plan.
    const seatLimit = problemCodeOf(error) === SEAT_LIMIT_CODE;
    toast.error(getProblemMessage(error, t) ?? t('team.actions.failed'), seatLimit ? { action: { label: t('team.invite.seats.plan'), onClick: () => void navigate(ACCOUNT_BILLING_PATH) } } : undefined);
  };

  const resend = async () => {
    setBusy('resend');
    try {
      const sent = await actions.resendInvitation(row.id);
      if (sent.emailQueued) {
        toast.success(t('team.actions.resend.done', { name: row.name }), { description: t('team.actions.resend.until', { date: dayOf(sent.invitation.expiresAt, i18n.language) }) });
      } else {
        toast.warning(t('team.actions.resend.noEmail'), {
          description: t('team.actions.resend.noEmailHint'),
          action: { label: t('team.invite.done.copyLink'), onClick: () => void copyLink(row.id) },
        });
      }
    } catch (error) {
      failed(error);
    } finally {
      setBusy(null);
    }
  };

  const reactivate = async () => {
    setBusy('reactivate');
    try {
      await actions.reactivate(row.id);
      toastUndo(t('team.actions.reactivate.done', { name: row.name }), {
        description: t('team.actions.reactivate.doneHint'),
        undo: async () => {
          await actions.deactivate(row.id);
        },
      });
    } catch (error) {
      failed(error);
    } finally {
      setBusy(null);
    }
  };

  const deactivate = async () => {
    try {
      await actions.deactivate(row.id);
      // Back on, it takes a seat again: if the plan has none left by then, «Annulla» says so with the message of the server.
      toastUndo(t('team.actions.deactivate.done', { name: row.name }), {
        description: t('team.actions.deactivate.doneHint'),
        undo: async () => {
          await actions.reactivate(row.id);
        },
      });
    } catch (error) {
      failed(error);
    }
  };

  // A withdrawn invitation does not come back: the row leaves the list now and the invitation is withdrawn when the six seconds are over.
  const revoke = () => {
    const previous = invitations.hide(row.id);
    close();
    toastUndo(t('team.actions.revoke.done', { name: row.name }), {
      description: t('team.actions.revoke.doneHint'),
      commit: async () => {
        await actions.revokeInvitation(row.id);
      },
      undo: () => invitations.restore(previous),
    });
  };

  const seats = members.data?.seats;
  const consequences = [
    t('team.actions.deactivate.next'),
    ...(seats && !seats.unlimited ? [t('team.actions.deactivate.seat', { used: Math.max(0, seats.used - 1), max: seats.max })] : []),
    t('team.actions.deactivate.back'),
  ];

  // What the state of the person asks for, in a line: how long an invitation has waited, that a link ran out, that an access is off.
  const days = row.kind === 'invitation' ? daysSince(row.since, new Date()) : 0;
  const now =
    row.kind === 'invitation'
      ? row.status === 'Expired'
        ? t('team.actions.now.expired')
        : days > 0
          ? t('team.actions.now.pending', { count: days })
          : t('team.actions.now.pendingToday')
      : row.status === 'Deactivated'
        ? t('team.actions.now.deactivated')
        : null;

  const available = Object.entries(may).some(([key, value]) => key !== 'locked' && value === true);
  if (!available && may.locked === null) return null;

  return (
    <PlainSection title={t('team.actions.title')}>
      {now ? <p className="text-sm text-foreground/80">{now}</p> : null}
      {may.locked ? <p className="text-sm text-foreground/70" data-testid="person-actions-locked">{t(`team.actions.locked.${may.locked}`)}</p> : null}

      <div className="flex flex-wrap gap-2" data-testid="person-actions">
        {may.resend ? (
          <Button type="button" className="min-h-11" loading={busy === 'resend'} onClick={() => void resend()} data-testid="person-resend">
            <Mail aria-hidden="true" className="size-4" />
            {t('team.actions.resend.label')}
          </Button>
        ) : null}
        {may.reactivate ? (
          <Button type="button" className="min-h-11" loading={busy === 'reactivate'} onClick={() => void reactivate()} data-testid="person-reactivate">
            <UserRoundCheck aria-hidden="true" className="size-4" />
            {t('team.actions.reactivate.label')}
          </Button>
        ) : null}
        {may.changeRole ? (
          <Button type="button" className="min-h-11" onClick={() => setDialog('role')} data-testid="person-change-role">
            <UserCog aria-hidden="true" className="size-4" />
            {t('team.actions.role.label')}
          </Button>
        ) : null}
        {may.editAccess ? (
          <Button type="button" variant="outline" className="min-h-11" onClick={() => setDialog('access')} data-testid="person-edit-access">
            <Users aria-hidden="true" className="size-4" />
            {t('team.actions.access.label')}
          </Button>
        ) : null}
        {may.copyLink ? (
          <Button type="button" variant="outline" className="min-h-11" loading={copying} onClick={() => void copyLink(row.id)} data-testid="person-copy-link">
            <Copy aria-hidden="true" className="size-4" />
            {t('team.invite.done.copyLink')}
          </Button>
        ) : null}
        {may.deactivate ? (
          <Button type="button" variant="danger-outline" className="min-h-11" onClick={() => setDialog('deactivate')} data-testid="person-deactivate">
            <UserRoundX aria-hidden="true" className="size-4" />
            {t('team.actions.deactivate.label')}
          </Button>
        ) : null}
        {may.revoke ? (
          <Button type="button" variant="danger-outline" className="min-h-11" onClick={revoke} data-testid="person-revoke">
            <RotateCcw aria-hidden="true" className="size-4" />
            {t('team.actions.revoke.label')}
          </Button>
        ) : null}
      </div>

      <ChangeRoleDialog row={row} open={dialog === 'role'} onOpenChange={(open) => setDialog(open ? 'role' : null)} />
      <MemberAccessDialog row={row} open={dialog === 'access'} onOpenChange={(open) => setDialog(open ? 'access' : null)} />
      <ConfirmationDialog
        open={dialog === 'deactivate'}
        onOpenChange={(open) => setDialog(open ? 'deactivate' : null)}
        title={t('team.actions.deactivate.title', { name: row.name })}
        description={t('team.actions.deactivate.description', { name: row.name })}
        consequences={consequences}
        requireText={t('team.actions.deactivate.word')}
        confirmLabel={t('team.actions.deactivate.confirm')}
        variant="destructive"
        onConfirm={deactivate}
      />
    </PlainSection>
  );
}
