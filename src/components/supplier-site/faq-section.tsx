import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { buildInquiryPath } from '@/lib/supplier-site/booking-params';
import type { SiteModel } from '@/lib/supplier-site/site-model';
import { Reveal } from './reveal';

/**
 * The questions the supplier answered, as native `<details>` (they work without script and with the keyboard). Beside them, while
 * the bookings are open, the way to ask a question of one's own: the request on measure. There is no phone and no e-mail to offer.
 */
export function FaqSection({ model }: { model: SiteModel }) {
  const { t } = useTranslation();

  return (
    <section className="vz-section" id="domande" aria-labelledby="vz-h-faq" data-testid="supplier-site-faq">
      <div className="vz-container vh-faq__in">
        <Reveal className="vh-faq__side">
          <p className="vz-eyebrow">{t('supplierSite.faq.eyebrow')}</p>
          <h2 id="vz-h-faq">{t('supplierSite.faq.title')}</h2>
          {model.bookingsOpen ? (
            <>
              <p className="vz-head__lead">{t('supplierSite.faq.ask')}</p>
              <Link className="vz-more" to={buildInquiryPath(model.slug)}>
                {t('supplierSite.cta.inquiry')}
              </Link>
            </>
          ) : null}
        </Reveal>
        <Reveal index={1}>
          <div className="vz-faq">
            {model.faq.map((row, index) => (
              <details key={row.question} className="vz-faq__item" open={index === 0 ? true : undefined}>
                <summary>
                  {row.question}
                  <Plus aria-hidden="true" />
                </summary>
                <div className="vz-faq__a">
                  <p>{row.answer}</p>
                </div>
              </details>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
