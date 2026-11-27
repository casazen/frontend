import { useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useEmbed } from '@/features/embed/embed-context';
import { SearchResultsPage } from '@/features/public-site/search/site-search-page';
import type { SearchScope } from '@/features/public-site/search/search-scope';
import type { PublicOrgDto } from '@/types';

interface EmbedOutletContext {
  org: PublicOrgDto;
}

/**
 * The booking engine inside the frame: `/embed/booking` on the agency's domain, `/embed/<orgSlug>/booking` on the CasaZen one (NF-144). It is the results
 * page of the booking site (`SearchResultsPage`: the bar, the filters, the cards with their photos, the nearby dates and the map with its clusters, from the one
 * `stays` call of the site, with the state in the address of the frame), not a second one; what a frame is not is in the pieces that page is made of (see
 * there). The cards lead to the property widget of the same frame, never to the site, and this widget has no way to book: the exit to the checkout is one,
 * in the property widget.
 *
 * Only the org of the frame is searched: its slug is the one the shell works out (the host of the agency's domain, or the address of the CasaZen domain) and no
 * other part of the address names an org.
 */
export function BookingWidget() {
  const { org } = useOutletContext<EmbedOutletContext>();
  const embed = useEmbed();
  const slug = embed?.orgSlug ?? org.slug;
  const scope = useMemo<SearchScope>(
    () => ({ kind: 'org', slug, hostName: org.hostName?.trim() || org.displayName }),
    [slug, org.hostName, org.displayName],
  );

  return (
    <div data-testid="embed-widget-booking">
      <SearchResultsPage scope={scope} />
    </div>
  );
}
