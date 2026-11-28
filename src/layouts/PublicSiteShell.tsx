import { useEffect, useMemo, type CSSProperties, type ReactNode } from 'react';
import { Navigate, Outlet, useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { isAxiosError } from 'axios';
import { useOrgProperties, usePublicOrg } from '@/queries/use-public-org';
import { useOrgSeoMeta } from '@/features/public-site/hooks/use-org-seo-meta';
import { useSiteLanguage } from '@/features/public-site/hooks/use-site-language';
import { CookieConsentBanner } from '@/components/shared/cookie-consent-banner';
import { HostTracking } from '@/features/host-tracking/host-tracking';
import { PublicOrgNotFoundPage } from '@/features/public-booking/public-org-not-found-page';
import { PublicOrgErrorPage } from '@/features/public-booking/public-org-error-page';
import { Footer } from '@/features/public-site/components/Footer';
import { BrandHeader } from '@/features/public-site/components/brand-header';
import { OfflineBar } from '@/features/public-site/components/offline-bar';
import { SiteHeader } from '@/features/public-site/components/site-header';
import { SiteAppearanceProvider } from '@/features/public-site/site-appearance';
import type { SiteAppearance } from '@/features/public-site/site-appearance-context';
import { publicSiteColorVars } from '@/lib/public-site-colors';
import { normalizeHexColor, resolvePublicSiteFont, resolvePublicSiteTheme } from '@/lib/public-site-themes';
import '@/styles/public-tokens.css';
import '@/styles/public-brand.css';

interface PublicSiteShellProps {
  mode?: 'org' | 'default';
}

function canonicalOrgPath(pathname: string, slug: string): string {
  if (pathname.startsWith('/s/action/org/')) {
    return pathname.replace(/^\/s\/action\/org\/[^/]+/, () => `/s/action/org/${encodeURIComponent(slug)}`);
  }
  const rest = pathname.split('/').slice(3).join('/');
  return `/book/${encodeURIComponent(slug)}${rest ? `/${rest}` : ''}`;
}

type SiteState = 'ready' | 'loading' | 'error' | 'not-found';

function SiteSkeleton() {
  const { t } = useTranslation();
  const block = 'animate-pulse bg-black/5 motion-reduce:animate-none';

  return (
    <div role="status" aria-busy="true" data-testid="public-site-loading" className="space-y-8">
      <span className="sr-only">{t('publicSite.loading')}</span>
      <div aria-hidden className="-mx-3 overflow-hidden sm:mx-0 sm:rounded-[var(--cz-public-radius)]">
        <div className={`${block} aspect-[16/9] max-h-[420px] min-h-[220px] w-full`} />
      </div>
      <div aria-hidden className="space-y-6">
        <div className={`${block} h-7 w-48 rounded bg-black/10`} />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((key) => (
            <div key={key} className="public-site-card overflow-hidden">
              <div className={`${block} aspect-[4/3]`} />
              <div className="space-y-3 p-4">
                <div className={`${block} h-5 w-2/3 rounded bg-black/10`} />
                <div className={`${block} h-4 w-1/3 rounded`} />
                <div className={`${block} h-4 w-full rounded`} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const SKIP_LINK_CLASS =
  'sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-[var(--cz-public-radius)] focus:bg-[var(--cz-public-surface)] focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-[var(--cz-public-text)] focus:shadow-[var(--cz-public-shadow-widget)]';

export function PublicSiteShell({ mode = 'org' }: PublicSiteShellProps) {
  const { t } = useTranslation();
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const location = useLocation();
  const isOrgMode = mode === 'org' && !!orgSlug;
  const { data: org, isLoading, isError, error, refetch } = usePublicOrg(isOrgMode ? orgSlug : undefined);
  useOrgSeoMeta(org, location.pathname);
  const { data: properties } = useOrgProperties(isOrgMode && org ? orgSlug : undefined);
  useSiteLanguage(isOrgMode);

  const themeId = resolvePublicSiteTheme(org?.publicThemeId);
  const fontId = resolvePublicSiteFont(org?.publicFontId);
  // Only a valid hex color reaches CSS (BK-12); null keeps the theme's own color. The text color on it and the
  // readable variant of it are derived so that any host color meets AA (BK-13).
  const colorVars = publicSiteColorVars(normalizeHexColor(org?.primaryColor ?? org?.themeColor), themeId);
  const colorStyle = colorVars as CSSProperties | null;
  const isLanding = location.pathname === `/book/${orgSlug}` || location.pathname === `/book/${orgSlug}/`;
  const isPropertyPage = location.pathname.includes('/property/') && !/\/checkout\/?$/.test(location.pathname);
  const showBookingCta = isOrgMode && (isLanding || isPropertyPage);

  const colorVarsKey = colorVars ? JSON.stringify(colorVars) : '';
  const appearance = useMemo<SiteAppearance>(
    () => ({
      themeId,
      fontId,
      colorStyle: colorVarsKey ? (JSON.parse(colorVarsKey) as CSSProperties) : undefined,
      brand: isOrgMode ? undefined : 'casazen',
    }),
    [themeId, fontId, colorVarsKey, isOrgMode],
  );
  useEffect(() => {
    const root = document.documentElement;
    const vars: Record<string, string> = colorVarsKey ? JSON.parse(colorVarsKey) : {};
    for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
    return () => {
      for (const name of Object.keys(vars)) root.style.removeProperty(name);
    };
  }, [colorVarsKey]);

  useEffect(() => {
    if (!isOrgMode) return;
    const root = document.documentElement;
    const previous = root.style.scrollPaddingTop;
    root.style.scrollPaddingTop = 'var(--header-height)';
    return () => {
      root.style.scrollPaddingTop = previous;
    };
  }, [isOrgMode]);

  let state: SiteState = 'ready';
  if (isOrgMode) {
    if (isLoading) {
      state = 'loading';
    } else if (isError && !(isAxiosError(error) && error.response?.status === 404)) {
      // Only a 404 means "no such site": any other failure (500, network) is an error with a retry, not a missing org.
      state = 'error';
    } else if (isError || !org) {
      state = 'not-found';
    } else if (org.slug && org.slug !== orgSlug) {
      return <Navigate to={canonicalOrgPath(location.pathname, org.slug) + location.search + location.hash} replace />;
    }
  }

  const basePath = `/book/${orgSlug}`;

  let content: ReactNode;
  if (state === 'loading') content = <SiteSkeleton />;
  else if (state === 'error') content = <PublicOrgErrorPage onRetry={() => void refetch()} />;
  else if (state === 'not-found') content = <PublicOrgNotFoundPage />;
  else content = isOrgMode ? <Outlet context={{ org }} /> : <Outlet />;

  return (
    <SiteAppearanceProvider value={appearance}>
      <div
        className="public-site-root flex min-h-screen flex-col"
        data-theme={themeId}
        data-font={fontId ?? undefined}
        data-brand={isOrgMode ? undefined : 'casazen'}
        style={colorStyle ?? undefined}
        data-testid="public-site-shell"
      >
        <a href="#main-content" className={SKIP_LINK_CLASS}>
          {t('publicSite.skipToContent')}
        </a>

        {isOrgMode ? (
          <SiteHeader
            org={org}
            loading={state === 'loading'}
            basePath={basePath}
            showBookingCta={showBookingCta}
            themeId={themeId}
            fontId={fontId}
            colorStyle={colorStyle ?? undefined}
          />
        ) : (
          <BrandHeader />
        )}

        <OfflineBar />

        <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-[1200px] flex-1 px-3 py-6 pb-24 outline-none md:px-4 md:py-8 md:pb-8">
          {content}
        </main>

        {state === 'loading' ? null : (
          <>
            <Footer
              displayName={isOrgMode ? (org?.displayName ?? 'CasaZen') : 'CasaZen'}
              contactEmail={org?.contactEmail}
              tagline={org?.tagline}
              operator={org?.operator}
              showPoweredBy={org?.showPoweredBy ?? !isOrgMode}
              showSeoHubLink={!isOrgMode}
              orgSlug={isOrgMode && org ? (org.slug ?? orgSlug) : undefined}
              hostName={org?.hostName}
              phone={org?.publicPhone}
              acceptsBookings={org?.acceptsBookings}
              properties={isOrgMode ? properties : undefined}
            />
            <CookieConsentBanner />
            {isOrgMode ? <HostTracking /> : null}
          </>
        )}
      </div>
    </SiteAppearanceProvider>
  );
}
