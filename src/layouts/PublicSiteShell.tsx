import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, Menu } from 'lucide-react';
import { usePublicOrg } from '@/queries/use-public-org';
import { CookieConsentBanner } from '@/components/shared/cookie-consent-banner';
import { PublicOrgNotFoundPage } from '@/features/public-booking/public-org-not-found-page';
import { Footer } from '@/features/public-site/components/Footer';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import '@/styles/public-tokens.css';

interface PublicSiteShellProps {
  mode?: 'org' | 'default';
}

export function PublicSiteShell({ mode = 'org' }: PublicSiteShellProps) {
  const { t } = useTranslation();
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const isOrgMode = mode === 'org' && !!orgSlug;
  const { data: org, isLoading, isError } = usePublicOrg(isOrgMode ? orgSlug : undefined);
  const [menuOpen, setMenuOpen] = useState(false);

  const themeId = org?.publicThemeId ?? 'mare';
  const primaryColor = org?.themeColor ?? undefined;

  useEffect(() => {
    const root = document.documentElement;
    if (primaryColor) {
      root.style.setProperty('--cz-public-primary', primaryColor);
    }
    return () => {
      root.style.removeProperty('--cz-public-primary');
    };
  }, [primaryColor]);

  if (isOrgMode) {
    if (isLoading) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      );
    }
    if (isError || !org) return <PublicOrgNotFoundPage />;
  }

  const displayName = org?.displayName ?? 'CasaZen';
  const navLinks = isOrgMode && orgSlug ? (
    <>
      <NavLink to={`/book/${orgSlug}`} className={({ isActive }) => `block py-2 ${isActive ? 'font-semibold text-[var(--cz-public-primary)]' : ''}`}>
        {t('publicSite.navProperties')}
      </NavLink>
      <NavLink to={`/book/${orgSlug}/my-bookings`} className={({ isActive }) => `block py-2 ${isActive ? 'font-semibold text-[var(--cz-public-primary)]' : ''}`}>
        {t('publicSite.navMyBookings')}
      </NavLink>
    </>
  ) : null;

  return (
    <div
      className="public-site-root flex min-h-screen flex-col"
      data-theme={themeId}
      data-testid="public-site-shell"
    >
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
        {t('publicSite.skipToContent')}
      </a>

      <header className="border-b border-black/10 bg-[var(--cz-public-surface)]">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            {org?.logoUrl ? (
              <img src={org.logoUrl} alt={displayName} className="h-10 w-auto object-contain" />
            ) : (
              <span className="public-display text-lg font-semibold">CasaZen</span>
            )}
            <span className="public-display text-lg font-medium">{displayName}</span>
          </div>

          {isOrgMode ? (
            <>
              <nav className="hidden items-center gap-6 text-sm md:flex">{navLinks}</nav>
              <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                <SheetTrigger className="md:hidden" aria-label={t('publicSite.openMenu')}>
                  <Menu className="h-6 w-6" />
                </SheetTrigger>
                <SheetContent side="right" className="w-72">
                  <nav className="mt-8 flex flex-col gap-2 text-base" onClick={() => setMenuOpen(false)}>
                    {navLinks}
                  </nav>
                </SheetContent>
              </Sheet>
            </>
          ) : (
            <Link to="/search" className="text-sm underline hover:text-[var(--cz-public-primary)]">
              {t('publicSite.explore')}
            </Link>
          )}
        </div>
      </header>

      <main id="main-content" className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-8 pb-24 md:pb-8">
        {isOrgMode ? <Outlet context={{ org }} /> : <Outlet />}
      </main>

      <Footer
        displayName={isOrgMode ? org?.displayName : 'CasaZen'}
        contactEmail={org?.contactEmail}
        showPoweredBy={org?.showPoweredBy ?? !isOrgMode}
      />

      {isOrgMode ? <CookieConsentBanner /> : null}
    </div>
  );
}
