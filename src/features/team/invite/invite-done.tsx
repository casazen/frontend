import { useTranslation } from 'react-i18next';
import { CalendarClock, Copy, KeyRound, Users } from 'lucide-react';
import { WizardDone } from '@/components/shared/wizard/wizard-done';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { OrgInvitationSent } from '@/types/org-team.types';
import { dayOf } from '../team-dates';
import { ACCOUNT_INVITE_PATH, ACCOUNT_INVITED_PATH } from '../team-paths';
import { useCopyInvitationLink } from '../use-copy-invitation-link';
import type { InviteValues } from './invite-model';

interface InviteDoneProps {
  /** What the server answered. Without it (the last screen opened again) the screen says what is true of every invitation. */
  sent: OrgInvitationSent | undefined;
  values: InviteValues;
}

/**
 * «Cosa succede ora» after the invitation is made. Only true things: how long the link lasts, that the person chooses the password
 * and accepts the documents again, that the invitation takes a seat. When the email could not be queued it says so and offers the
 * link to hand by hand (`POST …/{id}/link`).
 */
export function InviteDone({ sent, values }: InviteDoneProps) {
  const { t, i18n } = useTranslation();
  const { copyLink, copying } = useCopyInvitationLink();

  const name = sent?.invitation.name ?? (values.name.trim() || undefined);
  const email = sent?.invitation.email ?? (values.email.trim() || undefined);
  const emailFailed = sent?.emailQueued === false;
  const expiry = sent ? t('team.invite.done.expires', { date: dayOf(sent.invitation.expiresAt, i18n.language) }) : t('team.invite.done.expiresGeneric');

  return (
    <div className="space-y-6" data-testid="invite-done">
      {emailFailed && sent ? (
        <Alert
          variant="warning"
          title={t('team.invite.done.emailFailedTitle')}
          className="mx-auto max-w-xl"
          action={
            <Button type="button" size="sm" variant="outline" className="min-h-11" loading={copying} onClick={() => void copyLink(sent.invitation.id)} data-testid="invite-copy-link">
              <Copy aria-hidden="true" className="size-4" />
              {t('team.invite.done.copyLink')}
            </Button>
          }
        >
          {t('team.invite.done.emailFailedText')}
        </Alert>
      ) : null}

      <WizardDone
        title={name ? t(emailFailed ? 'team.invite.done.titleCreated' : 'team.invite.done.title', { name }) : t('team.invite.done.titleGeneric')}
        description={email && !emailFailed ? t('team.invite.done.description', { email }) : undefined}
        whatNext={[
          { text: expiry, icon: CalendarClock },
          { text: t('team.invite.done.account'), icon: KeyRound },
          { text: t('team.invite.done.seat'), icon: Users },
        ]}
        primary={{ label: t('team.invite.done.another'), to: sent ? `${ACCOUNT_INVITE_PATH}?n=${encodeURIComponent(sent.invitation.id)}` : `${ACCOUNT_INVITE_PATH}?n=again` }}
        secondary={{ label: t('team.invite.done.seeInvited'), to: ACCOUNT_INVITED_PATH }}
      />
    </div>
  );
}
