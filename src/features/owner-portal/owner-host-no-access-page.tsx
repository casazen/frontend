import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogOut, ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { getHostSite } from '@/lib/host-site';
import { useSeoMeta } from '@/lib/seo-meta';
import { ownerPortalPaths } from './paths';

/**
 * `/portale-proprietari/accesso-negato` on the own domain of an agency whose owners can sign in there (E40/F02/US01/T02, NF-141): where the app sends a signed-in person whose read of the
 * portal was refused (403): an account that is no owner at all, an owner whose invitation is not accepted yet, an owner of ANOTHER agency (the server refuses the token of an owner on the domain
 * of an agency they do not belong to). `/app/no-access`, where the CasaZen domain sends them, is «not found» on a host, and the portal that had the way out is gone by then: without this page
 * the person could neither sign out nor come back with another account. It says that the account has no access to this agency, and gives the way out (sign out) and the way back to the site.
 * A visitor who is not signed in has nothing to be refused: the sign-in page of the domain takes them.
 */
export function OwnerHostNoAccessPage() {
  const { t } = useTranslation();
  const { isAuthenticated, isLoading, logout } = useAuth();
  const name = getHostSite()?.displayName ?? '';
  useSeoMeta({ title: t('ownerPortal.noAccess.title'), noindex: true });

  if (!isLoading && !isAuthenticated) return <Navigate to={ownerPortalPaths.signIn} replace />;

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10" data-testid="owner-host-no-access">
      <div className="flex w-full max-w-md flex-col items-center gap-4 text-center">
        <span aria-hidden="true" className="grid size-14 place-items-center rounded-full bg-muted text-foreground">
          <ShieldOff className="size-7" />
        </span>
        <h1 className="public-display text-2xl font-semibold">{t('ownerPortal.noAccess.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('ownerPortal.noAccess.description', { name })}</p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button type="button" className="min-h-11" onClick={() => logout()} data-testid="owner-host-no-access-sign-out">
            <LogOut aria-hidden="true" className="mr-2 size-4" />
            {t('ownerPortal.noAccess.signOut')}
          </Button>
          <Button asChild variant="outline" className="min-h-11">
            <Link to="/" data-testid="owner-host-no-access-home">
              {t('ownerPortal.noAccess.home')}
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
