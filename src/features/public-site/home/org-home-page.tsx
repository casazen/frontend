import { useEffect } from 'react';
import { Navigate, useLocation, useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import { buildOrgBookingPath, buildPropertyBookingPath } from '@/lib/booking-url';
import { useStayState } from '@/features/public-site/stay/use-stay-state';
import { useOrgDestinations, useOrgStays } from '@/queries/use-public-stays';
import type { PublicOrgDto } from '@/types';
import { CategoryChips } from './category-chips';
import { FaqSection } from './faq-section';
import { HomeHero } from './home-hero';
import { siteRating, zonesOf } from './home-model';
import { HomeReviews } from './home-reviews';
import { isHomeSectionId, publishHomeSections, type HomeSectionId } from './home-sections';
import { HomeEmpty, HomeError, HomeSkeleton } from './home-states';
import { HousesSection } from './houses-section';
import { WhyDirect } from './why-direct';
import { ZonesSection } from './zones-section';
import './home.css';

interface PublicBookingContext {
  org: PublicOrgDto;
}

/**
 * The home of a booking site (DB-07b), where the site opens: above the fold a cover and one action, the search; below, sections
 * with one job each that appear only when the data is there and is true. All of it is read in one call (`stays`, DB-07a): the
 * homes with their prices, never one request per home. With several homes this is the page; with a single home the page of that
 * home is what the site is, and the guest is taken to it with the stay they had chosen.
 *
 * The seam for the single home: the page of the home does not yet open at the address of the site (it reads its home from the
 * address), so the guest is sent to it, as the landing has always done. When the new page of the home takes a `single` mode, this
 * redirect becomes that page rendered here, with no change of address (DB-07b-FU1).
 */
export function OrgHomePage() {
  const { orgSlug = '' } = useParams<{ orgSlug: string }>();
  const { org } = useOutletContext<PublicBookingContext>();
  const location = useLocation();
  const slug = org.slug ?? orgSlug;
  const { stay } = useStayState();
  // The stay is chosen on this very page: the answer for the previous one stays until the next arrives, so that the page (and the
  // search bar with its calendar open) is not swapped for the skeleton at every date or guest the person picks.
  const stays = useOrgStays(
    slug,
    {
      checkIn: stay.checkIn,
      checkOut: stay.checkOut,
      adults: stay.adults,
      children: stay.children,
      pets: stay.pets,
    },
    { keepPrevious: true },
  );
  const destinations = useOrgDestinations(slug);
  const searchPath = `${buildOrgBookingPath(slug)}/search`;

  const cards = stays.data?.items ?? [];
  const isHome = stays.isSuccess && cards.length > 1;
  const rating = siteRating(cards);
  const zones = zonesOf(cards, destinations.data);
  const hasZones = zones.length >= 2;

  // The header links the sections that are on the page, no others; and the address `?sezione=…` scrolls to one.
  const sections: HomeSectionId[] = isHome ? ['case', 'perche', ...(hasZones ? (['zone'] as const) : []), 'domande'] : [];
  const sectionsKey = sections.join(',');
  useEffect(() => {
    publishHomeSections(sectionsKey ? (sectionsKey.split(',') as HomeSectionId[]) : []);
    return () => publishHomeSections([]);
  }, [sectionsKey]);
  const [searchParams] = useSearchParams();
  const wanted = searchParams.get('sezione');
  useEffect(() => {
    if (!isHome || !isHomeSectionId(wanted)) return undefined;
    const frame = window.requestAnimationFrame(() => document.querySelector(`[data-section="${wanted}"]`)?.scrollIntoView({ block: 'start' }));
    return () => window.cancelAnimationFrame(frame);
  }, [isHome, wanted]);

  if (stays.isPending) {
    return (
      <div className="hm">
        <HomeHero org={org} slug={slug} cards={[]} destinations={undefined} searchPath={searchPath} loading />
        <HomeSkeleton />
      </div>
    );
  }

  if (stays.isError || !stays.data) {
    return (
      <div className="hm">
        <HomeHero org={org} slug={slug} cards={[]} destinations={undefined} searchPath={searchPath} />
        <HomeError onRetry={() => void stays.refetch()} retrying={stays.isFetching} />
      </div>
    );
  }

  const result = stays.data;

  if (cards.length === 1) {
    return <Navigate replace to={{ pathname: buildPropertyBookingPath(slug, cards[0]), search: location.search }} />;
  }

  if (cards.length === 0) {
    return (
      <div className="hm">
        <HomeHero org={org} slug={slug} cards={[]} destinations={undefined} searchPath={searchPath} />
        <HomeEmpty org={org} slug={slug} />
      </div>
    );
  }

  return (
    <div className="hm">
      <HomeHero org={org} slug={slug} cards={cards} destinations={destinations.data} searchPath={searchPath} />
      <CategoryChips cards={cards} searchPath={searchPath} />
      <HousesSection orgSlug={slug} result={result} stay={stay} searchPath={searchPath} />
      <WhyDirect org={org} slug={slug} cards={cards} searchPath={searchPath} />
      {rating ? <HomeReviews slug={slug} cards={cards} rating={rating} /> : null}
      {hasZones ? <ZonesSection zones={zones} searchPath={searchPath} /> : null}
      <FaqSection org={org} slug={slug} cards={cards} />
    </div>
  );
}
