import { Link, useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, SearchX, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HouseCard } from '@/features/public-site/cards/house-card';
import { formatStayRange } from '@/features/public-site/stay/stay-format';
import { useStayState } from '@/features/public-site/stay/use-stay-state';
import { buildOrgBookingPath } from '@/lib/booking-url';
import { siteLocale } from '@/lib/site-language';
import { useOrgStays } from '@/queries/use-public-stays';
import type { PublicOrgDto } from '@/types';
import { readSearch, toStaysQuery } from './search-state';
import './search.css';

interface PublicBookingContext {
  org: PublicOrgDto;
}

/**
 * The results of a booking site (DB-07c): the homes of the site for the stay and the search of the address, each with the total of
 * the quote for the nights chosen, the ones that are not free after the ones that are, with the reason. Read in one call (`stays`,
 * DB-07a); the page keeps the previous answer on screen while the next one is on its way.
 */
export function SiteSearchPage() {
  const { t, i18n } = useTranslation();
  const { orgSlug = '' } = useParams<{ orgSlug: string }>();
  const { org } = useOutletContext<PublicBookingContext>();
  const slug = org.slug ?? orgSlug;
  const locale = siteLocale(i18n.language);
  const [searchParams] = useSearchParams();
  const { stay } = useStayState();
  const search = readSearch(searchParams);
  const hasDates = Boolean(stay.checkIn && stay.checkOut);
  const stays = useOrgStays(slug, toStaysQuery(stay, search), { keepPrevious: true });
  const result = stays.data;
  const free = result?.items.filter((card) => card.availability.available) ?? [];

  const title = !result
    ? t('siteSearch.title.homes')
    : hasDates
      ? free.length > 0
        ? t('siteSearch.title.free', { count: free.length })
        : t('siteSearch.title.noneFree')
      : t('siteSearch.title.homes');
  const sub = hasDates
    ? t('siteSearch.sub.dates', {
        range: formatStayRange(stay.checkIn, stay.checkOut, locale),
        nights: t('siteSearch.sub.nights', { count: result?.nights ?? 0 }),
        guests: t('stayPickers.guests.summary', { count: stay.adults + stay.children }),
      })
    : t('siteSearch.sub.noDates');

  return (
    <div className="sr" data-testid="site-search">
      <header className="sr-head">
        <h1 id="page-title" tabIndex={-1}>
          {title}
        </h1>
        <p className="sr-head__sub" aria-live="polite">
          {sub}
        </p>
      </header>

      {stays.isPending ? (
        <div role="status" aria-busy="true" data-testid="search-loading" className="sr-cards">
          <span className="sr-only">{t('publicSite.loadingProperties')}</span>
          {[0, 1, 2].map((key) => (
            <div key={key} className="sr-skel" aria-hidden="true" />
          ))}
        </div>
      ) : stays.isError || !result ? (
        <div role="alert" className="sr-state" data-testid="search-error">
          <TriangleAlert aria-hidden="true" />
          <div>
            <h2>{t('publicSite.propertiesError.title')}</h2>
            <p>{t('publicSite.propertiesError.description')}</p>
          </div>
          <Button type="button" className="public-site-cta border-0" disabled={stays.isFetching} onClick={() => void stays.refetch()}>
            {stays.isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {t('shared.errorFallback.tryAgain')}
          </Button>
        </div>
      ) : result.items.length === 0 ? (
        <div className="sr-state" data-testid="search-empty">
          <SearchX aria-hidden="true" />
          <div>
            <h2>{t('siteSearch.empty.title')}</h2>
            <p>{t('siteSearch.empty.text')}</p>
          </div>
          <Link className="public-site-outline inline-flex h-11 items-center px-5 text-sm" to={buildOrgBookingPath(slug)}>
            {t('siteSearch.empty.back')}
          </Link>
        </div>
      ) : (
        <div className="sr-cards" data-testid="search-results">
          {result.items.map((card, index) => (
            <HouseCard
              key={card.id}
              card={card}
              orgSlug={slug}
              variant="row"
              nights={result.nights}
              stay={hasDates ? stay : null}
              eager={index < 2}
            />
          ))}
        </div>
      )}
    </div>
  );
}
