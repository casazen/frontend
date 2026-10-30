import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { HouseCard } from '@/features/public-site/cards/house-card';
import { searchHref } from '@/features/public-site/search/search-href';
import { formatStayRange } from '@/features/public-site/stay/stay-format';
import type { StayState } from '@/features/public-site/stay/stay-state';
import { siteLocale } from '@/lib/site-language';
import type { PublicStaysResult } from '@/types/public-stays.types';

/** The home page shows this many homes; «Vedi tutte» leads to the results with the rest. */
const HOME_MAX_HOUSES = 12;

/**
 * The homes of the site (DB-07b): a grid of cards, each with its photos, the heart, the mark, the place and the price. While no dates
 * are chosen the price is the lowest night of the next 30 days and a line says so; with dates it is the total of the quote for
 * those nights, and every card opens its home with the same dates. The id `property-grid` is where «Verifica disponibilità» of
 * the header scrolls to.
 */
export function HousesSection({
  orgSlug,
  result,
  stay,
  searchPath,
}: {
  orgSlug: string;
  result: PublicStaysResult;
  stay: StayState;
  searchPath: string;
}) {
  const { t, i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const locale = siteLocale(i18n.language);
  const hasDates = Boolean(stay.checkIn && stay.checkOut);
  const shown = result.items.slice(0, HOME_MAX_HOUSES);

  return (
    <section
      id="property-grid"
      className="hm-section hm-houses"
      data-section="case"
      aria-labelledby="home-houses-title"
      data-testid="home-houses"
    >
      <header className="hm-head">
        <div className="hm-head__text">
          <h2 id="home-houses-title">{t('siteHome.houses.title')}</h2>
          <p className="hm-head__lead">
            {hasDates
              ? t('siteHome.houses.leadDates', {
                  range: formatStayRange(stay.checkIn, stay.checkOut, locale),
                  count: result.nights ?? 0,
                })
              : t('siteHome.houses.leadNoDates')}
          </p>
        </div>
        <Link className="hm-more" to={searchHref(searchPath, searchParams)} data-testid="home-see-all">
          {t('siteHome.houses.seeAll')}
          <ArrowRight aria-hidden="true" />
        </Link>
      </header>
      <div className="hm-grid">
        {shown.map((card, index) => (
          <HouseCard
            key={card.id}
            card={card}
            orgSlug={orgSlug}
            nights={result.nights}
            stay={hasDates ? stay : null}
            eager={index < 3}
          />
        ))}
      </div>
    </section>
  );
}
