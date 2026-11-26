import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MailCheck, LogIn, MailWarning } from 'lucide-react';
import { ORG_INVITE_ACCEPT_PATH, readOrgInviteToken } from '@/lib/org-invitation';
import { useLoginHandoff } from '@/hooks/use-login-handoff';
import { useAuth } from '@/hooks/use-auth';
import { hostInvitePath, readPendingHostInvite } from '@/lib/host-invite';
import { Button } from '@/components/ui/button';
import { PublicAccessFrame } from './public-access-frame';
import { emailVerificationOutcome } from './email-verification-outcome';

/**
 * Landing page of the Auth0 verification email (Redirect To). Stays outside the login callback so Auth0's
 * `code=success` is not treated as an authorization code.
 */
export function EmailVerifiedPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isLoading, isAuthenticated, user } = useAuth();
  const handoff = useLoginHandoff();
  const pendingInvite = Boolean(readOrgInviteToken(new URLSearchParams()));
  const outcome = emailVerificationOutcome(searchParams);
  const failed = outcome === 'failed';
  const pendingHostInvite = outcome === 'verified' ? readPendingHostInvite() : null;
  const returnTo = pendingInvite ? ORG_INVITE_ACCEPT_PATH : pendingHostInvite ? hostInvitePath(pendingHostInvite) : undefined;
  const needsFreshSession = Boolean(returnTo && isAuthenticated && user && 'email_verified' in user && user.email_verified === false);

  useEffect(() => {
    if (!isLoading && isAuthenticated && returnTo && !failed && !needsFreshSession) {
      navigate(returnTo, { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate, returnTo, failed, needsFreshSession]);

  return (
    <PublicAccessFrame icon={failed ? MailWarning : MailCheck} success={outcome === 'verified'} testId="email-verified-page" outcome={outcome}
      title={t(failed ? 'emailVerified.failedTitle' : outcome === 'verified' ? 'emailVerified.title' : 'emailVerified.unknownTitle')}
      description={t(failed ? 'emailVerified.failedDescription' : outcome === 'verified' ? 'emailVerified.description' : 'emailVerified.unknownDescription')}>
      {handoff.status === 'failed' || handoff.status === 'delayed' ? <p role="alert" className="text-sm">{t('login.handoffFailed')}</p> : null}
      {!failed && !returnTo && <p className="text-sm text-muted-foreground">{t('emailVerified.inviteTab')}</p>}
      <Button className="w-full" size="lg" disabled={isLoading || handoff.busy} onClick={() => {
        if (isAuthenticated && !returnTo) {
          navigate('/app/choose-context', { replace: true });
          return;
        }
        handoff.start(returnTo ? {
          returnTo,
          ...(needsFreshSession ? { authorizationParams: { prompt: 'login' } } : {}),
        } : undefined);
      }} data-testid="email-verified-sign-in">
        <LogIn className="mr-2 h-5 w-5" />
        {t(pendingInvite ? 'emailVerified.resumeInvite' : isAuthenticated ? 'invitation.unusable.goToApp' : 'emailVerified.signIn')}
      </Button>
    </PublicAccessFrame>
  );
}
