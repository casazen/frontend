import { useEffect } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { getPublicSiteOrigin } from '@/config/public-site';
import { getHostSite } from '@/lib/host-site';
import { useSeoMeta } from '@/lib/seo-meta';

/** What the start-up shows while it is still asking the backend which site the host serves, or why it cannot show one. */
export type HostBootstrapState = 'loading' | 'not-found' | 'error';

/**
 * Full-page state of an org's own host before the app starts (BK-16): loading, "no site here" (an unknown domain, a custom
 * domain waiting for its verification or no longer paid for) or "could not check" (network or server error, with a retry:
 * an outage is never shown as "the site does not exist"). Never indexed.
 */
export function HostSiteBootstrapPage({ state, onRetry }: { state: HostBootstrapState; onRetry?: () => void }) {
  const { t } = useTranslation();
  useSeoMeta({ title: t(state === 'error' ? 'hostSite.error.title' : 'hostSite.notFound.title'), noindex: true });

  if (state === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center" role="status" aria-label={t('hostSite.loading')} data-testid="host-site-loading">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const platformOrigin = getPublicSiteOrigin();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center" data-testid={`host-site-${state}`}>
      <h1 className="text-2xl font-semibold">{t(state === 'error' ? 'hostSite.error.title' : 'hostSite.notFound.title')}</h1>
      <p className="max-w-md text-muted-foreground">
        {t(state === 'error' ? 'hostSite.error.description' : 'hostSite.notFound.description')}
      </p>
      {state === 'error' && onRetry ? (
        <Button type="button" onClick={onRetry}>
          {t('hostSite.error.retry')}
        </Button>
      ) : null}
      {state === 'not-found' && platformOrigin ? (
        <Button asChild variant="outline">
          <a href={platformOrigin}>{t('hostSite.platformLink')}</a>
        </Button>
      ) : null}
    </main>
  );
}

/** A page of an org's own host that does not exist (inside the router): offers the way back to the site's landing page. */
export function HostSiteNotFoundPage() {
  const { t } = useTranslation();
  useSeoMeta({ title: t('hostSite.pageNotFound.title'), noindex: true });

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center" data-testid="host-site-page-not-found">
      <p className="text-sm font-semibold text-primary">404</p>
      <h1 className="text-2xl font-semibold">{t('hostSite.pageNotFound.title')}</h1>
      <p className="max-w-md text-muted-foreground">{t('hostSite.pageNotFound.description')}</p>
      <Button asChild>
        <Link to="/">{t('hostSite.pageNotFound.home')}</Link>
      </Button>
    </main>
  );
}

/**
 * An org's own host only ever shows its own org (BK-16, A3-08): `/book/:orgSlug` of another org, reached by typing or
 * following a link on this domain, is "not found" here, so a domain can never be made to show another host's site under
 * its name.
 */
export function HostOrgGuard({ children }: { children: ReactNode }) {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const hostSite = getHostSite();

  return hostSite && orgSlug === hostSite.slug ? <>{children}</> : <HostSiteNotFoundPage />;
}

/**
 * The legal documents are CasaZen's, not the host's: they live on the public web app (`VITE_PUBLIC_SITE_URL`). The footer of
 * an org's own site links them by their path; on its host they lead there. Without the variable nothing is shown (decision
 * D3: no default domain).
 */
export function HostLegalRedirect() {
  const { pathname, search } = useLocation();
  const origin = getPublicSiteOrigin();

  useEffect(() => {
    if (origin) window.location.replace(`${origin}${pathname}${search}`);
  }, [origin, pathname, search]);

  return origin ? <HostSiteBootstrapPage state="loading" /> : <HostSiteNotFoundPage />;
}
