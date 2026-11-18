import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { useLoginHandoff } from '@/hooks/use-login-handoff';
import { accountInvitationLogin } from '@/lib/account-invitation';

export function AccountInvitationPage() {
  const { hash, pathname, search } = useLocation();
  return <InvitationHandoff key={hash} fragment={hash} cleanUrl={pathname + search} />;
}

function InvitationHandoff({ fragment, cleanUrl }: { fragment: string; cleanUrl: string }) {
  const { t } = useTranslation();
  const { isLoading, kind } = useAuth();
  const { start, status, busy } = useLoginHandoff();
  const [invitation] = useState(() => accountInvitationLogin(fragment));
  const started = useRef(false);
  const canStart = kind === 'auth0' && invitation !== null;
  const handoffFailed = status === 'failed' || status === 'delayed';

  useEffect(() => {
    if (fragment && window.location.hash === fragment) {
      window.history.replaceState(window.history.state, '', cleanUrl);
    }
    if (isLoading || started.current || !canStart) return;
    started.current = true;
    start(invitation);
  }, [canStart, cleanUrl, fragment, invitation, isLoading, start]);

  const message = !invitation ? 'invitation.unusable.invalid'
    : !canStart ? 'invitation.unavailable'
    : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t(message ? `${message}.title` : 'invitation.pageTitle')}</CardTitle>
          <CardDescription role={handoffFailed ? 'alert' : 'status'}>
            {t(message ? `${message}.description` : handoffFailed ? 'login.handoffFailed' : 'login.redirecting')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {canStart ? (
            <Button className="w-full" disabled={isLoading || busy} onClick={() => start(invitation)}>
              {t('invitation.retry')}
            </Button>
          ) : (
            <Button asChild variant="outline" className="w-full">
              <Link to="/">{t('invitation.unusable.goToApp')}</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
