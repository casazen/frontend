import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Heart } from 'lucide-react';
import { SITE_TAG_ICONS, countTags, type SiteTag } from '@/features/public-site/cards/site-tags';
import { destinationOptions, maxGuestsOf, petsAllowedOf } from '@/features/public-site/home/home-model';
import { SearchBar } from '@/features/public-site/stay/search-bar';
import { usePublicSiteCalendar } from '@/features/public-site/stay/use-public-site-calendar';
import { cn } from '@/lib/utils';
import type { PublicDestination, PublicStayCard, PublicStaysSort } from '@/types/public-stays.types';
import { SORTS } from './search-state';
import type { useSearchState } from './use-search-state';

interface SearchToolbarProps {
  slug: string;
  state: ReturnType<typeof useSearchState>;
  /** Every home of the site, whatever is asked (the labels and the capacity come from all of them, not from the ones left by a filter). */
  catalog: readonly PublicStayCard[];
  destinations: readonly PublicDestination[] | undefined;
  /** How many homes the guest saved on this device. */
  favoritesCount: number;
  /** The guest pressed «Cerca» (or the Enter of the bar): the page moves the reader to the results. */
  onSearch: () => void;
}

/**
 * The bar above the results (DB-07c): the stay (the «Dove · Quando · Chi» of the site, as on the home), the sort, the labels of the
 * homes as chips to press, and the hearts. Everything it changes is the address: the list under it follows. The stay and the place
 * are the `SearchBar` of DB-20, which on a phone is one field that opens a sheet.
 */
export function SearchToolbar({ slug, state, catalog, destinations, favoritesCount, onSearch }: SearchToolbarProps) {
  const { t } = useTranslation();
  const { stay, setStay, where, setWhere, search, setSearch } = state;
  const maxGuests = maxGuestsOf(catalog);
  const petsAllowed = petsAllowedOf(catalog);
  const calendar = usePublicSiteCalendar(slug, { adults: stay.adults, children: stay.children });
  const options = useMemo(
    () => destinationOptions(destinations, (count) => t('siteHome.hero.destinationHomes', { count })),
    [destinations, t],
  );
  const tags = countTags(catalog);

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
          showDestination={options.length > 1}
          onSearch={onSearch}
        />
      </div>
      <div className="sr-bar__tools">
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
          {favoritesCount > 0 || search.onlyFavorites ? (
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
