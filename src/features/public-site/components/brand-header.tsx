import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { CasaZenLogo } from '@/components/brand/casazen-mark';
import { showLoginEntryPoints } from '@/config/login-entry';
import { supportConfig } from '@/config/support.config';
import { SEO_HUB_PATH } from '@/features/public-seo/seo-paths';
import { inviteHref } from '@/site/site-links';
import { sitePageById, type SitePageId } from '@/site/site-pages';

/** The pages of the public site of CasaZen that the header leads to (`src/site/site-pages.ts`). */
const SITE_NAV: { id: SitePageId; key: string }[] = [
  { id: 'features', key: 'site.nav.features' },
  { id: 'suppliers', key: 'site.nav.suppliers' },
  { id: 'about', key: 'site.nav.about' },
];

const NAV_LINK = 'text-[var(--cz-public-muted)] hover:text-[var(--cz-public-text)]';

/**
 * Header of CasaZen's own public pages (search, guides, legal documents, supplier showcase): the logo, the pages of the
 * public site, the search and the way in to the app, the same as the header of the public site (`SiteLayout`). An org's
 * booking site has its own (`PublicSiteShell`): the host's name or logo, never CasaZen's. The way in ("Accedi") is not
 * offered on the production site (`src/config/login-entry.ts`): the app is reached there by its address only.
 *
 * The pages of the public site (`/`, `/funzionalita`, ...) are static files that the routing middleware serves, and
 * `/login` needs Auth0, which the public pages do not load: they are plain links (a router link would stay in the app,
 * which has no such route and would open the login or a 404). The guides and the search are pages of the app.
 */
export function BrandHeader() {
  const { t } = useTranslation();
  // The invitation request (only with a contact address), the same as the header of the public site.
  const inviteLink = inviteHref(supportConfig.email, t('site.invite.subject'));

  return (
    <header
      className="sticky top-0 z-30 border-b border-[var(--cz-public-border)] bg-[var(--cz-public-surface)]/95 backdrop-blur"
      data-testid="brand-header"
    >
      <div className="mx-auto flex max-w-[1200px] items-center gap-3 px-3 py-3 md:gap-8 md:px-4">
        <a href="/" aria-label={t('site.nav.home')} className="shrink-0 rounded-lg">
          <CasaZenLogo size={34} />
        </a>
        <nav aria-label={t('site.nav.main')} className="hidden md:block md:flex-1">
          <ul className="flex gap-6 text-[0.95rem] font-medium">
            {SITE_NAV.map((item) => (
              <li key={item.id}>
                <a href={sitePageById(item.id).path} className={NAV_LINK}>
                  {t(item.key)}
                </a>
              </li>
            ))}
            <li>
              <Link to={SEO_HUB_PATH} className={NAV_LINK}>
                {t('site.nav.guides')}
              </Link>
            </li>
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-4 text-sm font-medium">
          <Link to="/search" className={`inline-flex items-center gap-1.5 ${NAV_LINK}`}>
            <Search className="h-4 w-4" aria-hidden="true" />
            {t('publicSite.explore')}
          </Link>
          {inviteLink ? (
            <a
              href={inviteLink}
              className="rounded-full bg-[var(--cz-public-primary)] px-4 py-2 font-semibold text-[var(--cz-public-on-primary)] transition-opacity hover:opacity-90"
            >
              {t('site.invite.cta')}
            </a>
          ) : null}
          {showLoginEntryPoints(import.meta.env.VITE_PUBLIC_SITE_URL) ? (
            <a
              href="/login"
              className="rounded-full bg-[var(--cz-brand-ink)] px-4 py-2 font-semibold text-white transition-colors hover:bg-[var(--cz-brand-ink-hover)]"
            >
              {t('site.nav.login')}
            </a>
          ) : null}
        </div>
      </div>
    </header>
  );
}
