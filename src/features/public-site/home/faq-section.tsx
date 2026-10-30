import { useTranslation } from 'react-i18next';
import { MessageCircle, Phone, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ContactHostDialog } from '@/features/public-site/contact/contact-host-dialog';
import { siteLocale } from '@/lib/site-language';
import type { PublicOrgDto } from '@/types';
import type { PublicStayCard } from '@/types/public-stays.types';
import { buildFaq } from './faq-model';

/**
 * «Domande frequenti» (DB-07b): an accordion of native `details` (it works with the keyboard and a screen reader as it is) and,
 * beside it, the way to ask what is not there: write to the host (the dialog of DB-02b) and call if they published a number. The
 * reply time of the prototype ("risponde di solito entro un'ora") is not measured, so it is not said (DB-D9). The address
 * `?sezione=domande` scrolls here.
 */
export function FaqSection({ org, slug, cards }: { org: PublicOrgDto; slug: string; cards: readonly PublicStayCard[] }) {
  const { t, i18n } = useTranslation();
  const host = org.hostName?.trim() || org.displayName;
  const initial = Array.from(host.trim())[0]?.toLocaleUpperCase() ?? '';
  const items = buildFaq({ t, locale: siteLocale(i18n.language), org, cards });

  return (
    <section className="hm-section hm-faq" id="domande" data-section="domande" aria-labelledby="home-faq-title" data-testid="home-faq">
      <div className="hm-faq__in">
        <div className="hm-faq__side">
          <p className="hm-eyebrow">{t('siteHome.faq.eyebrow')}</p>
          <h2 id="home-faq-title">{t('siteHome.faq.title')}</h2>
          <p className="hm-head__lead">{t('siteHome.faq.lead')}</p>
          <div className="hm-faq__host">
            <span className="hm-faq__avatar" aria-hidden="true">
              {initial}
            </span>
            <strong>{host}</strong>
          </div>
          <div className="hm-faq__actions">
            <ContactHostDialog
              site={slug}
              hostName={host}
              trigger={
                <Button type="button" className="public-site-cta h-11 border-0 px-5" data-testid="home-faq-write">
                  <MessageCircle className="mr-2 h-4 w-4" aria-hidden="true" />
                  {t('hostContact.trigger', { host })}
                </Button>
              }
            />
            {org.publicPhone ? (
              <a className="public-site-outline inline-flex h-11 items-center gap-2 px-5 text-sm" href={`tel:${org.publicPhone}`} data-testid="home-faq-call">
                <Phone className="h-4 w-4" aria-hidden="true" />
                {t('siteHome.empty.call')}
              </a>
            ) : null}
          </div>
        </div>
        <div className="hm-faq__list">
          {items.map((item) => (
            <details key={item.id} className="hm-faqitem">
              <summary>
                {item.question}
                <Plus aria-hidden="true" />
              </summary>
              <div className="hm-faqitem__a">
                <p>{item.answer}</p>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
