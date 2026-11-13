import { useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { LogOut } from 'lucide-react';
import { SkipLink } from '@/components/layout/skip-link';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { useSeoMeta } from '@/lib/seo-meta';
import { clearOwnerPortalCache, useCanManageOwnerContacts } from '@/queries/ownerPortal';
import { ownerPortalPaths } from './paths';

const MAIN_ID = 'owner-portal-main';

/** At least 44 px high on every device, whatever the pointer: the product rule for a touch target, kept here as a class and not left to a media query. */
const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'inline-flex min-h-11 items-center rounded-md px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    isActive ? 'bg-primary text-primary-foreground' : 'text-foreground/80 hover:bg-muted',
  );

/**
 * The shell of the owner portal (E07/F07/US01/T03, NF-111, ADR-011): one header with the places of the portal, then the page. It is not the console of an agency (no
 * organisation menu, no host area) and it has nothing fixed to the screen that could sit on a button on a phone: the navigation is part of the page and wraps.
 * When the person leaves the portal, or signs out, everything the portal read is dropped from the cache.
 */
export function OwnerPortalShell() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { logout } = useAuth();
  const canManageContacts = useCanManageOwnerContacts();
  useSeoMeta({ title: t('ownerPortal.shell.pageTitle'), noindex: true });

  useEffect(() => () => clearOwnerPortalCache(queryClient), [queryClient]);

  const signOut = () => {
    clearOwnerPortalCache(queryClient);
    logout();
  };

  return (
    <div className="min-h-screen bg-background">
      <SkipLink targetId={MAIN_ID} />
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl min-w-0 flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <p className="min-w-0 break-words text-lg font-semibold text-[#1f3a3d]">{t('ownerPortal.shell.title')}</p>
          {/* The places of the portal and the way out are one row that wraps: the same order for the eye and for the keyboard, nothing fixed to the screen. */}
          <nav aria-label={t('ownerPortal.shell.nav.label')} className="flex min-w-0 flex-wrap items-center gap-1" data-testid="owner-nav">
            <NavLink to={ownerPortalPaths.home} end className={linkClass}>
              {t('ownerPortal.shell.nav.home')}
            </NavLink>
            <NavLink to={ownerPortalPaths.calendar()} className={linkClass}>
              {t('ownerPortal.shell.nav.calendar')}
            </NavLink>
            <NavLink to={ownerPortalPaths.accounting} className={linkClass}>
              {t('ownerPortal.shell.nav.accounting')}
            </NavLink>
            <NavLink to={ownerPortalPaths.documents} className={linkClass}>
              {t('ownerPortal.shell.nav.documents')}
            </NavLink>
            <NavLink to={ownerPortalPaths.messages} className={linkClass}>
              {t('ownerPortal.shell.nav.messages')}
            </NavLink>
            {canManageContacts ? (
              <NavLink to={ownerPortalPaths.contacts} className={linkClass}>
                {t('ownerPortal.shell.nav.contacts')}
              </NavLink>
            ) : null}
            <Button type="button" variant="outline" className="min-h-11 shrink-0 md:ml-2" onClick={signOut} data-testid="owner-sign-out">
              <LogOut aria-hidden="true" className="size-4" />
              {t('ownerPortal.shell.signOut')}
            </Button>
          </nav>
        </div>
      </header>
      <main id={MAIN_ID} tabIndex={-1} className="mx-auto min-w-0 max-w-5xl px-4 py-6 focus:outline-none">
        <Outlet />
      </main>
    </div>
  );
}
