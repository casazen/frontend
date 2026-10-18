import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogIn } from 'lucide-react';
import { CasaZenLogo, CasaZenMark } from '@/components/brand/casazen-mark';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';

/** When this page last sent the visitor to Auth0 (`sessionStorage`, one tab). */
const LAST_START_KEY = 'casazen.login-started-at';

/** A visitor who comes back to this page within this time is not sent to Auth0 a second time (see `LoginPage`). */
const RESTART_WINDOW_MS = 15_000;

function startedRecently(): boolean {
  try {
    const startedAt = Number(sessionStorage.getItem(LAST_START_KEY));
    return Number.isFinite(startedAt) && startedAt > 0 && Date.now() - startedAt < RESTART_WINDOW_MS;
  } catch {
    return false;
  }
}

function rememberStart(): void {
  try {
    sessionStorage.setItem(LAST_START_KEY, String(Date.now()));
  } catch {
    // No storage (private mode): the guard against a loop is lost, the redirect itself still works.
  }
}

/**
 * `/login` has no page of its own: the address sends the visitor straight to the Auth0 login (the product owner,
 * 2026-10-16). Everything that needs a session already ends here (`ProtectedRoute`, an expired session, the link of an
 * e-mail), so one redirect covers them all. What is on screen is only the moment before the redirect.
 *
 * The one case that is not sent: a visitor who comes back within a few seconds of the last start, because the browser's
 * back button returned from Auth0 or because Auth0 answered with an error that sent the app here again (a denied or
 * blocked account). Redirecting that visitor again would be a loop, so the page then offers the way in with a button, as
 * the login page used to.
 */
export function LoginPage() {
  const { isAuthenticated, isLoading, user, login } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  // Decided once, when the page opens.
  const [redirect] = useState(() => !startedRecently());
  const started = useRef(false);

  useEffect(() => {
    if (isAuthenticated && user) {
      navigate('/app/choose-context', { replace: true });
      return;
    }
    if (!redirect || isLoading || isAuthenticated || started.current) return;
    started.current = true;
    rememberStart();
    login();
  }, [redirect, isAuthenticated, isLoading, user, login, navigate]);

  if (redirect) {
    return (
      <div role="status" className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[#fbfaf8] px-4 text-center">
        <CasaZenMark size={56} className="animate-pulse motion-reduce:animate-none" />
        <p className="text-sm text-[#4a6d71]">{t('login.redirecting')}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#fbfaf8] px-4 text-center">
      <CasaZenLogo size={44} />
      <p className="max-w-sm text-sm text-[#4a6d71]">{t('login.signInMessage')}</p>
      <Button onClick={() => login()} size="lg" className="bg-[#1f3a3d] text-white hover:bg-[#2b4f53]">
        <LogIn className="mr-2 h-5 w-5" />
        {t('login.signInButton')}
      </Button>
    </div>
  );
}
