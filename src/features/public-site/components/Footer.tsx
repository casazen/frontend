import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SEO_HUB_PATH } from '@/features/public-seo/seo-paths';
import { LEGAL_DOCUMENT_PATHS, LEGAL_INDEX_PATH, LEGAL_SUBPROCESSORS_PATH } from '@/features/legal/legal-paths';
import { orgDocumentPath } from '@/lib/org-document-paths';

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
  /**
   * Slug of the org whose booking site this is (BK-14, A3-21): Privacy and Terms then link to the operator's own
   * documents of that site (`/book/{slug}/privacy`, `/book/{slug}/termini`), not to the CasaZen ones.
   */
  orgSlug?: string;
}

const linkClass = 'underline hover:text-[var(--cz-public-primary)]';

export function Footer({ displayName, contactEmail, showPoweredBy = false, showSeoHubLink = false, orgSlug }: FooterProps) {
  const { t } = useTranslation();
  const year = new Date().getFullYear();
  // The pages always exist: the CasaZen ones say "in preparation" until the product owner provides the text (PL-14, D14),
  // the operator's say "not published" until the host publishes theirs (BK-14).
  const newTab = showSeoHubLink ? {} : { target: '_blank', rel: 'noopener noreferrer' };
  const operatorSite = !showSeoHubLink && orgSlug ? orgSlug : null;
  const privacyPath = operatorSite ? orgDocumentPath(operatorSite, 'privacy') : LEGAL_DOCUMENT_PATHS.privacy;
  const termsPath = operatorSite ? orgDocumentPath(operatorSite, 'terms') : LEGAL_DOCUMENT_PATHS.tos;

  return (
    <footer className="border-t border-black/10 py-8 text-sm text-[var(--cz-public-muted)]">
      <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-4 px-4 text-center">
        <div className="flex flex-wrap justify-center gap-4">
          {showSeoHubLink ? (
            <Link to={SEO_HUB_PATH} className={linkClass} data-testid="footer-seo-hub">
              {t('publicSite.seoHub')}
            </Link>
          ) : null}
          <Link to={privacyPath} className={linkClass} data-testid="footer-privacy" {...newTab}>
            {operatorSite ? t('publicSite.operatorPrivacy') : t('publicSite.privacy')}
          </Link>
          <Link to={termsPath} className={linkClass} data-testid="footer-terms" {...newTab}>
            {operatorSite ? t('publicSite.operatorTerms') : t('publicSite.terms')}
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
