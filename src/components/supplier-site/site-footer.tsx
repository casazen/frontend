import { useId } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home } from 'lucide-react';
import { LEGAL_DOCUMENT_PATHS } from '@/features/legal/legal-paths';
import type { SiteModel } from '@/lib/supplier-site/site-model';
import { useCookiePreferencesStore } from '@/store/cookie-preferences-store';

/** How many comuni the footer names; the rest are in the block "Dove lavoriamo". */
const FOOTER_COMUNI = 5;

/**
 * The footer of a supplier's site: who it is, where it works, the documents of CasaZen and the choice about cookies. No phone,
 * no e-mail and no VAT number: the contacts are not part of the site and the VAT number is never shown (VT-D14).
 */
export function SiteFooter({ model }: { model: SiteModel }) {
  const { t } = useTranslation();
  const infoId = useId();
  const zonesId = useId();
  const openCookiePreferences = useCookiePreferencesStore((state) => state.openPreferences);
  const year = new Date().getFullYear();
  const line = model.tagline ?? model.intro;

  return (
    <footer className="vz-footer" data-testid="supplier-site-footer">
      <div className="vz-container vz-footer__grid">
        <div className="vz-footer__about">
          <p className="vz-footer__brand">{model.name}</p>
          {line ? <p>{line}</p> : null}
        </div>
        {model.comuni.length > 0 ? (
          <nav aria-labelledby={zonesId}>
            <h2 className="vz-footer__title" id={zonesId}>
              {t('supplierSite.footer.zones')}
            </h2>
            <ul>
              {model.comuni.slice(0, FOOTER_COMUNI).map((comune) => (
                <li key={comune}>{comune}</li>
              ))}
            </ul>
          </nav>
        ) : null}
        <nav aria-labelledby={infoId}>
          <h2 className="vz-footer__title" id={infoId}>
            {t('supplierSite.footer.info')}
          </h2>
          <ul>
            <li>
              <Link to={LEGAL_DOCUMENT_PATHS.privacy}>{t('publicSite.privacy')}</Link>
            </li>
            <li>
              <Link to={LEGAL_DOCUMENT_PATHS.tos}>{t('publicSite.terms')}</Link>
            </li>
            <li>
              <button
                type="button"
                className="vz-linkbtn"
                data-testid="supplier-site-cookies"
                onClick={(event) => openCookiePreferences(event.currentTarget)}
              >
                {t('publicSite.footer.cookies')}
              </button>
            </li>
          </ul>
        </nav>
      </div>
      <div className="vz-container vz-footer__bottom">
        <p>© {year} {model.name}</p>
        <a className="vz-powered" href="/">
          <Home aria-hidden="true" />
          <span>{t('supplierSite.footer.poweredBy')}</span>
        </a>
      </div>
    </footer>
  );
}
