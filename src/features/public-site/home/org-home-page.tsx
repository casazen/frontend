import { Navigate, useLocation, useOutletContext, useParams } from 'react-router-dom';
import { buildOrgBookingPath, buildPropertyBookingPath } from '@/lib/booking-url';
import { useStayState } from '@/features/public-site/stay/use-stay-state';
import { useOrgDestinations, useOrgStays } from '@/queries/use-public-stays';
import type { PublicOrgDto } from '@/types';
import { CategoryChips } from './category-chips';
import { HomeHero } from './home-hero';
import { HomeEmpty, HomeError, HomeSkeleton } from './home-states';
import { HousesSection } from './houses-section';
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
  const stays = useOrgStays(slug, {
    checkIn: stay.checkIn,
    checkOut: stay.checkOut,
    adults: stay.adults,
    children: stay.children,
    pets: stay.pets,
  });
  const destinations = useOrgDestinations(slug);
  const searchPath = `${buildOrgBookingPath(slug)}/search`;

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
  const cards = result.items;

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
    </div>
  );
}
