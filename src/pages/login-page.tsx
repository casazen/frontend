import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ownerPortalPaths } from '@/features/owner-portal/paths';
import { safeReturnTo } from '@/lib/auth-return-to';
import { useTranslation } from 'react-i18next';
import { LogIn } from 'lucide-react';
import { PublicAccessFrame } from './public-access-frame';
import { CasaZenMark } from '@/components/brand/casazen-mark';
import { Button } from '@/components/ui/button';
import { useLoginHandoff } from '@/hooks/use-login-handoff';
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
  const { isAuthenticated, isLoading, user } = useAuth();
  const handoff = useLoginHandoff();
  const { start } = handoff;
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const candidate = safeReturnTo(params.get('returnTo'));
  // Only application routes can be a post-login target; never external URLs or /login itself.
  const destination = candidate && new URL(candidate, window.location.origin).pathname;
  const ownerPage = destination === ownerPortalPaths.home ||
    (destination?.startsWith(ownerPortalPaths.home + '/') &&
      /^(?:immobili|calendario|contabilita|rendiconti|documenti|documenti-emessi|messaggi|contatti)(?:\/|$)/.test(destination.slice(ownerPortalPaths.home.length + 1)));
  const returnTo = destination?.startsWith('/app/') || ownerPage ? candidate
    : pathname === ownerPortalPaths.signIn ? ownerPortalPaths.home : null;
  const { t } = useTranslation();
  // Decided once, when the page opens.
  const [redirect] = useState(() => !startedRecently());
  const started = useRef(false);
  const [slowInitialization, setSlowInitialization] = useState(false);
  useEffect(() => {
    if (!isLoading) return;
    const timer = window.setTimeout(() => setSlowInitialization(true), RESTART_WINDOW_MS);
    return () => window.clearTimeout(timer);
  }, [isLoading]);

  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(returnTo ?? '/app/choose-context', { replace: true });
      return;
    }
    if (!redirect || isLoading || isAuthenticated || started.current) return;
    started.current = true;
    rememberStart();
    start(returnTo ? { returnTo } : undefined);
  }, [redirect, isAuthenticated, isLoading, user, start, navigate, returnTo]);

  const initializationStalled = isLoading && slowInitialization;
  const handoffProblem = handoff.status === 'failed' || handoff.status === 'delayed';
  if (!initializationStalled && !handoffProblem && (handoff.busy || isLoading || redirect)) {
    return (
      <div role="status" className="flex min-h-svh flex-col items-center justify-center gap-5 bg-background px-4 text-center">
        <CasaZenMark size={56} className="animate-pulse motion-reduce:animate-none" />
        <p className="text-sm text-muted-foreground">{t('login.redirecting')}</p>
      </div>
    );
  }

  return (
    <PublicAccessFrame title={t('login.resumeTitle')} icon={LogIn} description={
      <p role={handoffProblem || initializationStalled ? 'alert' : undefined} className="text-sm leading-relaxed text-muted-foreground">
        {t(initializationStalled ? 'login.initializationSlow' : handoffProblem ? 'login.handoffFailed' : 'login.resumeBody')}
      </p>
    }>
      <Button type="button" onClick={() => {
        if (initializationStalled) window.location.reload();
        else { rememberStart(); start(returnTo ? { returnTo } : undefined); }
      }} size="lg" className="w-full">
        <LogIn aria-hidden="true" className="size-5" />
        {t(initializationStalled ? 'login.reload' : 'login.signInButton')}
      </Button>
    </PublicAccessFrame>
  );
}
