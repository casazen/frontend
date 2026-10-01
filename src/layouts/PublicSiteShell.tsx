import { useEffect, useState, type CSSProperties } from 'react';
import { Link, Navigate, Outlet, useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, Menu } from 'lucide-react';
import { usePublicOrg } from '@/queries/use-public-org';
import { useCustomHostRedirect } from '@/hooks/use-custom-host-redirect';
import { useOrgSeoMeta } from '@/features/public-site/hooks/use-org-seo-meta';
import { CookieConsentBanner } from '@/components/shared/cookie-consent-banner';
import { PublicOrgNotFoundPage } from '@/features/public-booking/public-org-not-found-page';
import { Footer } from '@/features/public-site/components/Footer';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { normalizeHexColor, resolvePublicSiteTheme } from '@/lib/public-site-themes';
import '@/styles/public-tokens.css';

interface PublicSiteShellProps {
  mode?: 'org' | 'default';
}

function scrollToBookingWidget() {
  const widget = document.getElementById('booking-widget');
  if (widget) {
    widget.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  const mobileCta = document.querySelector<HTMLButtonElement>('[data-testid="mobile-booking-trigger"]');
  if (mobileCta) {
    mobileCta.click();
    return;
  }
  document.getElementById('property-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/** The same `/book/:orgSlug/...` path with the org's current slug (segments after the slug are kept as they are). */
function canonicalOrgPath(pathname: string, slug: string): string {
  const rest = pathname.split('/').slice(3).join('/');
  return `/book/${encodeURIComponent(slug)}${rest ? `/${rest}` : ''}`;
}

export function PublicSiteShell({ mode = 'org' }: PublicSiteShellProps) {
  useCustomHostRedirect();
  const { t } = useTranslation();
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const location = useLocation();
  const isOrgMode = mode === 'org' && !!orgSlug;
  const { data: org, isLoading, isError } = usePublicOrg(isOrgMode ? orgSlug : undefined);
  useOrgSeoMeta(org, location.pathname);
  const [menuOpen, setMenuOpen] = useState(false);

  const themeId = resolvePublicSiteTheme(org?.publicThemeId);
  // Only a valid hex color reaches CSS (BK-12); null keeps the theme's own color.
  const primaryColor = normalizeHexColor(org?.primaryColor ?? org?.themeColor);
  const showBookingCta = isOrgMode && (location.pathname.includes('/property/') || location.pathname === `/book/${orgSlug}` || location.pathname === `/book/${orgSlug}/`);

  // Also on <html> for the content rendered in portals (menu sheet), outside .public-site-root.
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
    // A previous slug of the org (PL-04): the backend still resolves it, the address bar moves to the current one.
    if (org.slug && org.slug !== orgSlug) {
      return <Navigate to={canonicalOrgPath(location.pathname, org.slug) + location.search + location.hash} replace />;
    }
  }

  const displayName = org?.displayName ?? 'CasaZen';
  const basePath = `/book/${orgSlug}`;

  return (
    <div
      className="public-site-root flex min-h-screen flex-col"
      data-theme={themeId}
      // On the root itself: the [data-theme] tokens are declared on this element and would override a value
      // inherited from <html> (A3-17).
      style={primaryColor ? ({ '--cz-public-primary': primaryColor } as CSSProperties) : undefined}
      data-testid="public-site-shell"
    >
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
        {t('publicSite.skipToContent')}
      </a>

      <header className="border-b border-black/10 bg-[var(--cz-public-surface)]">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-2 px-3 py-3 md:gap-4 md:px-4 md:py-4">
          <Link to={isOrgMode ? basePath : '/search'} className="flex min-w-0 flex-1 items-center">
            {org?.logoUrl ? (
              <img src={org.logoUrl} alt={displayName} className="h-9 w-auto max-w-[160px] object-contain md:h-10 md:max-w-[200px]" />
            ) : (
              <span className="public-display truncate text-base font-semibold md:text-lg">{displayName}</span>
            )}
          </Link>

          {isOrgMode ? (
            <div className="flex shrink-0 items-center gap-1 md:gap-2">
              {showBookingCta ? (
                <Button
                  type="button"
                  size="sm"
                  className="public-site-cta hidden border-0 md:inline-flex"
                  onClick={scrollToBookingWidget}
                  data-testid="header-booking-cta"
                >
                  {t('publicSite.mobileBookingCta')}
                </Button>
              ) : null}
              <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                <SheetTrigger className="rounded-md p-2 hover:bg-black/5" aria-label={t('publicSite.openMenu')}>
                  <Menu className="h-6 w-6" />
                </SheetTrigger>
                <SheetContent side="right" className="w-72">
                  <nav className="mt-8 flex flex-col gap-2 text-base" onClick={() => setMenuOpen(false)}>
                    <Link
                      to={`${basePath}/my-bookings`}
                      className="block py-2 hover:text-[var(--cz-public-primary)]"
                      data-testid="public-nav-my-bookings"
                    >
                      {t('publicSite.navMyBookings')}
                    </Link>
                  </nav>
                </SheetContent>
              </Sheet>
            </div>
          ) : (
            <Link to="/search" className="text-sm underline hover:text-[var(--cz-public-primary)]">
              {t('publicSite.explore')}
            </Link>
          )}
        </div>
      </header>

      <main id="main-content" className="mx-auto w-full max-w-[1200px] flex-1 px-3 py-6 pb-24 md:px-4 md:py-8 md:pb-8">
        {isOrgMode ? <Outlet context={{ org }} /> : <Outlet />}
      </main>

      <Footer
        displayName={isOrgMode ? org?.displayName : 'CasaZen'}
        contactEmail={org?.contactEmail}
        showPoweredBy={org?.showPoweredBy ?? !isOrgMode}
        showSeoHubLink={!isOrgMode}
      />

      {isOrgMode ? <CookieConsentBanner /> : null}
    </div>
  );
}
