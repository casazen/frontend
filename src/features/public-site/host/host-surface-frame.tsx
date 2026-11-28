import { useLayoutEffect } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CasaZenMark } from '@/components/brand/casazen-mark';
import { getHostSite } from '@/lib/host-site';
import { publicSiteColorStyle } from '@/lib/public-site-colors';
import { resolvePublicSiteFont, resolvePublicSiteTheme } from '@/lib/public-site-themes';
import { applySeoMeta } from '@/lib/seo-meta';
import '@/styles/public-tokens.css';
import '@/styles/public-brand.css';

/**
 * The frame of the pages an agency's own domain serves besides its booking site: the guest check-in and the owner portal (NF-140). It is the layout route
 * of those pages in `buildHostSiteRoutes`, so the pages inside keep their own content and only gain the agency around them: its logo and name at the top (a link to
 * `/`, the landing page of the site), its theme, font and colour on the root (the same tables and the same derivation of AA colours as the booking site, so any colour
 * an agency picks reads well), and, only when `branding.showPoweredBy` says so, the line «powered by CasaZen».
 *
 * Everything shown comes from the answer of `resolve-host` that the start-up already holds (`getHostSite`): nothing is asked of the server and nothing is read from the browser's
 * storage here. The agency's texts are only ever text nodes of React, never HTML. The pages are private (a token in the address, a person's own data): the frame marks the document
 * `noindex,nofollow` BEFORE the page inside sets its own title (a layout effect runs before the effects of the children), so the title of the page wins and the robots tag stays.
 *
 * The bar at the top is not a `<header>`: the pages inside have their own (the owner portal has one), and a page keeps one banner.
 */
export function HostSurfaceFrame() {
  const { t } = useTranslation();
  const site = getHostSite();
  const branding = site?.branding;
  const displayName = branding?.displayName ?? site?.displayName ?? '';
  const themeId = resolvePublicSiteTheme(branding?.themeId);
  const fontId = resolvePublicSiteFont(branding?.fontId);
  const colorStyle = publicSiteColorStyle(branding?.primaryColor, themeId);
  const logoUrl = branding?.logoUrl ?? null;
  const initial = Array.from(displayName.trim())[0]?.toLocaleUpperCase() ?? '';

  useLayoutEffect(() => {
    if (!displayName) return;
    return applySeoMeta({ title: displayName, noindex: true });
  }, [displayName]);

  return (
    <div
      className="public-site-root flex min-h-screen flex-col"
      data-theme={themeId}
      data-font={fontId ?? undefined}
      style={colorStyle}
      data-testid="host-surface-frame"
    >
      <div className="border-b bg-[var(--cz-public-surface)]" data-testid="host-surface-frame-bar">
        <div className="mx-auto flex min-h-[var(--header-height)] max-w-[1200px] items-center px-3 md:px-4">
          <Link
            to="/"
            className="flex min-h-11 min-w-0 items-center gap-2.5 rounded-[var(--cz-public-radius)] py-1.5"
            data-testid="host-surface-frame-home"
          >
            {logoUrl ? (
              <img src={logoUrl} alt="" className="h-9 w-auto max-w-[160px] shrink-0 object-contain md:h-10 md:max-w-[200px]" />
            ) : initial ? (
              <span
                aria-hidden
                className="public-display grid h-9 w-9 shrink-0 place-items-center rounded-[var(--cz-public-radius)] bg-[var(--cz-public-primary)] text-base text-[var(--cz-public-on-primary)]"
              >
                {initial}
              </span>
            ) : null}
            <span className="public-display truncate text-base font-semibold md:text-lg">{displayName}</span>
          </Link>
        </div>
      </div>

      <div className="flex flex-1 flex-col">
        <Outlet />
      </div>

      {branding?.showPoweredBy ? (
        <footer className="border-t" data-testid="host-surface-frame-powered-by">
          <div className="mx-auto flex max-w-[1200px] px-3 py-4 text-xs text-[var(--cz-public-muted)] md:px-4">
            <p className="inline-flex items-center gap-1.5">
              <CasaZenMark size={14} tone="mono" />
              {t('hostSite.frame.poweredBy')}
            </p>
          </div>
        </footer>
      ) : null}
    </div>
  );
}
