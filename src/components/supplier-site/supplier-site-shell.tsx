import { useMemo } from 'react';
import { Outlet, useMatch, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { publicSupplierApi, type SupplierShowcaseDto } from '@/api/public-supplier.api';
import { CookieConsentBanner } from '@/components/shared/cookie-consent-banner';
import { SUPPLIER_SHOWCASE_BASE_PATH } from '@/features/supplier/lib/showcase-paths';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { useSeoMeta, truncateDescription } from '@/lib/seo-meta';
import { buildSiteModel } from '@/lib/supplier-site/site-model';
import { siteThemeProps } from '@/lib/supplier-site/style-config';
import '@/styles/supplier-site.css';
import { SupplierSiteContext, type SupplierSiteContextValue } from './site-context';
import { SiteFooter } from './site-footer';
import { SiteHeader } from './site-header';
import { OfflineBar, SiteLoadError, SiteNotFound, SitePaused, SiteSkeleton, StateFrame } from './site-states';

/** The cache of the slots of the backend is 30 seconds: reading the page again sooner would tell nothing new. */
const SHOWCASE_STALE_MS = 30_000;

/**
 * The frame of a supplier's public site, `/fornitori/:slug` and what hangs from it (SP-09-FE): it reads the showcase once, decides the
 * model of the site from it, wears the style, the typeface and the color the supplier chose, and puts the pages (its children) between
 * the header and the footer. It does not use `PublicSiteShell`: that one is the frame of the booking sites of the hosts. The states live
 * here too: loading, a showcase that does not exist (one answer for an unknown slug, a supplier that is not active and one that is
 * suspended), an error with a retry, a paused showcase and no network.
 */
export function SupplierSiteShell() {
  const { t } = useTranslation();
  const { slug = '' } = useParams<{ slug: string }>();
  const onHome = useMatch({ path: `${SUPPLIER_SHOWCASE_BASE_PATH}/:slug`, end: true }) !== null;
  const online = useOnlineStatus();

  const { data, isLoading, isError, error, refetch } = useQuery<SupplierShowcaseDto>({
    queryKey: ['supplier-showcase', slug],
    queryFn: () => publicSupplierApi.getShowcase(slug),
    enabled: !!slug,
    staleTime: SHOWCASE_STALE_MS,
  });

  const model = useMemo(() => (data ? buildSiteModel(data) : null), [data]);
  const context = useMemo<SupplierSiteContextValue | null>(
    () => (data && model ? { slug, showcase: data, model } : null),
    [slug, data, model],
  );
  const notFound = isError && isAxiosError(error) && error.response?.status === 404;

  // Indexable as it always was; `noindex` only for a showcase that does not exist or fails to load. No canonical, no Open Graph, no
  // structured data (decision D11).
  useSeoMeta({
    title: model ? t('supplierShowcase.pageTitle', { name: model.name }) : t('supplierShowcase.title'),
    description: model ? (model.intro ? truncateDescription(model.intro) : t('supplierShowcase.pageDescription', { name: model.name })) : undefined,
    noindex: isError,
  });

  if (!slug || isLoading) {
    return (
      <StateFrame>
        <SiteSkeleton />
      </StateFrame>
    );
  }

  if (notFound) {
    return (
      <StateFrame>
        <SiteNotFound />
      </StateFrame>
    );
  }

  if (isError || !context || !model) {
    return (
      <StateFrame>
        <SiteLoadError onRetry={() => void refetch()} />
      </StateFrame>
    );
  }

  // The header floats over a full-width cover on the home; everywhere else it is solid.
  const variant = onHome && model.hero === 'full' && !model.paused ? 'over' : 'solid';

  return (
    <SupplierSiteContext.Provider value={context}>
      <div className="vz" {...siteThemeProps(model.style, model.font, model.buttonColor)} data-testid="supplier-site">
        <a href="#vz-main" className="vz-skip">
          {t('publicSite.skipToContent')}
        </a>
        <SiteHeader model={model} variant={variant} onHome={onHome && !model.paused} />
        {online ? null : <OfflineBar />}
        <main id="vz-main" className="vz-main" tabIndex={-1}>
          {model.paused ? <SitePaused model={model} /> : <Outlet />}
        </main>
        <SiteFooter model={model} />
        <CookieConsentBanner />
      </div>
    </SupplierSiteContext.Provider>
  );
}
