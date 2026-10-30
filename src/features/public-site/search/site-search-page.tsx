import { useMemo } from 'react';
import { useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { List, Loader2, Map as MapIcon, Receipt, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HouseCard } from '@/features/public-site/cards/house-card';
import { useFavorites } from '@/features/public-site/favorites/use-favorites';
import { formatStayRange } from '@/features/public-site/stay/stay-format';
import { writeStay } from '@/features/public-site/stay/stay-state';
import { WHERE_PARAM } from '@/features/public-site/stay/use-stay-state';
import { useMapLink } from '@/features/site-maps';
import { useMediaQuery } from '@/hooks/use-media-query';
import { siteLocale } from '@/lib/site-language';
import { useOrgStays, usePlatformStays } from '@/queries/use-public-stays';
import type { PublicOrgDto } from '@/types';
import type { PublicStayAlternative } from '@/types/public-stays.types';
import { ActiveFilterChips } from './active-filter-chips';
import { NoResults, type NoResultsReason } from './no-results';
import { ResultsMapPane } from './results-map-pane';
import { facetsOfCards, facetsOfServer } from './search-facets';
import { PLATFORM_SCOPE, useScopedDestinations, useScopedStays, type SearchScope } from './search-scope';
import { NO_FILTERS, activeFilterCount } from './search-state';
import { SearchToolbar } from './search-toolbar';
import { UnavailableList } from './unavailable-list';
import { useSearchState } from './use-search-state';
import './search.css';

/** From here the list and the map are side by side; under it the page shows one of them and a button to change. */
const FROM_DESKTOP_QUERY = '(width >= 64rem)';

interface PublicBookingContext {
  org: PublicOrgDto;
}

/**
 * The results of a booking site (DB-07c): the homes of the site for the stay and the search of the address, each with the total of
 * the quote for the nights chosen, the ones that are not free after the ones that are, with the reason; when nothing is free, the
 * nearby dates that are. Read in one call (`stays`, DB-07a), and the page keeps the previous answer on screen while the next one is
 * on its way. The price is the server's: the page does not add up anything.
 */
export function SiteSearchPage() {
  const { orgSlug = '' } = useParams<{ orgSlug: string }>();
  const { org } = useOutletContext<PublicBookingContext>();
  const scope = useMemo<SearchScope>(
    () => ({ kind: 'org', slug: org.slug ?? orgSlug, hostName: org.hostName?.trim() || org.displayName }),
    [org.slug, org.hostName, org.displayName, orgSlug],
  );
  return <SearchResultsPage scope={scope} />;
}

/**
 * The results page of both searches (DB-07c, SEARCH-GLOBAL): the one of a booking site and the public `/search` of CasaZen, which
 * searches the homes of ALL the sites. The bar, the sheet of filters, the chips, the cards, the nearby dates and the map are the
 * same components; the scope decides where the data come from. Across all the sites only the free homes are listed (a page at a
 * time, «Mostra altre case»), each card names its host and leads to the home on that host's site with the dates chosen, and there
 * are no hearts and no one host to write to.
 */
export function SearchResultsPage({ scope = PLATFORM_SCOPE }: { scope?: SearchScope }) {
  const { t, i18n } = useTranslation();
  const platform = scope.kind === 'platform';
  const slug = scope.kind === 'org' ? scope.slug : '';
  const locale = siteLocale(i18n.language);
  const [address] = useSearchParams();
  const placeAsked = address.get(WHERE_PARAM)?.trim() ?? '';

  // What the controls offer, whatever else is asked: every home of the site, or the facets of the place asked across all the sites.
  // A guest with a pet is always asked, and the list says which homes take it (the server answers a home that does not with the reason `pets`).
  const everyHome = useOrgStays(platform ? undefined : slug, {}).data?.items;
  // (A page of one home: only its facets are wanted. The previous ones stay while the next place is asked, so the controls do not blink.)
  const placeFacets = usePlatformStays({ where: placeAsked }, { enabled: platform, pageSize: 1, keepPrevious: true }).data?.facets;
  const facets = useMemo(() => (platform ? facetsOfServer(placeFacets) : facetsOfCards(everyHome ?? [])), [platform, placeFacets, everyHome]);
  const destinations = useScopedDestinations(scope);
  const favorites = useFavorites(platform ? undefined : slug);
  const state = useSearchState({ maxGuests: facets.maxGuests });
  const { stay, search, setSearch, searchParams } = state;
  const hasDates = Boolean(stay.checkIn && stay.checkOut);
  const desktop = useMediaQuery(FROM_DESKTOP_QUERY);
  const link = useMapLink();

  const stays = useScopedStays(scope, state.query, { keepPrevious: true });
  const result = stays.data;
  // The hearts belong to a site: across all of them there are none, and an address that asks for them (`favorites=1`) is not heard.
  const onlyFavorites = !platform && search.onlyFavorites;
  const items = (result?.items ?? []).filter((card) => !onlyFavorites || favorites.ids.includes(card.id));
  // Across all the sites the server lists only the free homes; on a site the others follow, with the reason.
  const free = items.filter((card) => card.availability.available);
  const notFree = items.filter((card) => !card.availability.available);
  const hasFilters = activeFilterCount(search.filters) > 0 || search.filters.tags.length > 0;
  // The map shows the same homes as the list (the ones free first, then the others) and is not loaded at all while a phone shows the list.
  const showMap = items.length > 0 && (desktop || search.view === 'map');
  const showList = desktop || search.view !== 'map' || items.length === 0;

  // How many homes the title counts: a site has them all in the list; across all the sites the list is a page and the server counts.
  const freeCount = platform ? (result?.availableCount ?? 0) : free.length;
  const title = !result
    ? t(platform ? 'platformSearch.title.homes' : 'siteSearch.title.homes')
    : hasDates
      ? freeCount > 0
        ? t('siteSearch.title.free', { count: freeCount })
        : t('siteSearch.title.noneFree')
      : hasFilters || onlyFavorites || (platform && placeAsked)
        ? t('siteSearch.title.count', { count: freeCount })
        : t(platform ? 'platformSearch.title.homes' : 'siteSearch.title.homes');
  const sub = hasDates
    ? t('siteSearch.sub.dates', {
        range: formatStayRange(stay.checkIn, stay.checkOut, locale),
        nights: t('siteSearch.sub.nights', { count: result?.nights ?? 0 }),
        guests: t('stayPickers.guests.summary', { count: stay.adults + stay.children }),
      })
    : t('siteSearch.sub.noDates');

  const reasonOfNothing = (): NoResultsReason => {
    if (onlyFavorites && (result?.items.length ?? 0) > 0 && items.length === 0) return 'favorites';
    if (platform) {
      if ((result?.totalCount ?? 0) === 0) return hasFilters || placeAsked ? 'filters' : 'none';
      if (facets.maxGuests !== undefined && stay.adults + stay.children > facets.maxGuests) return 'capacity';
      return hasDates ? 'dates' : 'none';
    }
    if ((result?.items.length ?? 0) === 0) return hasFilters ? 'filters' : 'none';
    if (notFree.length > 0 && notFree.every((card) => card.availability.reason === 'guests')) return 'capacity';
    return hasDates ? 'dates' : 'none';
  };

  const alternativeHref = (alternative: PublicStayAlternative) =>
    `?${writeStay(new URLSearchParams(searchParams), { checkIn: alternative.checkIn, checkOut: alternative.checkOut }).toString()}`;
  // Across all the sites the place is one of the things that can be taken off.
  const clearFilters = () => setSearch({ filters: NO_FILTERS, onlyFavorites: false, ...(platform ? { where: '' } : {}) });
  const goToResults = () => document.getElementById('page-title')?.focus();

  // What the totals include, said as the server knows it: the tourist tax is exact, an estimate until the ages of the children are
  // known, or not in the total when the comune has none on the list.
  const taxStates = new Set(free.map((card) => card.price.includesTouristTax).filter(Boolean));
  const notes: string[] = [];
  if (hasDates && free.length > 0) {
    if (taxStates.has('notIncluded')) notes.push('notIncluded');
    if (taxStates.has('estimated')) notes.push('estimated');
    if (notes.length === 0) notes.push('included');
  }

  return (
    <div className="sr" data-testid={platform ? 'platform-search' : 'site-search'}>
      <SearchToolbar
        scope={scope}
        state={state}
        facets={facets}
        destinations={destinations}
        favoritesCount={favorites.ids.length}
        onSearch={goToResults}
      />

      <div className={showMap ? 'sr-body sr-body--map' : 'sr-body'}>
        {showList ? (
          <div className="sr-main" aria-busy={stays.isPlaceholderData || undefined} data-stale={stays.isPlaceholderData || undefined}>
            <header className="sr-head" aria-live="polite">
              <h1 id="page-title" tabIndex={-1}>
                {title}
              </h1>
              <p className="sr-head__sub">{sub}</p>
            </header>
            <ActiveFilterChips filters={search.filters} currency={facets.currency} onChange={(filters) => setSearch({ filters })} />

            {stays.isPending ? (
              <div role="status" aria-busy="true" data-testid="search-loading" className="sr-cards">
                <span className="sr-only">{t('publicSite.loadingProperties')}</span>
                {[0, 1, 2].map((key) => (
                  <div key={key} className="sr-skel" aria-hidden="true" />
                ))}
              </div>
            ) : stays.isError && !result ? (
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
            ) : result ? (
              <>
                {free.length > 0 ? (
                  <div className="sr-cards" data-testid="search-results">
                    {free.map((card, index) => (
                      <HouseCard
                        key={card.id}
                        card={card}
                        orgSlug={platform ? undefined : slug}
                        variant="row"
                        nights={result.nights}
                        stay={hasDates ? stay : null}
                        mapLink={showMap ? link.bind(card.id) : undefined}
                        eager={index < 2}
                      />
                    ))}
                  </div>
                ) : (
                  <NoResults
                    reason={reasonOfNothing()}
                    scope={scope}
                    guests={stay.adults + stay.children}
                    maxGuests={facets.maxGuests}
                    alternatives={onlyFavorites ? [] : result.alternatives}
                    alternativeHref={alternativeHref}
                    canClearFilters={hasFilters || onlyFavorites || (platform && Boolean(placeAsked))}
                    onClearFilters={clearFilters}
                  />
                )}
                {platform && stays.hasNextPage ? (
                  <div className="sr-more" data-testid="search-more">
                    <p role="status">{t('platformSearch.more.shown', { shown: free.length, total: result.availableCount })}</p>
                    <Button
                      type="button"
                      variant="outline"
                      className="public-site-outline h-11 px-5"
                      disabled={stays.isFetchingNextPage}
                      onClick={() => void stays.fetchNextPage()}
                      data-testid="search-more-button"
                    >
                      {stays.isFetchingNextPage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                      {t('platformSearch.more.button')}
                    </Button>
                  </div>
                ) : null}
                {platform ? null : <UnavailableList cards={notFree} orgSlug={slug} stay={stay} />}
                {notes.length > 0 ? (
                  <p className="sr-note" data-testid="search-note">
                    <Receipt aria-hidden="true" />
                    <span>{notes.map((key) => t(`siteSearch.note.${key}`)).join(' ')}</span>
                  </p>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}
        {showMap ? (
          <aside className="sr-side" aria-label={t('siteSearch.map.label')}>
            <ResultsMapPane
              cards={items}
              orgSlug={platform ? undefined : slug}
              nights={result?.nights ?? null}
              stay={hasDates ? stay : null}
              link={link}
            />
          </aside>
        ) : null}
      </div>

      {!desktop && items.length > 0 ? (
        <button
          type="button"
          className="sr-toggle"
          onClick={() => setSearch({ view: search.view === 'map' ? 'list' : 'map' })}
          data-testid="search-view-toggle"
        >
          {search.view === 'map' ? <List aria-hidden="true" /> : <MapIcon aria-hidden="true" />}
          <span>{search.view === 'map' ? t('siteSearch.map.showList') : t('siteSearch.map.showMap')}</span>
        </button>
      ) : null}
    </div>
  );
}
