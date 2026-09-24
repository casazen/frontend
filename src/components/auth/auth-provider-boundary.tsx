import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/use-auth';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { isPublicUnauthenticatedPath } from '@/lib/secure-origin';

/**
 * Pages that need Auth0 (login, signup, workspace). The app opened on a public path runs without Auth0
 * (`isPublicUnauthenticatedPath`, decided at first paint): when a link of a public page leads here client-side, this
 * page is loaded again so that App mounts Auth0, instead of rendering a login page whose button would reload and ask
 * for a second click (A8-03). The public pages themselves never come here.
 */
export function AuthProviderBoundary() {
  const { t } = useTranslation();
  const { kind } = useAuth();
  const { pathname, search, hash } = useLocation();
  const reload = kind === 'anonymous' && !isPublicUnauthenticatedPath(pathname);

  useEffect(() => {
    if (reload) window.location.replace(`${pathname}${search}${hash}`);
  }, [reload, pathname, search, hash]);

  if (reload) return <LoadingScreen message={t('shared.loading.defaultMessage')} />;
  return <Outlet />;
}
