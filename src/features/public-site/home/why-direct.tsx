import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, MessageCircle, Percent, Tag, type LucideIcon } from 'lucide-react';
import { searchHref } from '@/features/public-site/search/search-href';
import { formatStayRange } from '@/features/public-site/stay/stay-format';
import { useSiteMoney } from '@/features/public-site/hooks/use-site-money';
import { siteLocale } from '@/lib/site-language';
import type { PublicOrgDto } from '@/types';
import type { PublicStayCard } from '@/types/public-stays.types';
import { useHomeReceipt } from './use-home-receipt';

const REASONS: { id: 'transparent' | 'noFees' | 'direct'; icon: LucideIcon }[] = [
  { id: 'transparent', icon: Tag },
  { id: 'noFees', icon: Percent },
  { id: 'direct', icon: MessageCircle },
];

/**
 * «Perché prenotare direttamente» (DB-07b): three reasons that are true of every site (the total shows what is in it, nothing is
 * added for the portal, the person to talk to is the host) and, beside them, a receipt that is a real example: the cheapest home
 * on its first free nights, with the lines of the quote of the server and «Commissioni di servizio: 0 €». The «best price
 * guaranteed» of the prototype is a promise only a host can make and there is no field for it, so it is not here (DB-D9). Without
 * an example (nothing free, the quote is refused) the reasons stand alone.
 */
export function WhyDirect({ org, slug, cards, searchPath }: { org: PublicOrgDto; slug: string; cards: readonly PublicStayCard[]; searchPath: string }) {
  const { t, i18n } = useTranslation();
  const money = useSiteMoney();
  const locale = siteLocale(i18n.language);
  const [searchParams] = useSearchParams();
  const receipt = useHomeReceipt(slug, cards);
  const host = org.hostName?.trim() || org.displayName;

  return (
    <section className="hm-band hm-why" id="perche" data-section="perche" aria-labelledby="home-why-title" data-testid="home-why">
      <div className="hm-why__in">
        <div className="hm-why__text">
          <header className="hm-head">
            <div className="hm-head__text">
              <p className="hm-eyebrow">{t('siteHome.why.eyebrow')}</p>
              <h2 id="home-why-title">{t('siteHome.why.title')}</h2>
            </div>
          </header>
          <ul className="hm-why__list">
            {REASONS.map(({ id, icon: Icon }) => (
              <li key={id}>
                <span className="hm-why__i">
                  <Icon aria-hidden="true" />
                </span>
                <div>
                  <h3>{t(`siteHome.why.${id}.title`)}</h3>
                  <p>{t(`siteHome.why.${id}.text`, { host })}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {receipt ? (
          <aside className="hm-receipt" aria-label={t('siteHome.why.receipt.label', { name: receipt.card.name })} data-testid="home-receipt">
            <p className="hm-receipt__k">{t('siteHome.why.receipt.kicker')}</p>
            <h3 className="hm-receipt__t">{receipt.card.name}</h3>
            <p className="hm-receipt__d">
              {formatStayRange(receipt.checkIn, receipt.checkOut, locale)} · {t('siteSearch.sub.nights', { count: receipt.nights })} ·{' '}
              {t('siteHome.why.receipt.adults', { count: receipt.adults })}
            </p>
            <dl className="hm-price">
              <div>
                <dt>{t('siteSearch.sub.nights', { count: receipt.quote.nights })}</dt>
                <dd>{money(receipt.quote.lodgingTotal, receipt.quote.currency)}</dd>
              </div>
              {receipt.quote.cleaningFee > 0 ? (
                <div>
                  <dt>{t('siteHome.why.receipt.cleaning')}</dt>
                  <dd>{money(receipt.quote.cleaningFee, receipt.quote.currency)}</dd>
                </div>
              ) : null}
              {receipt.quote.touristTax.status === 'Calculated' && receipt.quote.touristTax.amount !== null ? (
                <div>
                  <dt>{t('siteHome.why.receipt.tax')}</dt>
                  <dd>{money(receipt.quote.touristTax.amount, receipt.quote.currency)}</dd>
                </div>
              ) : null}
              <div className="hm-price__fee">
                <dt>{t('siteHome.why.receipt.fees')}</dt>
                <dd>
                  <strong>{money(0, receipt.quote.currency)}</strong>
                </dd>
              </div>
              <div className="hm-price__total">
                <dt>{t('siteHome.why.receipt.total')}</dt>
                <dd>{money(receipt.quote.totalPrice, receipt.quote.currency)}</dd>
              </div>
            </dl>
            <Link
              className="hm-receipt__a"
              to={searchHref(searchPath, searchParams, { checkin: receipt.checkIn, checkout: receipt.checkOut, guests: String(receipt.adults), children: null })}
              data-testid="home-receipt-try"
            >
              {t('siteHome.why.receipt.try')}
              <ArrowRight aria-hidden="true" />
            </Link>
          </aside>
        ) : null}
      </div>
    </section>
  );
}
