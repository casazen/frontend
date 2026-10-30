import { useId } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Lock, Mail, Phone } from 'lucide-react';
import { CasaZenLogo, CasaZenMark } from '@/components/brand/casazen-mark';
import { ContactHostDialog } from '@/features/public-site/contact/contact-host-dialog';
import { SEO_HUB_PATH } from '@/features/public-seo/seo-paths';
import { LEGAL_DOCUMENT_PATHS, LEGAL_INDEX_PATH, LEGAL_SUBPROCESSORS_PATH } from '@/features/legal/legal-paths';
import { buildOrgBookingPath, buildPropertyBookingPath } from '@/lib/booking-url';
import { orgDocumentPath } from '@/lib/org-document-paths';
import { cn } from '@/lib/utils';
import { useCookiePreferencesStore } from '@/store/cookie-preferences-store';
import type { PublicOperator, PublicPropertyDto } from '@/types';
import { LanguageSwitch } from './language-switch';

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
  /** How the host is named on the site (DB-03, `Org.HostName`, "Giulia"): "Ti ospita Giulia" under the slogan. None: no line. */
  hostName?: string | null;
  /** The phone number the host chose to publish (DB-03, `+` or digits only): a `tel:` link in the contacts. None: no line. */
  phone?: string | null;
  /**
   * The host can take a payment on this site now (DB-03, `acceptsBookings`): only then does the footer say that the payments are
   * secure with Stripe (D24: a sentence, not logos written by hand). A site that cannot take payments says nothing about them.
   */
  acceptsBookings?: boolean;
  /** The homes of the site, for the column "Le case" (the first eight; more, and "Tutte le case" leads to the landing page). None: no column. */
  properties?: ReadonlyArray<Pick<PublicPropertyDto, 'id' | 'slug' | 'name'>>;
}

/** How many homes the footer names: the rest is one link to the landing page. */
const MAX_HOUSES = 8;

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
  hostName,
  phone,
  acceptsBookings = false,
  properties,
}: FooterProps) {
  const { t } = useTranslation();
  const infoTitleId = useId();
  const housesTitleId = useId();
  // "Cookie" opens the panel of the choices again, wherever the visitor is (DB-02b).
  const openCookiePreferences = useCookiePreferencesStore((state) => state.openPreferences);
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
            <button
              type="button"
              className={cn(linkClass, 'cursor-pointer')}
              data-testid="footer-cookies"
              onClick={(event) => openCookiePreferences(event.currentTarget)}
            >
              {t('publicSite.footer.cookies')}
            </button>
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

  // The footer of a booking site, light on the surface of the theme of the host: its name and slogan, who hosts and who runs it
  // (the operator, if the host entered the data), its homes, the way to its documents and to the choices on cookies, its
  // contacts if it published them, the language, and the line of the law of the page. Only what exists is shown: no line, no block.
  const housesShown = orgSlug ? (properties ?? []).slice(0, MAX_HOUSES) : [];
  const hostLabel = hostName?.trim() || null;
  const phoneNumber = phone?.trim() || null;
  // "Scrivi a {host}" is always there on a host's site: the message goes to the address the host keeps, published or not.
  const contactName = hostLabel || displayName || t('hostContact.theHost');
  const hasContacts = Boolean(contactEmail || phoneNumber || acceptsBookings || operatorSite);

  return (
    <footer className="border-t bg-[var(--cz-public-surface)] text-sm" data-testid="public-site-footer">
      <div className="mx-auto grid max-w-[1200px] gap-8 px-3 py-10 md:grid-cols-2 md:px-4 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))] lg:gap-x-10">
        <div className="min-w-0">
          {displayName ? <p className="public-display text-xl">{displayName}</p> : null}
          {tagline ? <p className="mt-2 max-w-sm text-[var(--cz-public-muted)]">{tagline}</p> : null}
          {hostLabel ? (
            <p className="mt-4 flex items-center gap-2.5" data-testid="footer-host">
              <span
                aria-hidden
                className="public-display grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--cz-public-soft)] text-sm text-[var(--cz-public-primary-text)]"
              >
                {Array.from(hostLabel)[0]?.toLocaleUpperCase()}
              </span>
              <span>{t('publicSite.footer.hostedBy', { host: hostLabel })}</span>
            </p>
          ) : null}
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
        {orgSlug && housesShown.length > 0 ? (
          <nav aria-labelledby={housesTitleId} data-testid="footer-houses">
            <p id={housesTitleId} className={TITLE_CLASS}>
              {t('publicSite.footer.houses')}
            </p>
            <ul>
              {housesShown.map((property) => (
                <li key={property.id}>
                  <Link to={buildPropertyBookingPath(orgSlug, property)} className={LINK_CLASS}>
                    {property.name}
                  </Link>
                </li>
              ))}
              {(properties?.length ?? 0) > MAX_HOUSES ? (
                <li>
                  <Link to={buildOrgBookingPath(orgSlug)} className={cn(LINK_CLASS, 'font-medium')}>
                    {t('publicSite.footer.allHouses')}
                  </Link>
                </li>
              ) : null}
            </ul>
          </nav>
        ) : null}
        <nav aria-labelledby={infoTitleId}>
          <p id={infoTitleId} className={TITLE_CLASS}>
            {t('publicSite.footer.info')}
          </p>
          <ul>
            {operatorSite ? (
              <li>
                <Link to={`${buildOrgBookingPath(operatorSite)}/my-bookings`} className={LINK_CLASS} data-testid="footer-my-bookings">
                  {t('publicSite.navMyBookings')}
                </Link>
              </li>
            ) : null}
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
            <li>
              <button
                type="button"
                className={cn(LINK_CLASS, 'cursor-pointer')}
                data-testid="footer-cookies"
                onClick={(event) => openCookiePreferences(event.currentTarget)}
              >
                {t('publicSite.footer.cookies')}
              </button>
            </li>
          </ul>
        </nav>
        {hasContacts ? (
          <div className="min-w-0" data-testid="footer-contacts">
            <p className={TITLE_CLASS}>{t('publicSite.footer.contact')}</p>
            <ul>
              {contactEmail ? (
                <li>
                  <a href={`mailto:${contactEmail}`} className={cn(LINK_CLASS, 'break-all')}>
                    {contactEmail}
                  </a>
                </li>
              ) : null}
              {phoneNumber ? (
                <li>
                  <a href={`tel:${phoneNumber}`} className={cn(LINK_CLASS, 'gap-1.5')} data-testid="footer-phone">
                    <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    {phoneNumber}
                  </a>
                </li>
              ) : null}
              {operatorSite ? (
                <li>
                  <ContactHostDialog
                    site={operatorSite}
                    hostName={contactName}
                    trigger={
                      <button
                        type="button"
                        className={cn(LINK_CLASS, 'cursor-pointer gap-1.5 font-medium')}
                        data-testid="footer-contact-host"
                      >
                        <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        {t('hostContact.trigger', { host: contactName })}
                      </button>
                    }
                  />
                </li>
              ) : null}
            </ul>
            {acceptsBookings ? (
              <p className="mt-3 inline-flex items-start gap-1.5 text-xs text-[var(--cz-public-muted)]" data-testid="footer-secure-payments">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                {t('publicSite.footer.securePayments')}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="border-t">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-3 px-3 py-4 text-xs text-[var(--cz-public-muted)] sm:flex-row sm:items-center sm:justify-between md:px-4">
          {displayName ? <p>© {year} {displayName}</p> : <span />}
          {/* The language, at every width: a tablet has no switch in its header (DB-02b). */}
          <LanguageSwitch className="self-start text-[var(--cz-public-text)] sm:self-auto" />
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
