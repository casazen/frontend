import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, LogIn } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { OWNER_PORTAL_HOME_PATH } from '@/lib/owner-invitation';
import { useSeoMeta } from '@/lib/seo-meta';
import { isSignInFailedState } from './paths';
import { startedRecently, rememberStart } from '@/lib/login-restart-guard';

/** When this page last sent the visitor to the sign-in (`sessionStorage`, one tab). */
const LAST_START_KEY = 'casazen.owner-host-login-started-at';

/**
 * `/portale-proprietari/accedi` on the own domain of an agency whose owners can sign in there (E40/F02/US01/T02, NF-141): the page sends the visitor straight to the sign-in and brings
 * them back to THIS domain, on `/portale-proprietari` (`returnTo`; the address the sign-in returns to is the origin of the host, see `authConfig`). It sits in the frame of the agency
 * (`HostSurfaceFrame`) and, like the sign-in of the CasaZen domain, has only the moment before the redirect to show. It is not `LoginPage`: that page takes only the paths of
 * the app (`/app/…`) as a return address and sends a signed-in person to the choice of context, which does not exist on a host.
 *
 * A person who is already signed in goes straight to the portal. The one case that is not sent: a visitor who comes back within a few seconds of the last start, because the browser's back
 * button returned from the sign-in or because the sign-in answered with an error that sent the app here again. Redirecting that visitor again would be a loop, so the page then offers
 * the way in with a button.
 *
 * The same when the sign-in came back with an error (`HostSignInFailure` in `App` opens the page with the state `SIGN_IN_FAILED_STATE`): the page says that the sign-in did not complete and waits for
 * the visitor to try again, it does not send them off by itself.
 */
export function OwnerHostLoginPage() {
  const { t } = useTranslation();
  const { isAuthenticated, isLoading, user, login } = useAuth();
  const navigate = useNavigate();
  const signInFailed = isSignInFailedState(useLocation().state);
  // Decided once, when the page opens.
  const [redirect] = useState(() => !signInFailed && !startedRecently(LAST_START_KEY));
  const started = useRef(false);
  useSeoMeta({ title: t('ownerPortal.hostLogin.title'), noindex: true });

  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(OWNER_PORTAL_HOME_PATH, { replace: true });
      return;
    }
    if (!redirect || isLoading || isAuthenticated || started.current) return;
    started.current = true;
    rememberStart(LAST_START_KEY);
    login({ returnTo: OWNER_PORTAL_HOME_PATH });
  }, [redirect, isAuthenticated, isLoading, user, login, navigate]);

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10" data-testid="owner-host-login">
      <div className="flex w-full max-w-sm flex-col items-center gap-5 text-center">
        <h1 className="public-display text-2xl font-semibold">{t('ownerPortal.hostLogin.title')}</h1>
        {redirect ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status" data-testid="owner-host-login-redirecting">
            <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
            {t('ownerPortal.hostLogin.redirecting')}
          </p>
        ) : (
          <>
            {signInFailed ? (
              <Alert variant="danger" className="w-full text-left" data-testid="owner-host-login-failed">
                {t('ownerPortal.hostLogin.failed')}
              </Alert>
            ) : null}
            <p className="text-sm text-muted-foreground">{t('ownerPortal.hostLogin.description')}</p>
            <Button type="button" size="lg" className="min-h-11" onClick={() => login({ returnTo: OWNER_PORTAL_HOME_PATH })} data-testid="owner-host-login-button">
              <LogIn aria-hidden="true" className="mr-2 size-5" />
              {t('ownerPortal.hostLogin.button')}
            </Button>
          </>
        )}
      </div>
    </main>
  );
}
