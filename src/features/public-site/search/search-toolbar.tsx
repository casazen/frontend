import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Heart } from 'lucide-react';
import { SITE_TAG_ICONS, type SiteTag } from '@/features/public-site/cards/site-tags';
import { destinationOptions } from '@/features/public-site/home/home-model';
import { SearchBar } from '@/features/public-site/stay/search-bar';
import { usePublicSiteCalendar } from '@/features/public-site/stay/use-public-site-calendar';
import { cn } from '@/lib/utils';
import type { PublicDestination, PublicStaysSort } from '@/types/public-stays.types';
import { SORTS } from './search-state';
import { FiltersSheet } from './filters-sheet';
import type { SearchFacets } from './search-facets';
import type { SearchScope } from './search-scope';
import type { useSearchState } from './use-search-state';

interface SearchToolbarProps {
  /** Where the homes are searched: one booking site, or all of them. */
  scope: SearchScope;
  state: ReturnType<typeof useSearchState>;
  /** What the controls offer (the labels, the capacity, the sliders): from every home of the site, whatever is asked, or from the server for the place. */
  facets: SearchFacets;
  destinations: readonly PublicDestination[] | undefined;
  /** How many homes the guest saved on this device (a site only). */
  favoritesCount: number;
  /** The guest pressed «Cerca» (or the Enter of the bar): the page moves the reader to the results. */
  onSearch: () => void;
}

/** A place typed in a form or a link, as the field says it: `lago-di-como` is «Lago di como». */
function typedPlaceLabel(text: string): string {
  const spaced = text.replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : text;
}

/**
 * The bar above the results (DB-07c): the stay (the «Dove · Quando · Chi» of the site, as on the home), the sort, the labels of the
 * homes as chips to press, and the hearts. Everything it changes is the address: the list under it follows. The stay and the place
 * are the `SearchBar` of DB-20, which on a phone is one field that opens a sheet.
 */
export function SearchToolbar({ scope, state, facets, destinations, favoritesCount, onSearch }: SearchToolbarProps) {
  const { t } = useTranslation();
  const { stay, setStay, where, setWhere, search, setSearch } = state;
  const platform = scope.kind === 'platform';
  const { maxGuests, petsAllowed, tags } = facets;
  const calendar = usePublicSiteCalendar(
    platform ? undefined : scope.slug,
    { adults: stay.adults, children: stay.children },
    platform ? { where } : undefined,
  );
  const options = useMemo(() => {
    const list = destinationOptions(destinations, (count) => t('siteHome.hero.destinationHomes', { count }));
    // A place typed in the form of the home (or in a shared link) is not always one of the list: it is still the place chosen, so it shows.
    if (platform && where && !list.some((option) => option.id === where)) list.unshift({ id: where, label: typedPlaceLabel(where) });
    return list;
  }, [destinations, platform, where, t]);

  const toggleTag = (tag: SiteTag) => {
    const on = search.filters.tags.includes(tag);
    setSearch({ filters: { tags: on ? search.filters.tags.filter((item) => item !== tag) : [...search.filters.tags, tag] } });
  };

  return (
    <div className="sr-bar" data-testid="search-toolbar">
      <div className="sr-bar__stay">
        <SearchBar
          destination={where}
          onDestinationChange={setWhere}
          destinations={options}
          stay={stay}
          onStayChange={setStay}
          calendar={calendar}
          maxGuests={maxGuests}
          petsAllowed={petsAllowed}
          // A site with one place has no «Dove»; across all the sites it is the first field.
          showDestination={platform || options.length > 1}
          onSearch={onSearch}
        />
      </div>
      <div className="sr-bar__tools">
        <FiltersSheet scope={scope} state={state} facets={facets} />
        <label className="sr-only" htmlFor="sr-sort">
          {t('siteSearch.sort.label')}
        </label>
        <select
          id="sr-sort"
          className="sr-sort"
          value={search.sort}
          onChange={(event) => setSearch({ sort: event.target.value as PublicStaysSort })}
          data-testid="search-sort"
        >
          {SORTS.map((sort) => (
            <option key={sort} value={sort}>
              {t(`siteSearch.sort.${sort}`)}
            </option>
          ))}
        </select>
        <ul className="sr-cats" aria-label={t('siteSearch.categories')}>
          {!platform && (favoritesCount > 0 || search.onlyFavorites) ? (
            <li>
              <button
                type="button"
                className="sr-chip"
                aria-pressed={search.onlyFavorites}
                onClick={() => setSearch({ onlyFavorites: !search.onlyFavorites })}
                data-testid="search-only-favorites"
              >
                <Heart aria-hidden="true" />
                {t('siteSearch.onlyFavorites')}
              </button>
            </li>
          ) : null}
          {tags.map(({ tag }) => {
            const Icon = SITE_TAG_ICONS[tag];
            const on = search.filters.tags.includes(tag);
            return (
              <li key={tag}>
                <button type="button" className={cn('sr-chip')} aria-pressed={on} onClick={() => toggleTag(tag)}>
                  <Icon aria-hidden="true" />
                  {t(`siteHome.tags.${tag}`)}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
