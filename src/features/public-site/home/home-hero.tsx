import { useMemo, useState } from 'react';
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

type HomeOrg = PublicOrgDto & { subtitle?: string | null };

interface HomeHeroProps {
  org: PublicOrgDto;
  slug: string;
  cards: readonly PublicStayCard[];
  destinations: readonly PublicDestination[] | undefined;
  searchPath: string;
  loading?: boolean;
}

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

  const [failedImages, setFailedImages] = useState<ReadonlySet<string>>(new Set());
  const coverCandidates = [org.heroImageUrl, ...cards.flatMap(card => displayableMediaUrls(card.photos))];
  const image = coverCandidates.find(url => url && !failedImages.has(url));
  const tagline = org.tagline?.trim() ?? '';
  const subtitle = (org as HomeOrg).subtitle?.trim() || homesLine(cards, locale, t);
  const rating = siteRating(cards);

  const search = () => navigate(searchHref(searchPath, searchParams));

  return (
    <section className={`hm-hero ${image ? 'hm-hero--image' : 'hm-hero--plain'}`} aria-labelledby="home-title" data-testid="home-hero">
      {image ? (
        <>
          <img className="hm-hero__media" src={image} alt="" onError={() => setFailedImages(previous => new Set(previous).add(image))} fetchPriority="high" decoding="async" />
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

function homesLine(cards: readonly PublicStayCard[], locale: string, t: TFunction): string {
  if (cards.length === 0) return '';
  const places = listOfPlaces(comuniOf(cards), locale);
  return places
    ? t('siteHome.hero.homesIn', { count: cards.length, places })
    : t('siteHome.hero.homes', { count: cards.length });
}
