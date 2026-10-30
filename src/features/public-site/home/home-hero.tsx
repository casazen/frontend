import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Lock, Star } from 'lucide-react';
import { formatAverage } from '@/features/reviews/lib/review-format';
import { searchHref } from '@/features/public-site/search/search-href';
import { SearchBar } from '@/features/public-site/stay/search-bar';
import { useStayState } from '@/features/public-site/stay/use-stay-state';
import { usePublicSiteCalendar } from '@/features/public-site/stay/use-public-site-calendar';
import { displayableMediaUrls } from '@/lib/media-url';
import { siteLocale } from '@/lib/site-language';
import type { PublicOrgDto } from '@/types';
import type { PublicDestination, PublicStayCard } from '@/types/public-stays.types';
import { comuniOf, destinationOptions, listOfPlaces, maxGuestsOf, siteRating } from './home-model';

/** What the host wrote under the slogan (DB-03 `Org.Subtitle`); the type of the shared DTO does not carry it yet. */
type HomeOrg = PublicOrgDto & { subtitle?: string | null };

interface HomeHeroProps {
  org: PublicOrgDto;
  /** The slug the site answers to (the search and the calendar belong to it). */
  slug: string;
  /** The homes of the site; empty while they are not known (the hero then shows the name and the search, nothing else). */
  cards: readonly PublicStayCard[];
  destinations: readonly PublicDestination[] | undefined;
  /** The path of the results page, with the stay in the address. */
  searchPath: string;
  /** The homes are being read: the cover and the name are there already, the search is a quiet placeholder of its size. */
  loading?: boolean;
}

/**
 * The top of the home (DB-07b): the photo of the host (their cover, else the first photo of the first home), the slogan as the one
 * heading (the name of the site stays in the text for readers and engines), a line that says what is on the site, at most three
 * points of trust that are true (the mark with its number of reviews, secure payment when the host can take one) and, as the one
 * action of the page, the search «Dove · Quando · Chi». The search is a bar over the lower edge of the photo on a tablet or a
 * desktop and one field that opens a sheet on a phone (`SearchBar`, DB-20).
 */
export function HomeHero({ org, slug, cards, destinations, searchPath, loading = false }: HomeHeroProps) {
  const { t, i18n } = useTranslation();
  const locale = siteLocale(i18n.language);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const maxGuests = maxGuestsOf(cards);
  const { stay, setStay, where, setWhere } = useStayState({ maxGuests });
  const calendar = usePublicSiteCalendar(slug, { adults: stay.adults, children: stay.children });

  const options = useMemo(
    () => destinationOptions(destinations, (count) => t('siteHome.hero.destinationHomes', { count })),
    [destinations, t],
  );

  const image = org.heroImageUrl ?? displayableMediaUrls(cards[0]?.photos)[0] ?? null;
  const tagline = org.tagline?.trim() ?? '';
  const subtitle = (org as HomeOrg).subtitle?.trim() || homesLine(cards, locale, t);
  const rating = siteRating(cards);

  const search = () => navigate(searchHref(searchPath, searchParams));

  return (
    <section className={`hm-hero ${image ? 'hm-hero--image' : 'hm-hero--plain'}`} aria-labelledby="home-title" data-testid="home-hero">
      {image ? (
        <>
          <img className="hm-hero__media" src={image} alt="" fetchPriority="high" decoding="async" />
          <div className="hm-hero__scrim" aria-hidden="true" />
        </>
      ) : null}
      <div className="hm-hero__in">
        <div className="hm-hero__copy">
          {tagline ? <p className="hm-hero__eyebrow">{org.displayName}</p> : null}
          <h1 id="home-title" className="hm-hero__title">
            {tagline ? <span className="sr-only">{org.displayName} · </span> : null}
            {tagline || org.displayName}
          </h1>
          {subtitle ? <p className="hm-hero__lead">{subtitle}</p> : null}
          {rating || org.acceptsBookings ? (
            <ul className="hm-hero__trust">
              {rating ? (
                <li>
                  <Star aria-hidden="true" className="hm-hero__star" />
                  <span>
                    <strong>{formatAverage(rating.average, i18n.language)}</strong> · {t('siteHome.hero.reviews', { count: rating.count })}
                  </span>
                </li>
              ) : null}
              {org.acceptsBookings ? (
                <li>
                  <Lock aria-hidden="true" />
                  <span>{t('siteHome.hero.securePayment')}</span>
                </li>
              ) : null}
            </ul>
          ) : null}
        </div>
      </div>
      {loading ? (
        <div className="hm-hero__search" aria-hidden="true">
          <div className="hm-skel hm-hero__ghost" />
        </div>
      ) : null}
      {cards.length > 0 ? (
        <div className="hm-hero__search" data-testid="home-search">
          <SearchBar
            destination={where}
            onDestinationChange={setWhere}
            destinations={options}
            stay={stay}
            onStayChange={setStay}
            calendar={calendar}
            maxGuests={maxGuests}
            showDestination={options.length > 1}
            onSearch={search}
          />
        </div>
      ) : null}
    </section>
  );
}

/** «3 case a Ostuni, Polignano a Mare e Lecce»: what is on the site, from the data; nothing when the homes are not known. */
function homesLine(cards: readonly PublicStayCard[], locale: string, t: TFunction): string {
  if (cards.length === 0) return '';
  const places = listOfPlaces(comuniOf(cards), locale);
  return places
    ? t('siteHome.hero.homesIn', { count: cards.length, places })
    : t('siteHome.hero.homes', { count: cards.length });
}
