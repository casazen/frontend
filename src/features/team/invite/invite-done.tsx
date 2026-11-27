import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarClock, Copy, KeyRound, Users } from 'lucide-react';
import { WizardDone } from '@/components/shared/wizard/wizard-done';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { OrgInvitationSent } from '@/types/org-team.types';
import { ACCOUNT_PEOPLE_PATH } from '../../account/account-home-model';
import { dayOf } from '../team-dates';
import { ACCOUNT_INVITE_PATH, ACCOUNT_INVITED_PATH } from '../team-paths';
import { useCopyInvitationLink } from '../use-copy-invitation-link';

interface InviteDoneProps {
  /** Available in the tab that submitted the invitation, until the page reloads. */
  sent: OrgInvitationSent | undefined;
}

/**
 * «Cosa succede ora» after the invitation is made. Only true things: how long the link lasts, that the person chooses the password
 * and accepts the documents again, that the invitation takes a seat. When the email could not be queued it says so and offers the
 * link to hand by hand (`POST …/{id}/link`).
 */
export function InviteDone({ sent }: InviteDoneProps) {
  const { t, i18n } = useTranslation();
  const { copyLink, copying } = useCopyInvitationLink();

  if (!sent) {
    return (
      <Alert title={t('team.invite.done.checkStatus')} action={
        <Button asChild size="sm" variant="outline" className="min-h-11">
          <Link to={ACCOUNT_PEOPLE_PATH}>{t('team.roles.openPeople')}</Link>
        </Button>
      }>
        {t('team.invite.done.checkPeople')}
      </Alert>
    );
  }

  const { email, name, expiresAt } = sent.invitation;
  const emailFailed = sent.emailQueued === false;
  const expiry = t('team.invite.done.expires', { date: dayOf(expiresAt, i18n.language) });

  return (
    <div className="space-y-6" data-testid="invite-done">
      {emailFailed ? (
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
        title={t('team.invite.done.titleCreated', { name })}
        description={sent.emailQueued === true ? t('team.invite.done.description', { email }) : undefined}
        whatNext={[
          { text: expiry, icon: CalendarClock },
          { text: t('team.invite.done.account'), icon: KeyRound },
          { text: t('team.invite.done.seat'), icon: Users },
        ]}
        primary={{ label: t('team.invite.done.another'), to: `${ACCOUNT_INVITE_PATH}?n=${encodeURIComponent(sent.invitation.id)}` }}
        secondary={{ label: t('team.invite.done.seeInvited'), to: ACCOUNT_INVITED_PATH }}
      />
    </div>
  );
}
