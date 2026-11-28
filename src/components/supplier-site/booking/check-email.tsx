import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Clock, Mail, MailQuestionMark } from 'lucide-react';
import { formatRomeDateTime } from '@/lib/stay-dates';
import { supplierSitePaths } from '@/lib/supplier-site/site-paths';

interface CheckEmailProps {
  slug: string;
  supplierName: string;
  email?: string;
  expiresAt?: string;
  variant?: 'booking' | 'inquiry';
}

export function CheckEmail({ slug, supplierName, email, expiresAt, variant = 'booking' }: CheckEmailProps) {
  const { t, i18n } = useTranslation();
  const base = variant === 'inquiry' ? 'supplierSite.inquiry.checkEmail' : 'supplierSite.booking.checkEmail';
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  const until = expiresAt ? formatRomeDateTime(expiresAt, i18n.language, { hour: '2-digit', minute: '2-digit' }) : '';
  return (
    <section className="vz-state vb-check-email" data-testid="supplier-booking-check-email">
      <span className="vz-state__icon" aria-hidden="true">
        <Mail />
      </span>
      <h1 tabIndex={-1} ref={heading}>
        {t(`${base}.title`)}
      </h1>
      <p>{email ? t(`${base}.lead`, { email, name: supplierName }) : t(`${base}.leadNoAddress`, { name: supplierName })}</p>
      <ul className="vb-check-email__list">
        <li>
          <MailQuestionMark aria-hidden="true" />
          <span>{t(`${base}.nothingYet`, { name: supplierName })}</span>
        </li>
        {until ? (
          <li>
            <Clock aria-hidden="true" />
            <span>{t(`${base}.until`, { time: until })}</span>
          </li>
        ) : null}
      </ul>
      <p className="vz-small">{t(`${base}.spam`)}</p>
      <div className="vz-state__actions">
        <Link className="vz-btn vz-btn--secondary vz-btn--lg" to={supplierSitePaths.home(slug)}>
          {t(`${base}.back`, { name: supplierName })}
        </Link>
      </div>
    </section>
  );
}
