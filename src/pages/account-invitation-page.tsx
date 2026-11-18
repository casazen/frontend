import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthBridge } from '@/contexts/auth-bridge';
import { accountInvitationLogin } from '@/lib/account-invitation';

export function AccountInvitationPage() {
  const { t } = useTranslation();
  const { hash, pathname, search } = useLocation();
  const { isLoading, kind, login } = useAuthBridge();
  const [invitation] = useState(() => accountInvitationLogin(hash));
  const started = useRef(false);

  useEffect(() => {
    if (hash && window.location.hash === hash) {
      window.history.replaceState(window.history.state, '', pathname + search);
    }
    if (isLoading || started.current || kind !== 'auth0' || !invitation) return;
    started.current = true;
    login(invitation);
  }, [hash, invitation, isLoading, kind, login, pathname, search]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t('invitation.pageTitle')}</CardTitle>
          <CardDescription role="status">
            {t(invitation ? 'login.redirecting' : 'invitation.unusable.invalid.description')}
          </CardDescription>
        </CardHeader>
        {invitation && kind === 'auth0' && (
          <CardContent>
            <Button className="w-full" disabled={isLoading} onClick={() => login(invitation)}>
              {t('invitation.retry')}
            </Button>
          </CardContent>
        )}
      </Card>
    </main>
  );
}
