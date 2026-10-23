import { useId } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CasaZenLogo, CasaZenMark } from '@/components/brand/casazen-mark';
import { SEO_HUB_PATH } from '@/features/public-seo/seo-paths';
import { LEGAL_DOCUMENT_PATHS, LEGAL_INDEX_PATH, LEGAL_SUBPROCESSORS_PATH } from '@/features/legal/legal-paths';
import { orgDocumentPath } from '@/lib/org-document-paths';
import { cn } from '@/lib/utils';
import type { PublicOperator } from '@/types';

interface FooterProps {
  displayName?: string;
  contactEmail?: string | null;
  showPoweredBy?: boolean;
  /** The slogan of the host (`Org.Tagline`), under its name: a booking site shows it, the CasaZen pages do not. */
  tagline?: string | null;
  /**
   * Who runs the booking site (DB-03b-a): legal name, registered office and VAT number, each only if the host entered it. The
   * block "Operatore" is there only when at least one is; the CasaZen pages never get it.
   */
  operator?: PublicOperator | null;
  /**
   * CasaZen public pages only: the SEO hub and the CasaZen legal documents for hosts (DPA, subprocessors). A host's
   * booking site (`/book/*`) is the host's brand: it keeps only the Privacy and Terms links, opened in a new tab so the
   * guest does not leave the booking. The CasaZen pages also get CasaZen's own footer (the logo on the dark ink of the brand),
   * the host's site the light one that follows its theme.
   */
  showSeoHubLink?: boolean;
  /**
   * Slug of the org whose booking site this is (BK-14, A3-21): Privacy and Terms then link to the operator's own
   * documents of that site (`/book/{slug}/privacy`, `/book/{slug}/termini`), not to the CasaZen ones.
   */
  orgSlug?: string;
}

// A label, not a heading: the headings of the page wear the display font of the theme, these are small captions.
const TITLE_CLASS = 'mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--cz-public-muted)]';
const LINK_CLASS =
  'inline-flex min-h-8 max-w-full items-center break-words underline-offset-4 hover:text-[var(--cz-public-primary-text)] hover:underline pointer-coarse:min-h-11';

export function Footer({
  displayName,
  contactEmail,
  showPoweredBy = false,
  tagline,
  operator,
  showSeoHubLink = false,
  orgSlug,
}: FooterProps) {
  const { t } = useTranslation();
  const infoTitleId = useId();
  // Only what the host entered (the backend sends null for the rest, never an empty string); no line, no block.
  const operatorName = operator?.legalName?.trim() || null;
  const operatorOffice = operator?.registeredOffice?.trim() || null;
  const operatorVat = operator?.vatNumber?.trim() || null;
  const hasOperator = Boolean(operatorName || operatorOffice || operatorVat);
  const year = new Date().getFullYear();
  // The pages always exist: the CasaZen ones say "in preparation" until the product owner provides the text (PL-14, D14),
  // the operator's say "not published" until the host publishes theirs (BK-14).
  const newTab = showSeoHubLink ? {} : { target: '_blank', rel: 'noopener noreferrer' };
  const operatorSite = !showSeoHubLink && orgSlug ? orgSlug : null;
  const privacyPath = operatorSite ? orgDocumentPath(operatorSite, 'privacy') : LEGAL_DOCUMENT_PATHS.privacy;
  const termsPath = operatorSite ? orgDocumentPath(operatorSite, 'terms') : LEGAL_DOCUMENT_PATHS.tos;

  if (showSeoHubLink) {
    const linkClass = 'underline-offset-4 hover:text-white hover:underline';
    return (
      <footer className="bg-[var(--cz-brand-ink-deep)] text-sm text-[#cde0df]">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-8 px-4 py-10 md:flex-row md:items-start md:justify-between">
          <div className="max-w-xs">
            <a href="/" aria-label={t('site.nav.home')} className="inline-block rounded-lg">
              <CasaZenLogo tone="dark" size={36} />
            </a>
            <p className="mt-3 leading-relaxed">{t('site.footer.tagline')}</p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 md:max-w-xl md:justify-end">
            <Link to={SEO_HUB_PATH} className={linkClass} data-testid="footer-seo-hub">
              {t('publicSite.seoHub')}
            </Link>
            <Link to={privacyPath} className={linkClass} data-testid="footer-privacy" {...newTab}>
              {t('publicSite.privacy')}
            </Link>
            <Link to={termsPath} className={linkClass} data-testid="footer-terms" {...newTab}>
              {t('publicSite.terms')}
            </Link>
            <Link to={LEGAL_SUBPROCESSORS_PATH} className={linkClass} data-testid="footer-subprocessors">
              {t('publicSite.subprocessors')}
            </Link>
            <Link to={LEGAL_INDEX_PATH} className={linkClass} data-testid="footer-legal">
              {t('publicSite.legalDocuments')}
            </Link>
            {contactEmail ? (
              <a href={`mailto:${contactEmail}`} className={linkClass}>
                {contactEmail}
              </a>
            ) : null}
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-[1200px] flex-col gap-1 px-4 py-5 text-xs sm:flex-row sm:gap-4">
            {displayName ? <p>© {year} {displayName}</p> : null}
            {showPoweredBy ? <p>{t('publicSite.poweredBy')}</p> : null}
          </div>
        </div>
      </footer>
    );
  }

  // The footer of a booking site, light on the surface of the theme of the host: its name and slogan, who runs it (the
  // operator, if the host entered the data), the way to its documents, its contact if it published one, and the line of the
  // law of the page.
  return (
    <footer className="border-t bg-[var(--cz-public-surface)] text-sm" data-testid="public-site-footer">
      <div
        className={cn(
          'mx-auto grid max-w-[1200px] gap-8 px-3 py-10 md:gap-x-16 md:px-4',
          contactEmail ? 'md:grid-cols-[minmax(0,1fr)_auto_auto]' : 'md:grid-cols-[minmax(0,1fr)_auto]',
        )}
      >
        <div className="min-w-0">
          {displayName ? <p className="public-display text-xl">{displayName}</p> : null}
          {tagline ? <p className="mt-2 max-w-sm text-[var(--cz-public-muted)]">{tagline}</p> : null}
          {/* The transparency of the operator (DB-03b-a): who runs the site, with the registered office and the VAT number. */}
          {hasOperator ? (
            <div className="mt-5 max-w-sm space-y-0.5 break-words" data-testid="footer-operator">
              <p className={TITLE_CLASS}>{t('publicSite.footer.operator')}</p>
              {operatorName ? <p data-testid="footer-operator-name">{operatorName}</p> : null}
              {operatorOffice ? <p data-testid="footer-operator-office">{operatorOffice}</p> : null}
              {operatorVat ? (
                <p data-testid="footer-operator-vat">{t('publicSite.footer.vatNumber', { vat: operatorVat })}</p>
              ) : null}
            </div>
          ) : null}
        </div>
        <nav aria-labelledby={infoTitleId}>
          <p id={infoTitleId} className={TITLE_CLASS}>
            {t('publicSite.footer.info')}
          </p>
          <ul>
            <li>
              <Link to={privacyPath} className={LINK_CLASS} data-testid="footer-privacy" {...newTab}>
                {operatorSite ? t('publicSite.operatorPrivacy') : t('publicSite.privacy')}
              </Link>
            </li>
            <li>
              <Link to={termsPath} className={LINK_CLASS} data-testid="footer-terms" {...newTab}>
                {operatorSite ? t('publicSite.operatorTerms') : t('publicSite.terms')}
              </Link>
            </li>
          </ul>
        </nav>
        {contactEmail ? (
          <div className="min-w-0">
            <p className={TITLE_CLASS}>{t('publicSite.footer.contact')}</p>
            <a href={`mailto:${contactEmail}`} className={cn(LINK_CLASS, 'break-all')}>
              {contactEmail}
            </a>
          </div>
        ) : null}
      </div>
      <div className="border-t">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-2 px-3 py-4 text-xs text-[var(--cz-public-muted)] sm:flex-row sm:items-center sm:justify-between md:px-4">
          {displayName ? <p>© {year} {displayName}</p> : <span />}
          {showPoweredBy ? (
            <p className="inline-flex items-center gap-1.5">
              <CasaZenMark size={14} tone="mono" />
              {t('publicSite.poweredBy')}
            </p>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
