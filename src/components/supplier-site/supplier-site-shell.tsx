import { useMemo } from 'react';
import { Outlet, useMatch, useParams, useSearchParams } from 'react-router-dom';
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
import { StickyBookBar } from './sticky-book-bar';
import { isFramedPreview, usePreviewDraft } from './use-preview-draft';

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

  // The preview of the editor (`?anteprima=1&frame=1`, in a frame of the same origin): the page draws the draft the editor sends
  // instead of the published content, shows the paused showcase as it will be, and does not ask about cookies.
  const [search] = useSearchParams();
  const preview = isFramedPreview(search);
  const draft = usePreviewDraft(preview);
  const showcase = useMemo<SupplierShowcaseDto | undefined>(
    () => (data && preview ? { ...data, paused: false, content: draft ?? data.content } : data),
    [data, preview, draft],
  );

  const model = useMemo(() => (showcase ? buildSiteModel(showcase) : null), [showcase]);
  const context = useMemo<SupplierSiteContextValue | null>(
    () => (showcase && model ? { slug, showcase, model } : null),
    [slug, showcase, model],
  );
  const notFound = isError && isAxiosError(error) && error.response?.status === 404;

  // The title and the description of the page it is on: the home, the list of services, one service, the story.
  const onServices = useMatch({ path: `${SUPPLIER_SHOWCASE_BASE_PATH}/:slug/servizi`, end: true }) !== null;
  const onService = useMatch({ path: `${SUPPLIER_SHOWCASE_BASE_PATH}/:slug/servizi/:serviceSlug`, end: true });
  const onAbout = useMatch({ path: `${SUPPLIER_SHOWCASE_BASE_PATH}/:slug/chi-siamo`, end: true }) !== null;
  let title = t('supplierShowcase.title');
  let description: string | undefined;
  if (model) {
    const name = model.name;
    title = t('supplierShowcase.pageTitle', { name });
    description = model.intro ? truncateDescription(model.intro) : t('supplierShowcase.pageDescription', { name });
    const service = onService ? model.services?.find((candidate) => candidate.slug === onService.params.serviceSlug) : undefined;
    if (onServices) {
      title = t('supplierSite.meta.services', { name });
      description = t('supplierSite.meta.servicesDescription', { name });
    } else if (service) {
      title = t('supplierSite.meta.service', { service: service.name, name });
      description = service.summary ? truncateDescription(service.summary) : t('supplierSite.meta.serviceDescription', { service: service.name, name });
    } else if (onAbout) {
      title = t('supplierSite.meta.about', { name });
      description = model.bio ? truncateDescription(model.bio) : t('supplierSite.meta.aboutDescription', { name });
    }
  }

  // Indexable as it always was; `noindex` only for a showcase that does not exist or fails to load, and for the preview of a draft.
  // No canonical, no Open Graph, no structured data (decision D11).
  useSeoMeta({ title, description, noindex: isError || preview });

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
  // On a phone the one action stays at hand once the cover is out of sight: on the home, while the bookings are open.
  const hasBar = onHome && model.bookingsOpen && !preview;

  return (
    <SupplierSiteContext.Provider value={context}>
      <div
        className="vz"
        {...siteThemeProps(model.style, model.font, model.buttonColor)}
        data-has-bar={hasBar ? '' : undefined}
        data-testid="supplier-site"
      >
        <a href="#vz-main" className="vz-skip">
          {t('publicSite.skipToContent')}
        </a>
        <SiteHeader model={model} variant={variant} onHome={onHome && !model.paused} />
        {online ? null : <OfflineBar />}
        <main id="vz-main" className="vz-main" tabIndex={-1}>
          {model.paused ? <SitePaused model={model} /> : <Outlet />}
        </main>
        <SiteFooter model={model} />
        {hasBar ? <StickyBookBar model={model} /> : null}
        {preview ? null : <CookieConsentBanner />}
      </div>
    </SupplierSiteContext.Provider>
  );
}
