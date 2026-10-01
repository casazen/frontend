import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SEO_HUB_PATH } from '@/features/public-seo/seo-paths';
import { LEGAL_DOCUMENT_PATHS, LEGAL_INDEX_PATH, LEGAL_SUBPROCESSORS_PATH } from '@/features/legal/legal-paths';

interface FooterProps {
  displayName?: string;
  contactEmail?: string | null;
  showPoweredBy?: boolean;
  /**
   * CasaZen public pages only: the SEO hub and the CasaZen legal documents for hosts (DPA, subprocessors). A host's
   * booking site (`/book/*`) is the host's brand: it keeps only the Privacy and Terms links, opened in a new tab so the
   * guest does not leave the booking.
   */
  showSeoHubLink?: boolean;
}

const linkClass = 'underline hover:text-[var(--cz-public-primary-text)]';

export function Footer({ displayName, contactEmail, showPoweredBy = false, showSeoHubLink = false }: FooterProps) {
  const { t } = useTranslation();
  const year = new Date().getFullYear();
  // PL-14: the pages always exist (they say "in preparation" until the product owner provides the text, D14).
  const newTab = showSeoHubLink ? {} : { target: '_blank', rel: 'noopener noreferrer' };

  return (
    <footer className="border-t border-[var(--cz-public-border)] py-8 text-sm text-[var(--cz-public-muted)]">
      <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-4 px-4 text-center">
        <div className="flex flex-wrap justify-center gap-4">
          {showSeoHubLink ? (
            <Link to={SEO_HUB_PATH} className={linkClass} data-testid="footer-seo-hub">
              {t('publicSite.seoHub')}
            </Link>
          ) : null}
          <Link to={LEGAL_DOCUMENT_PATHS.privacy} className={linkClass} data-testid="footer-privacy" {...newTab}>
            {t('publicSite.privacy')}
          </Link>
          <Link to={LEGAL_DOCUMENT_PATHS.tos} className={linkClass} data-testid="footer-terms" {...newTab}>
            {t('publicSite.terms')}
          </Link>
          {showSeoHubLink ? (
            <>
              <Link to={LEGAL_SUBPROCESSORS_PATH} className={linkClass} data-testid="footer-subprocessors">
                {t('publicSite.subprocessors')}
              </Link>
              <Link to={LEGAL_INDEX_PATH} className={linkClass} data-testid="footer-legal">
                {t('publicSite.legalDocuments')}
              </Link>
            </>
          ) : null}
          {contactEmail ? (
            <a href={`mailto:${contactEmail}`} className={linkClass}>
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
