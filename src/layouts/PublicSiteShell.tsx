import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, Menu } from 'lucide-react';
import { usePublicOrg } from '@/queries/use-public-org';
import { CookieConsentBanner } from '@/components/shared/cookie-consent-banner';
import { PublicOrgNotFoundPage } from '@/features/public-booking/public-org-not-found-page';
import { Footer } from '@/features/public-site/components/Footer';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
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

export function PublicSiteShell({ mode = 'org' }: PublicSiteShellProps) {
  const { t } = useTranslation();
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const location = useLocation();
  const isOrgMode = mode === 'org' && !!orgSlug;
  const { data: org, isLoading, isError } = usePublicOrg(isOrgMode ? orgSlug : undefined);
  const [menuOpen, setMenuOpen] = useState(false);

  const themeId = org?.publicThemeId ?? 'mare';
  const primaryColor = org?.themeColor ?? undefined;
  const showBookingCta = isOrgMode && (location.pathname.includes('/property/') || location.pathname === `/book/${orgSlug}` || location.pathname === `/book/${orgSlug}/`);

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
  const basePath = `/book/${orgSlug}`;

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
          <Link to={isOrgMode ? basePath : '/search'} className="flex min-w-0 items-center">
            {org?.logoUrl ? (
              <img src={org.logoUrl} alt={displayName} className="h-10 w-auto max-w-[200px] object-contain" />
            ) : (
              <span className="public-display truncate text-lg font-semibold">{displayName}</span>
            )}
          </Link>

          {isOrgMode ? (
            <div className="flex items-center gap-2">
              {showBookingCta ? (
                <Button
                  type="button"
                  size="sm"
                  className="public-site-cta border-0"
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
