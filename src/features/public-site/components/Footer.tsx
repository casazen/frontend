import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SEO_HUB_PATH } from '@/features/public-seo/seo-paths';
import { usePlatformLegalLinks } from '@/queries/use-legal';

interface FooterProps {
  displayName?: string;
  contactEmail?: string | null;
  showPoweredBy?: boolean;
  /** CasaZen public pages only: a host's booking site (`/book/*`) is the host's brand and does not link it. */
  showSeoHubLink?: boolean;
}

export function Footer({ displayName, contactEmail, showPoweredBy = false, showSeoHubLink = false }: FooterProps) {
  const { t } = useTranslation();
  const { privacyUrl, termsUrl } = usePlatformLegalLinks();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-black/10 py-8 text-sm text-[var(--cz-public-muted)]">
      <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-4 px-4 text-center">
        <div className="flex flex-wrap justify-center gap-4">
          {showSeoHubLink ? (
            <Link to={SEO_HUB_PATH} className="underline hover:text-[var(--cz-public-primary)]" data-testid="footer-seo-hub">
              {t('publicSite.seoHub')}
            </Link>
          ) : null}
          {/* D3: no domain in code; the documents are the ones configured on the backend (hidden until then). */}
          {privacyUrl ? (
            <a href={privacyUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--cz-public-primary)]" data-testid="footer-privacy">
              {t('publicSite.privacy')}
            </a>
          ) : null}
          {termsUrl ? (
            <a href={termsUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--cz-public-primary)]" data-testid="footer-terms">
              {t('publicSite.terms')}
            </a>
          ) : null}
          {contactEmail ? (
            <a href={`mailto:${contactEmail}`} className="underline hover:text-[var(--cz-public-primary)]">
              {contactEmail}
            </a>
          ) : null}
        </div>
        {displayName ? <p>© {year} {displayName}</p> : null}
        {showPoweredBy ? (
          <p className="text-xs">{t('publicSite.poweredBy')}</p>
        ) : null}
      </div>
    </footer>
  );
}
