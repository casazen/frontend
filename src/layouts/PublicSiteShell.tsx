import { useEffect, useMemo, type CSSProperties, type ReactNode } from 'react';
import { Navigate, Outlet, useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { isAxiosError } from 'axios';
import { usePublicOrg } from '@/queries/use-public-org';
import { useOrgSeoMeta } from '@/features/public-site/hooks/use-org-seo-meta';
import { CookieConsentBanner } from '@/components/shared/cookie-consent-banner';
import { PublicOrgNotFoundPage } from '@/features/public-booking/public-org-not-found-page';
import { PublicOrgErrorPage } from '@/features/public-booking/public-org-error-page';
import { Footer } from '@/features/public-site/components/Footer';
import { BrandHeader } from '@/features/public-site/components/brand-header';
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

/** The same `/book/:orgSlug/...` path with the org's current slug (segments after the slug are kept as they are). */
function canonicalOrgPath(pathname: string, slug: string): string {
  const rest = pathname.split('/').slice(3).join('/');
  return `/book/${encodeURIComponent(slug)}${rest ? `/${rest}` : ''}`;
}

/** What the booking site is showing: its page, or the state that takes the place of it. */
type SiteState = 'ready' | 'loading' | 'error' | 'not-found';

/** Shown while the org is read: the shapes of the landing page (cover, title, cards), so the page does not jump. */
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

/** The skip link: out of sight until the keyboard reaches it, then a clear button on the theme of the page. */
const SKIP_LINK_CLASS =
  'sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-[var(--cz-public-radius)] focus:bg-[var(--cz-public-surface)] focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-[var(--cz-public-text)] focus:shadow-[var(--cz-public-shadow-widget)]';

export function PublicSiteShell({ mode = 'org' }: PublicSiteShellProps) {
  const { t } = useTranslation();
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const location = useLocation();
  const isOrgMode = mode === 'org' && !!orgSlug;
  const { data: org, isLoading, isError, error, refetch } = usePublicOrg(isOrgMode ? orgSlug : undefined);
  useOrgSeoMeta(org, location.pathname);

  const themeId = resolvePublicSiteTheme(org?.publicThemeId);
  // The font pair the host chose; null = the one its theme starts with (the theme block of the CSS sets it).
  const fontId = resolvePublicSiteFont(org?.publicFontId);
  // Only a valid hex color reaches CSS (BK-12); null keeps the theme's own color. The text color on it and the
  // readable variant of it are derived so that any host color meets AA (BK-13).
  const colorVars = publicSiteColorVars(normalizeHexColor(org?.primaryColor ?? org?.themeColor), themeId);
  const colorStyle = colorVars as CSSProperties | null;
  // The call to action of the header is where there is something to check: the landing and the page of a property (not
  // its checkout, where the dates are already chosen).
  const isLanding = location.pathname === `/book/${orgSlug}` || location.pathname === `/book/${orgSlug}/`;
  const isPropertyPage = location.pathname.includes('/property/') && !/\/checkout\/?$/.test(location.pathname);
  const showBookingCta = isOrgMode && (isLanding || isPropertyPage);

  // Also on <html> for the content rendered in portals (dialogs), outside .public-site-root.
  const colorVarsKey = colorVars ? JSON.stringify(colorVars) : '';
  // What a portal needs to wear the look of the site (DB-20): the pickers and sheets read it, `usePortalRootProps`.
  const appearance = useMemo<SiteAppearance>(
    () => ({
      themeId,
      fontId,
      colorStyle: colorVarsKey ? (JSON.parse(colorVarsKey) as CSSProperties) : undefined,
    }),
    [themeId, fontId, colorVarsKey],
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
    // The header of the booking site is sticky: an anchor, a focused element or the booking widget that the call to action
    // scrolls to must not land under it (as the shell of the app does, `--header-height`).
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
      // A previous slug of the org (PL-04): the backend still resolves it, the address bar moves to the current one.
      return <Navigate to={canonicalOrgPath(location.pathname, org.slug) + location.search + location.hash} replace />;
    }
  }

  const basePath = `/book/${orgSlug}`;

  // The states are inside the frame of the site, in the theme of the host (the default theme when there is no host to read
  // it from: the site does not exist, or could not be read).
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
        // CasaZen's own pages (search, guides, legal, supplier showcase) have the brand's look; an org's booking site keeps
        // the theme and color its host chose (public-brand.css).
        data-brand={isOrgMode ? undefined : 'casazen'}
        // On the root itself: the [data-theme] tokens are declared on this element and would override a value
        // inherited from <html> (A3-17). Color, text on it and readable variant (BK-13).
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
            />
            <CookieConsentBanner />
          </>
        )}
      </div>
    </SiteAppearanceProvider>
  );
}
