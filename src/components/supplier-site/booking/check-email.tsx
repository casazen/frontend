import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Clock, Mail, MailQuestionMark } from 'lucide-react';
import { formatRomeDateTime } from '@/lib/stay-dates';
import { supplierSitePaths } from '@/lib/supplier-site/site-paths';

interface CheckEmailProps {
  slug: string;
  supplierName: string;
  /** The address the person typed: shown back so it can see a slip. Held in memory only; missing when the person came back from the bank. */
  email?: string;
  /** When the hold lapses (UTC); missing together with the address. */
  expiresAt?: string;
}

/**
 * "Controlla la tua email": the booking is held, nothing was sent to the supplier yet. The link of the e-mail sends the request; until
 * it is opened the supplier knows nothing, and when the time runs out the slot is free again. It says nothing it cannot keep: the
 * message may land in the spam folder, and there is no way to ask for it again from here.
 */
export function CheckEmail({ slug, supplierName, email, expiresAt }: CheckEmailProps) {
  const { t, i18n } = useTranslation();
  const until = expiresAt ? formatRomeDateTime(expiresAt, i18n.language, { hour: '2-digit', minute: '2-digit' }) : '';
  return (
    <section className="vz-state vb-check-email" data-testid="supplier-booking-check-email">
      <span className="vz-state__icon" aria-hidden="true">
        <Mail />
      </span>
      <h1 tabIndex={-1}>{t('supplierSite.booking.checkEmail.title')}</h1>
      <p>{email ? t('supplierSite.booking.checkEmail.lead', { email, name: supplierName }) : t('supplierSite.booking.checkEmail.leadNoAddress', { name: supplierName })}</p>
      <ul className="vb-check-email__list">
        <li>
          <MailQuestionMark aria-hidden="true" />
          <span>{t('supplierSite.booking.checkEmail.nothingYet', { name: supplierName })}</span>
        </li>
        {until ? (
          <li>
            <Clock aria-hidden="true" />
            <span>{t('supplierSite.booking.checkEmail.until', { time: until })}</span>
          </li>
        ) : null}
      </ul>
      <p className="vz-small">{t('supplierSite.booking.checkEmail.spam')}</p>
      <div className="vz-state__actions">
        <Link className="vz-btn vz-btn--secondary vz-btn--lg" to={supplierSitePaths.home(slug)}>
          {t('supplierSite.booking.checkEmail.back', { name: supplierName })}
        </Link>
      </div>
    </section>
  );
}
