import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogOut, ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { getHostSite } from '@/lib/host-site';
import { useSeoMeta } from '@/lib/seo-meta';
import { ownerPortalPaths } from './paths';

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
